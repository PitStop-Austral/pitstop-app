#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_RANGE_MS = 1000;
const MAX_PAGE_SIZE = 100;
const WORKFLOW_FILE = 'ci.yml';

class DeliveryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new DeliveryError('INVALID_DATE');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new DeliveryError('INVALID_DATE');
  }

  return parsed;
}

function parseRepository(value) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(value ?? '')) {
    throw new DeliveryError('INVALID_REPOSITORY');
  }

  const [owner, repo] = value.split('/');
  return { owner, repo, repository: value };
}

function parseArguments(argv) {
  if (argv.length !== 8) {
    throw new DeliveryError('INVALID_ARGUMENTS');
  }

  const values = {};

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];

    if (!['--date', '--env', '--output', '--repository'].includes(name) || value === undefined) {
      throw new DeliveryError('INVALID_ARGUMENTS');
    }

    const key = name.slice(2);
    if (values[key] !== undefined) {
      throw new DeliveryError('INVALID_ARGUMENTS');
    }
    values[key] = value;
  }

  if (Object.keys(values).length !== 4) {
    throw new DeliveryError('INVALID_ARGUMENTS');
  }

  parseDate(values.date);
  parseRepository(values.repository);

  if (!['dev', 'prod'].includes(values.env)) {
    throw new DeliveryError('INVALID_ENV');
  }
  if (!values.output.trim()) {
    throw new DeliveryError('INVALID_ARGUMENTS');
  }

  return values;
}

export function reportingWindow(date) {
  const closedDay = parseDate(date);
  const windowEnd = new Date(
    Date.UTC(closedDay.getUTCFullYear(), closedDay.getUTCMonth(), closedDay.getUTCDate() + 1, 3),
  );
  const windowStart = new Date(windowEnd.getTime() - 30 * DAY_MS);

  return { windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString() };
}

function completedBeforeCutoff(run, windowEnd) {
  return (
    run?.status === 'completed' &&
    run.conclusion !== null &&
    run.conclusion !== undefined &&
    Date.parse(run.updated_at) < Date.parse(windowEnd)
  );
}

function isInsideWindow(timestamp, window) {
  const value = Date.parse(timestamp);
  return (
    Number.isFinite(value) &&
    value >= Date.parse(window.windowStart) &&
    value < Date.parse(window.windowEnd)
  );
}

export function calculateCiSuccess(runs, windowEnd) {
  const excluded = {};
  let success = 0;
  let failure = 0;

  for (const run of runs) {
    if (!completedBeforeCutoff(run, windowEnd)) {
      excluded.incomplete = (excluded.incomplete ?? 0) + 1;
      continue;
    }

    if (run.conclusion === 'success') {
      success += 1;
    } else if (run.conclusion === 'failure') {
      failure += 1;
    } else {
      excluded[run.conclusion] = (excluded[run.conclusion] ?? 0) + 1;
    }
  }

  const denominator = success + failure;
  return {
    excluded,
    numerator: success,
    denominator,
    sampleCount: denominator,
    status: denominator === 0 ? 'NO_DATA' : 'READY',
    value: denominator === 0 ? null : (100 * success) / denominator,
  };
}

export function calculateMeanTimeToMerge(pullRequests, windowStart, windowEnd) {
  const seen = new Set();
  const durations = [];
  let invalidDurationCount = 0;

  for (const pullRequest of pullRequests) {
    if (seen.has(pullRequest.number)) {
      continue;
    }
    seen.add(pullRequest.number);

    const mergedAt = Date.parse(pullRequest.merged_at);
    const createdAt = Date.parse(pullRequest.created_at);

    if (!isMergedInsideWindow(pullRequest, windowStart, windowEnd)) {
      continue;
    }

    const durationHours = (mergedAt - createdAt) / (60 * 60 * 1000);
    if (!Number.isFinite(durationHours) || durationHours < 0) {
      invalidDurationCount += 1;
      continue;
    }
    durations.push(durationHours);
  }

  const sampleCount = durations.length;
  return {
    invalidDurationCount,
    sampleCount,
    status: sampleCount === 0 ? 'NO_DATA' : 'READY',
    value:
      sampleCount === 0 ? null : durations.reduce((total, value) => total + value, 0) / sampleCount,
  };
}

