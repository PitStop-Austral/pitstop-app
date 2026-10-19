#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { ContractError, ENVS, SCHEMA_VERSION } from './contracts.mjs';
import { parseDate } from './dates.mjs';
import { createGitHubRequest, listWorkflowRunRange } from './github.mjs';
import { isDirectRun, runCli, writeJson } from './io.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAGE_SIZE = 100;
const WORKFLOW_FILE = 'ci.yml';

function parseArguments(argv, env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      date: { type: 'string' },
      env: { type: 'string' },
      output: { type: 'string' },
      repository: { type: 'string' },
    },
    strict: true,
  });

  if (!values.output?.trim()) throw new ContractError('MISSING_OUTPUT');
  if (!ENVS.includes(values.env)) throw new ContractError('INVALID_ENV');

  return {
    date: parseDate(values.date),
    env: values.env,
    output: values.output,
    repository: values.repository?.trim() || env.GITHUB_REPOSITORY?.trim() || null,
  };
}

export function reportingWindow(date) {
  const windowEnd = new Date(`${parseDate(date)}T03:00:00.000Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
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
  const request = createGitHubRequest({ fetchImplementation, repository, token });

  return {
    getPullRequest: (number) => request(`pulls/${number}`),
    getRunAttempt: async (runId) => {
      const attempt = await request(`actions/runs/${runId}/attempts/1`, {}, 'EVIDENCE_INCOMPLETE');
      if (typeof attempt.conclusion !== 'string' || typeof attempt.updated_at !== 'string') {
        throw new ContractError('EVIDENCE_INCOMPLETE');
      }
      return attempt;
    },
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

async function listAllClosedPullRequests(client) {
  const pullRequests = [];

  for (let page = 1; ; page += 1) {
    const response = await client.listClosedPullRequests(page);
    if (!Array.isArray(response)) {
      throw new ContractError('GITHUB_INVALID_RESPONSE');
    }
    pullRequests.push(...response);
    if (response.length < MAX_PAGE_SIZE) {
      return pullRequests;
    }
  }
}

function diagnostic(kpiId, result, window, code = null) {
  const value = {
    kpi_id: kpiId,
    status: result.status,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    numerator: result.numerator ?? null,
    denominator: result.denominator ?? null,
    sampleCount: result.sampleCount,
  };

  if (code) value.code = code;

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
      client.listWorkflowRuns,
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
        throw new ContractError('EVIDENCE_INCOMPLETE');
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
      code: error instanceof ContractError ? error.code : 'GITHUB_REQUEST_FAILED',
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
      code: error instanceof ContractError ? error.code : 'GITHUB_REQUEST_FAILED',
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
    schemaVersion: SCHEMA_VERSION,
    source: 'delivery',
    date,
    env,
    calculationVersion: 'delivery-v1',
    sourceRef: {
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
    schemaVersion: SCHEMA_VERSION,
    source: 'delivery',
    date,
    env,
    calculationVersion: 'delivery-v1',
    sourceRef: { repository, workflow: WORKFLOW_FILE, ci: {}, merge: {} },
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
  const options = parseArguments(argv, env);
  const errorCode = options.repository
    ? env.GITHUB_TOKEN?.trim()
      ? null
      : 'GITHUB_TOKEN_REQUIRED'
    : 'GITHUB_REPOSITORY_REQUIRED';
  const report = errorCode
    ? createErrorReport({
        date: options.date,
        env: options.env,
        repository: options.repository,
        code: errorCode,
      })
    : await collectDeliveryKpis({
        date: options.date,
        env: options.env,
        fetchImplementation,
        repository: options.repository,
        token: env.GITHUB_TOKEN,
      });
  await writeJson(outputPath ?? options.output, report);

  return report.diagnostics.some(({ status }) => status === 'ERROR') ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executeDeliveryKpis());
}
