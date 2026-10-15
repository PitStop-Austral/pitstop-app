#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 15_000;
const OUTPUT_FILENAME = 'health-checks.json';

const CHECKS = [
  {
    target: 'api',
    path: 'health',
    isHealthy: (payload) => payload?.status === 'ok',
  },
  {
    target: 'db',
    path: 'health/db',
    isHealthy: (payload) => payload?.database === 'up',
  },
];

function createResult(target, checkedAt, httpStatus, ok, errorKind) {
  return { target, checkedAt, httpStatus, ok, errorKind };
}

function createCheckUrl(baseUrl, path) {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, '');

  if (!normalizedBaseUrl) {
    throw new TypeError('API_BASE_URL is required');
  }

  return new URL(`${normalizedBaseUrl}/${path}`);
}

function isTimeout(error, signal) {
  return (
    (signal.aborted && signal.reason?.name === 'TimeoutError') || error?.name === 'TimeoutError'
  );
}

function classifyResponseBodyError(error, signal) {
  if (isTimeout(error, signal)) {
    return 'timeout';
  }

  return error?.name === 'SyntaxError' ? 'invalid_response' : 'connection_error';
}

async function runCheck({ baseUrl, check, fetchImplementation, now, timeoutMs }) {
  const checkedAt = now().toISOString();
  const signal = AbortSignal.timeout(timeoutMs);
  let response;

  try {
    const url = createCheckUrl(baseUrl, check.path);
    response = await fetchImplementation(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    });
  } catch (error) {
    return createResult(
      check.target,
      checkedAt,
      null,
      false,
      isTimeout(error, signal) ? 'timeout' : 'connection_error',
    );
  }

  if (response.status !== 200) {
    return createResult(check.target, checkedAt, response.status, false, 'http_error');
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    return createResult(
      check.target,
      checkedAt,
      response.status,
      false,
      classifyResponseBodyError(error, signal),
    );
  }

  if (!check.isHealthy(payload)) {
    return createResult(check.target, checkedAt, response.status, false, 'invalid_response');
  }

  return createResult(check.target, checkedAt, response.status, true, null);
}

function parseRunAttempt(value) {
  const runAttempt = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(runAttempt) && runAttempt > 0 ? runAttempt : 1;
}

export async function collectHealthChecks({
  baseUrl,
  fetchImplementation = globalThis.fetch,
  now = () => new Date(),
  runAttempt = 1,
  runId = 'local',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const checks = [];

  for (const check of CHECKS) {
    checks.push(
      await runCheck({
        baseUrl,
        check,
        fetchImplementation,
        now,
        timeoutMs,
      }),
    );
  }

  return {
    schemaVersion: 1,
    runId,
    runAttempt,
    checks,
  };
}

export async function executeHealthCheckMonitor({
  env = process.env,
  fetchImplementation = globalThis.fetch,
  now = () => new Date(),
  outputPath = resolve(process.cwd(), OUTPUT_FILENAME),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const report = await collectHealthChecks({
    baseUrl: env.API_BASE_URL,
    fetchImplementation,
    now,
    runAttempt: parseRunAttempt(env.GITHUB_RUN_ATTEMPT),
    runId: env.GITHUB_RUN_ID?.trim() || 'local',
    timeoutMs,
  });

  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report.checks.every((check) => check.ok) ? 0 : 1;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    process.exitCode = await executeHealthCheckMonitor();
  } catch {
    console.error('Health monitor failed before the artifact could be written.');
    process.exitCode = 1;
  }
}