function isMergedInsideWindow(pullRequest, windowStart, windowEnd) {
  const mergedAt = Date.parse(pullRequest.merged_at);
  return (
    pullRequest.merged_at && mergedAt >= Date.parse(windowStart) && mergedAt < Date.parse(windowEnd)
  );
}

function createGitHubClient({ fetchImplementation, repository, token }) {
  const { owner, repo } = parseRepository(repository);

  async function request(path, query = {}) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await fetchImplementation(url, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'x-github-api-version': '2022-11-28',
        },
      });
    } catch {
      throw new DeliveryError('GITHUB_REQUEST_FAILED');
    }

    if (!response.ok) {
      throw new DeliveryError('GITHUB_REQUEST_FAILED');
    }

    try {
      return await response.json();
    } catch {
      throw new DeliveryError('GITHUB_INVALID_RESPONSE');
    }
  }

  return {
    getPullRequest: (number) => request(`pulls/${number}`),
    getRunAttempt: (runId) => request(`actions/runs/${runId}/attempts/1`),
    listClosedPullRequests: (page) =>
      request('pulls', {
        direction: 'desc',
        page,
        per_page: MAX_PAGE_SIZE,
        sort: 'updated',
        state: 'closed',
      }),
    listWorkflowRuns: (start, end, page) =>
      request(`actions/workflows/${WORKFLOW_FILE}/runs`, {
        created: `${start}..${end}`,
        event: 'pull_request',
        page,
        per_page: MAX_PAGE_SIZE,
      }),
  };
}

async function listWorkflowRunRange(client, startMs, endMs) {
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs - 1).toISOString();
  const firstPage = await client.listWorkflowRuns(start, end, 1);

  if (!Number.isInteger(firstPage.total_count) || !Array.isArray(firstPage.workflow_runs)) {
    throw new DeliveryError('GITHUB_INVALID_RESPONSE');
  }

  if (firstPage.total_count >= 1000) {
    if (endMs - startMs <= MIN_RANGE_MS) {
      throw new DeliveryError('WINDOW_TRUNCATED');
    }

    const middle = startMs + Math.floor((endMs - startMs) / 2);
    const left = await listWorkflowRunRange(client, startMs, middle);
    const right = await listWorkflowRunRange(client, middle, endMs);
    return [...left, ...right];
  }

  const runs = [...firstPage.workflow_runs];
  for (let page = 2; runs.length < firstPage.total_count; page += 1) {
    const response = await client.listWorkflowRuns(start, end, page);
    if (!Array.isArray(response.workflow_runs) || response.workflow_runs.length === 0) {
      throw new DeliveryError('GITHUB_INVALID_RESPONSE');
    }
    runs.push(...response.workflow_runs);
  }

  return runs;
}

async function listAllClosedPullRequests(client) {
  const pullRequests = [];

  for (let page = 1; ; page += 1) {
    const response = await client.listClosedPullRequests(page);
    if (!Array.isArray(response)) {
      throw new DeliveryError('GITHUB_INVALID_RESPONSE');
    }
    pullRequests.push(...response);
    if (response.length < MAX_PAGE_SIZE) {
      return pullRequests;
    }
  }
}

function diagnostic(kpiId, result, window, diagnosticCode = null) {
  const value = {
    kpi_id: kpiId,
    status: result.status,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    numerator: result.numerator ?? null,
    denominator: result.denominator ?? null,
    sampleCount: result.sampleCount,
    diagnosticCode,
  };

  if (result.excluded) {
    value.excluded = result.excluded;
  }
  if (result.invalidDurationCount !== undefined) {
    value.invalidDurationCount = result.invalidDurationCount;
  }

  return value;
}

function errorResult() {
  return { sampleCount: 0, status: 'ERROR', value: null };
}

