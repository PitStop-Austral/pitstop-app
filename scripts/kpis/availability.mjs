#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';

import { ContractError, ENVS, SCHEMA_VERSION } from './contracts.mjs';
import { assertClosedDay, dayWindow, parseDate } from './dates.mjs';
import { createGitHubRequest, listWorkflowRunRange } from './github.mjs';
import { isDirectRun, parseJson, runCli, writeJson } from './io.mjs';

const WORKFLOW_FILE = 'kpi-health-monitor.yml';
const ARTIFACT_FILE = 'health-checks.json';
const PAGE_SIZE = 100;
const SLOT_MS = 30 * 60 * 1000;
// A run created shortly before the day opens may still probe inside it.
const LOOKBACK_MS = 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const TARGETS = { api: 'api_availability', db: 'db_availability' };
const ERROR_KINDS = new Set(['http_error', 'timeout', 'connection_error', 'invalid_response']);
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const invalidArtifact = () => new ContractError('INVALID_ARTIFACT');

// Reads one entry of a GitHub artifact zip. ponytail: no zip64; monitor artifacts are ~330 bytes.
export function readZipEntry(zip, name) {
  try {
    const bytes = Buffer.from(zip);
    const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw invalidArtifact();

    let offset = bytes.readUInt32LE(end + 16);
    for (let index = bytes.readUInt16LE(end + 10); index > 0; index -= 1) {
      if (bytes.readUInt32LE(offset) !== 0x02014b50) throw invalidArtifact();

      const nameLength = bytes.readUInt16LE(offset + 28);
      const entryName = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);

      if (entryName === name) {
        const method = bytes.readUInt16LE(offset + 10);
        const size = bytes.readUInt32LE(offset + 20);
        const local = bytes.readUInt32LE(offset + 42);
        if (bytes.readUInt32LE(local) !== 0x04034b50) throw invalidArtifact();

        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
        const data = bytes.subarray(start, start + size);
        if (method === 0) return data;
        if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ARTIFACT_BYTES });
        throw invalidArtifact();
      }

      offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    }
  } catch {
    throw invalidArtifact();
  }

  throw invalidArtifact();
}

// Mirrors the monitor's success rule: ok only with HTTP 200 and no error kind.
function isValidCheck(check) {
  return (
    Object.hasOwn(TARGETS, check?.target) &&
    typeof check.checkedAt === 'string' &&
    ISO_TIMESTAMP.test(check.checkedAt) &&
    Number.isFinite(Date.parse(check.checkedAt)) &&
    (check.httpStatus === null || Number.isInteger(check.httpStatus)) &&
    (check.ok === true
      ? check.httpStatus === 200 && check.errorKind === null
      : check.ok === false && ERROR_KINDS.has(check.errorKind))
  );
}

// A report must match the run and attempt named by its artifact: anything else is not evidence.
export function parseHealthReport(report, { runId, runAttempt }) {
  const checks = report?.checks;

  if (
    report?.schemaVersion !== 1 ||
    report.runId !== String(runId) ||
    report.runAttempt !== runAttempt ||
    !Array.isArray(checks) ||
    checks.length !== 2 ||
    !checks.every(isValidCheck) ||
    checks[0].target === checks[1].target
  ) {
    throw invalidArtifact();
  }

  return checks;
}

// Both checks of a run are placed by its earliest probe, so api and db always cover the same runs.
const sampleTime = ({ checks }) =>
  Math.min(...checks.map(({ checkedAt }) => Date.parse(checkedAt)));

const isInside = (time, window) =>
  time >= Date.parse(window.windowStart) && time < Date.parse(window.windowEnd);

