#!/usr/bin/env node

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { validateBaseUrl, parseEnv, requireSecret } from './config.mjs';
import { ContractError, SCHEMA_VERSION, validateFragment } from './contracts.mjs';
import { parseDate } from './dates.mjs';
import { TransportError, isDirectRun, parseJson, request, runCli, writeJson } from './io.mjs';

const DEFAULT_TIMEOUT_MS = 60_000;

// `error`: the source could not be read; the other sources' READY values are still published.
// `invalid`: the source answered with data that breaks the contract; the whole batch is blocked.
export function failedFragment(source, date, env, kind, code) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source,
    date,
    env,
    measurements: [],
    diagnostics: [],
    [kind]: { code },
  };
}

// Calls PIT-69's GET /internal/kpis/daily. Every failure here is a source failure: no
// response, a non-200 status, or a body that is not JSON.
export async function fetchApiBody({
  baseUrl,
  secret,
  date,
  env,
  fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const url = new URL(`${validateBaseUrl(baseUrl, 'API_BASE_URL')}/internal/kpis/daily`);
  url.searchParams.set('date', date);
  url.searchParams.set('env', env);

  const response = await request(
    fetchImplementation,
    url,
    { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${secret}` } },
    timeoutMs,
  );

  if (response.status !== 200) throw new ContractError(`API_HTTP_${response.status}`);

  return parseJson(response.text, 'API_INVALID_JSON');
}

// Adapts a parsed response into an `api` fragment, throwing ContractError when it breaks the
// contract. The API's runId is kept as a source reference; it is never the publication UUID.
export function adaptApiBody(body, { date, env }) {
  if (typeof body !== 'object' || body === null) throw new ContractError('API_INVALID_BODY');
  if (body.date !== date || body.env !== env) throw new ContractError('API_CONTEXT_MISMATCH');
  if (typeof body.runId !== 'string' || typeof body.calculationVersion !== 'string') {
    throw new ContractError('API_INVALID_BODY');
  }

  return validateFragment(
    {
      schemaVersion: SCHEMA_VERSION,
      source: 'api',
      date,
      env,
      calculationVersion: body.calculationVersion,
      sourceRef: { apiRunId: body.runId },
      measurements: body.measurements,
      diagnostics: body.diagnostics,
    },
    { date, env },
  );
}

// A source failure becomes an `error` fragment with a safe code, never zeros or a mock.
// A contract violation is thrown: the caller must block the batch.
export async function collectApiFragment({ processEnv = process.env, date, env, ...options }) {
  let body;

  try {
    body = await fetchApiBody({
      baseUrl: processEnv.API_BASE_URL,
      secret: requireSecret(processEnv, 'CRON_SECRET'),
      date,
      env,
      ...options,
    });
  } catch (error) {
    if (error instanceof TransportError) {
      return failedFragment('api', date, env, 'error', `API_${error.code}`);
    }
    if (error instanceof ContractError)
      return failedFragment('api', date, env, 'error', error.code);
    throw error;
  }

  return adaptApiBody(body, { date, env });
}

export async function executeApiSnapshot({ argv = process.argv.slice(2), ...options } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: { date: { type: 'string' }, env: { type: 'string' }, output: { type: 'string' } },
    strict: true,
  });

  if (!values.output) throw new ContractError('MISSING_OUTPUT');

  const date = parseDate(values.date);
  const env = parseEnv(values.env);
  let fragment;

  try {
    fragment = await collectApiFragment({ date, env, ...options });
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    await writeJson(
      resolve(values.output),
      failedFragment('api', date, env, 'invalid', error.code),
    );
    console.error(
      `::error::KPI source api broke the contract: ${error.code}; nothing will be published`,
    );
    return 1;
  }

  await writeJson(resolve(values.output), fragment);

  if (fragment.error) {
    console.error(`::error::KPI source api failed: ${fragment.error.code}`);
    return 1;
  }

  console.log(
    `KPI source api: ${fragment.measurements.length} READY of ${fragment.diagnostics.length}`,
  );
  return 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executeApiSnapshot());
}