async function collectCiResult(client, window) {
  const runMap = new Map();
  const pullRequestCache = new Map();

  try {
    const rawRuns = await listWorkflowRunRange(
      client,
      Date.parse(window.windowStart),
      Date.parse(window.windowEnd),
    );
    for (const run of rawRuns) {
      if (run?.id !== undefined && isInsideWindow(run.created_at, window) && !runMap.has(run.id)) {
        runMap.set(run.id, run);
      }
    }

    const firstAttempts = [];
    for (const run of runMap.values()) {
      const pullNumber = run.pull_requests?.[0]?.number;
      if (!Number.isInteger(pullNumber)) {
        throw new DeliveryError('EVIDENCE_INCOMPLETE');
      }

      if (!pullRequestCache.has(pullNumber)) {
        pullRequestCache.set(pullNumber, await client.getPullRequest(pullNumber));
      }
      if (pullRequestCache.get(pullNumber)?.base?.ref !== 'main') {
        continue;
      }

      firstAttempts.push(run.run_attempt > 1 ? await client.getRunAttempt(run.id) : run);
    }

    return {
      code: null,
      references: {
        pullRequestNumbers: [...pullRequestCache.keys()],
        runIds: [...runMap.keys()],
      },
      result: calculateCiSuccess(firstAttempts, window.windowEnd),
    };
  } catch (error) {
    return {
      code: error instanceof DeliveryError ? error.code : 'GITHUB_REQUEST_FAILED',
      references: { pullRequestNumbers: [...pullRequestCache.keys()], runIds: [...runMap.keys()] },
      result: errorResult(),
    };
  }
}

async function collectMergeResult(client, window) {
  try {
    const pullRequests = await listAllClosedPullRequests(client);
    return {
      code: null,
      references: {
        pullRequestNumbers: [
          ...new Set(
            pullRequests
              .filter((pullRequest) =>
                isMergedInsideWindow(pullRequest, window.windowStart, window.windowEnd),
              )
              .map(({ number }) => number),
          ),
        ],
      },
      result: calculateMeanTimeToMerge(pullRequests, window.windowStart, window.windowEnd),
    };
  } catch (error) {
    return {
      code: error instanceof DeliveryError ? error.code : 'GITHUB_REQUEST_FAILED',
      references: { pullRequestNumbers: [] },
      result: errorResult(),
    };
  }
}

export async function collectDeliveryKpis({
  date,
  env,
  fetchImplementation = globalThis.fetch,
  repository,
  token,
}) {
  const window = reportingWindow(date);
  const client = createGitHubClient({ fetchImplementation, repository, token });
  const [ci, merge] = await Promise.all([
    collectCiResult(client, window),
    collectMergeResult(client, window),
  ]);
  const measurements = [];

  if (ci.result.status === 'READY') {
    measurements.push({ kpi_id: 'ci_success_rate', value: ci.result.value });
  }
  if (merge.result.status === 'READY') {
    measurements.push({ kpi_id: 'mean_time_to_merge', value: merge.result.value });
  }

  return {
    schemaVersion: 1,
    source: 'delivery',
    date,
    env,
    calculationVersion: 'delivery-v1',
    references: {
      repository,
      workflow: WORKFLOW_FILE,
      ci: ci.references,
      merge: merge.references,
    },
    measurements,
    diagnostics: [
      diagnostic('ci_success_rate', ci.result, window, ci.code),
      diagnostic('mean_time_to_merge', merge.result, window, merge.code),
    ],
  };
}

function createErrorReport({ date, env, repository, code }) {
  const window = reportingWindow(date);
  const result = errorResult();

  return {
    schemaVersion: 1,
    source: 'delivery',
    date,
    env,
    calculationVersion: 'delivery-v1',
    references: { repository, workflow: WORKFLOW_FILE, ci: {}, merge: {} },
    measurements: [],
    diagnostics: [
      diagnostic('ci_success_rate', result, window, code),
      diagnostic('mean_time_to_merge', result, window, code),
    ],
  };
}

export async function executeDeliveryKpis({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImplementation = globalThis.fetch,
  outputPath,
} = {}) {
  const options = parseArguments(argv);
  const report = env.GITHUB_TOKEN?.trim()
    ? await collectDeliveryKpis({
        date: options.date,
        env: options.env,
        fetchImplementation,
        repository: options.repository,
        token: env.GITHUB_TOKEN,
      })
    : createErrorReport({
        date: options.date,
        env: options.env,
        repository: options.repository,
        code: 'GITHUB_TOKEN_REQUIRED',
      });
  const resolvedOutputPath = outputPath ?? resolve(options.output);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report.diagnostics.some(({ status }) => status === 'ERROR') ? 1 : 0;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    process.exitCode = await executeDeliveryKpis();
  } catch (error) {
    console.error(error instanceof DeliveryError ? error.code : 'DELIVERY_KPI_FAILED');
    process.exitCode = 1;
  }
}