// Scheduled samples count once per 30-minute slot (the earliest run wins); manual samples are
// reported apart. Missing slots are not failures: no sample at all is NO_DATA.
export function calculateAvailability(samples, window) {
  const start = Date.parse(window.windowStart);
  const end = Date.parse(window.windowEnd);
  const expectedSlots = Math.round((end - start) / SLOT_MS);
  const results = {};

  for (const target of Object.keys(TARGETS)) {
    const slots = new Map();
    const manual = { numerator: 0, denominator: 0 };

    for (const sample of samples) {
      const check = sample.checks.find((item) => item.target === target);
      const time = sampleTime(sample);
      if (!isInside(time, window)) continue;

      if (sample.scheduled) {
        const slot = Math.floor((time - start) / SLOT_MS);
        if (!slots.has(slot) || time < slots.get(slot).time)
          slots.set(slot, { time, ok: check.ok });
      } else {
        manual.denominator += 1;
        if (check.ok) manual.numerator += 1;
      }
    }

    const denominator = slots.size;
    const numerator = [...slots.values()].filter(({ ok }) => ok).length;
    const missingSlots = [];
    for (let slot = 0; slot < expectedSlots; slot += 1) {
      if (!slots.has(slot)) missingSlots.push(new Date(start + slot * SLOT_MS).toISOString());
    }

    results[target] = {
      numerator,
      denominator,
      sampleCount: denominator,
      status: denominator === 0 ? 'NO_DATA' : 'READY',
      value: denominator === 0 ? null : (100 * numerator) / denominator,
      coverage: { expectedSlots, observedSlots: denominator, missingSlots },
      manual,
    };
  }

  return results;
}

function createGitHubClient({ fetchImplementation, repository, token, timeoutMs }) {
  const request = createGitHubRequest({ fetchImplementation, repository, token, timeoutMs });

  return {
    listRuns: (start, end, page) =>
      request(`actions/workflows/${WORKFLOW_FILE}/runs`, {
        created: `${start}..${end}`,
        status: 'completed',
        page,
        per_page: PAGE_SIZE,
      }),
    listArtifacts: async (runId) => {
      const artifacts = [];
      for (let page = 1; ; page += 1) {
        const response = await request(`actions/runs/${runId}/artifacts`, {
          page,
          per_page: PAGE_SIZE,
        });
        if (!Array.isArray(response?.artifacts) || !Number.isInteger(response.total_count)) {
          throw new ContractError('GITHUB_INVALID_RESPONSE');
        }
        artifacts.push(...response.artifacts);
        if (artifacts.length >= response.total_count || response.artifacts.length < PAGE_SIZE) {
          return artifacts;
        }
      }
    },
    // Null when GitHub no longer has the artifact.
    downloadArtifact: async (artifactId) => {
      try {
        return await request(`actions/artifacts/${artifactId}/zip`, {}, 'ARTIFACT_GONE', {
          binary: true,
        });
      } catch (error) {
        if (error.code === 'ARTIFACT_GONE') return null;
        throw error;
      }
    },
  };
}

function attemptOf(name, runId) {
  const match = new RegExp(`^kpi-health-${runId}-(\\d+)$`).exec(name ?? '');
  return match ? Number(match[1]) : null;
}

// One sample per run: the first attempt whose artifact is a valid report. Only a scheduled first
// attempt fills a slot; a rerun is started by a person, so it is reported as manual.
async function collectSamples(client, window) {
  const runs = await listWorkflowRunRange(
    client.listRuns,
    Date.parse(window.windowStart) - LOOKBACK_MS,
    Date.parse(window.windowEnd),
  );
  const counts = { runsWithoutArtifact: 0, invalidArtifacts: 0, expiredArtifacts: 0 };
  const samples = [];

  for (const run of new Map(runs.map((item) => [item.id, item])).values()) {
    // Runs from the lookback hour belong to the previous day's counters.
    const createdInDay = isInside(Date.parse(run.created_at), window);
    const count = (key) => {
      if (createdInDay) counts[key] += 1;
    };
    const candidates = (await client.listArtifacts(run.id))
      .map((artifact) => ({ artifact, attempt: attemptOf(artifact.name, run.id) }))
      .filter(({ attempt }) => attempt !== null)
      .sort((left, right) => left.attempt - right.attempt);
    let sample = null;

    for (const { artifact, attempt } of candidates) {
      const zip = artifact.expired ? null : await client.downloadArtifact(artifact.id);
      if (!zip) {
        count('expiredArtifacts');
        continue;
      }

      try {
        const text = readZipEntry(zip, ARTIFACT_FILE).toString('utf8');
        const checks = parseHealthReport(parseJson(text, 'INVALID_ARTIFACT'), {
          runId: run.id,
          runAttempt: attempt,
        });
        sample = {
          runId: String(run.id),
          scheduled: run.event === 'schedule' && attempt === 1,
          checks,
        };
        break;
      } catch {
        count('invalidArtifacts');
      }
    }

    if (sample) samples.push(sample);
    else if (candidates.length === 0) count('runsWithoutArtifact');
  }

  return { counts, samples };
}

function buildFragment({ date, env, repository, monitorEnv, results, counts, runIds, code }) {
  const window = dayWindow(date);
  const measurements = [];
  const diagnostics = [];

  for (const [target, kpiId] of Object.entries(TARGETS)) {
    const result = results?.[target] ?? { status: 'ERROR', value: null, sampleCount: 0 };
    if (result.status === 'READY') measurements.push({ kpi_id: kpiId, value: result.value });

    diagnostics.push({
      kpi_id: kpiId,
      status: result.status,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      numerator: result.numerator ?? null,
      denominator: result.denominator ?? null,
      sampleCount: result.sampleCount,
      ...(result.coverage ? { coverage: result.coverage, manual: result.manual } : {}),
      ...counts,
      ...(code ? { code } : {}),
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    source: 'availability',
    date,
    env,
    calculationVersion: 'availability-v1',
    sourceRef: { repository, workflow: WORKFLOW_FILE, monitorEnv, runIds: runIds ?? [] },
    measurements,
    diagnostics,
  };
}

function configurationError({ env, monitorEnv, repository, token }) {
  if (!ENVS.includes(monitorEnv)) return 'HEALTH_MONITOR_ENV_REQUIRED';
  // The monitor records no env: its samples only describe the deployment it is configured for.
  if (env !== monitorEnv) return 'ENV_NOT_MONITORED';
  if (!repository) return 'GITHUB_REPOSITORY_REQUIRED';
  if (!token) return 'GITHUB_TOKEN_REQUIRED';
  return null;
}

export async function collectAvailabilityKpis({
  date,
  env,
  monitorEnv,
  repository,
  token,
  fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const context = { date, env, repository, monitorEnv };
  const code = configurationError({ env, monitorEnv, repository, token });
  if (code) return buildFragment({ ...context, code });

  try {
    const window = dayWindow(date);
    const client = createGitHubClient({ fetchImplementation, repository, token, timeoutMs });
    const { counts, samples } = await collectSamples(client, window);
    const runIds = samples
      .filter((sample) => isInside(sampleTime(sample), window))
      .map(({ runId }) => runId);

    return buildFragment({
      ...context,
      results: calculateAvailability(samples, window),
      counts,
      runIds,
    });
  } catch (error) {
    // GitHub transport and response failures arrive as ContractError; anything else is a bug.
    return buildFragment({
      ...context,
      code: error instanceof ContractError ? error.code : 'UNEXPECTED_ERROR',
    });
  }
}

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

export async function executeAvailabilityKpis({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImplementation = globalThis.fetch,
  now = new Date(),
  timeoutMs,
} = {}) {
  const options = parseArguments(argv, env);
  // An open day would undercount its slots; like config.mjs, refuse it without writing a fragment.
  assertClosedDay(options.date, now);
  const report = await collectAvailabilityKpis({
    date: options.date,
    env: options.env,
    monitorEnv: env.KPI_HEALTH_MONITOR_ENV?.trim() || null,
    repository: options.repository,
    token: env.GITHUB_TOKEN?.trim() || null,
    fetchImplementation,
    timeoutMs,
  });
  await writeJson(options.output, report);

  return report.diagnostics.some(({ status }) => status === 'ERROR') ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executeAvailabilityKpis());
}
