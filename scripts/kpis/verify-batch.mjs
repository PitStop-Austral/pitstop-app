#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { requireSecret, validateBaseUrl } from './config.mjs';
import { ContractError, SCHEMA_VERSION, validatePayloadRows } from './contracts.mjs';
import { appendStepSummary, isDirectRun, parseJson, request, runCli, writeJson } from './io.mjs';
import { receiverHeaders } from './publish-batch.mjs';

const DEFAULT_TIMEOUT_MS = 30_000;
const PASSING = new Set(['verified', 'already_present']);

// Assumes the receiver is PostgREST and its RLS scopes rows to the caller's PROJECT_KEY.
// If TEAM_GUIDE specifies a different read contract, this is the only place to change.
export function buildVerifyRequest({ baseUrl, rows }) {
  const url = new URL(`${validateBaseUrl(baseUrl, 'KPI_API_BASE_URL')}/rest/v1/measurement`);
  url.searchParams.set('select', 'kpi_id,date,env,value,run_id');
  url.searchParams.set('date', `eq.${rows[0].date}`);
  url.searchParams.set('env', `eq.${rows[0].env}`);
  url.searchParams.set('kpi_id', `in.(${rows.map(({ kpi_id }) => kpi_id).join(',')})`);
  return url;
}

// Reads back the batch and classifies each KPI. ignore-duplicates means a 2xx does not prove our
// value was stored: a previous different value is a conflict and is never overwritten.
export function compareRows(rows, received) {
  const ids = new Set(rows.map(({ kpi_id }) => kpi_id));
  const { date, env } = rows[0];
  const inContext = received.filter(
    (row) => row?.date === date && row?.env === env && ids.has(row?.kpi_id),
  );

  const results = rows.map(({ kpi_id, value, run_id }) => {
    const matches = inContext.filter((row) => row.kpi_id === kpi_id);
    let outcome = 'missing';

    if (matches.length > 1) outcome = 'duplicate';
    else if (matches.length === 1 && matches[0].value !== value) outcome = 'conflict';
    else if (matches.length === 1)
      outcome = matches[0].run_id === run_id ? 'verified' : 'already_present';

    return { kpi_id, outcome };
  });

  return {
    ok: results.every(({ outcome }) => PASSING.has(outcome)),
    results,
    foreignRows: received.length - inContext.length,
  };
}

export async function verifyBatch({
  rows,
  baseUrl,
  publishableKey,
  projectKey,
  fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const response = await request(
    fetchImplementation,
    buildVerifyRequest({ baseUrl, rows }),
    {
      method: 'GET',
      headers: { accept: 'application/json', ...receiverHeaders({ publishableKey, projectKey }) },
    },
    timeoutMs,
  );

  if (response.status !== 200) throw new ContractError(`RECEIVER_VERIFY_HTTP_${response.status}`);

  const received = parseJson(response.text, 'RECEIVER_VERIFY_INVALID_JSON');
  if (!Array.isArray(received)) throw new ContractError('RECEIVER_VERIFY_INVALID_BODY');

  return compareRows(rows, received);
}

async function readJsonFile(path, prefix) {
  const text = await readFile(path, 'utf8').catch(() => {
    throw new ContractError(`${prefix}_MISSING`);
  });
  return parseJson(text, `${prefix}_INVALID_JSON`);
}

// The payload was hash-checked before publishing; this guards against a file damaged since then.
async function readPayloadRows(batchDir) {
  const rows = await readJsonFile(join(batchDir, 'payload.json'), 'PAYLOAD');
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return validatePayloadRows(rows, { date: first?.date, env: first?.env });
}

export async function executeVerifyBatch({
  argv = process.argv.slice(2),
  env: processEnv = process.env,
  ...options
} = {}) {
  const { values } = parseArgs({
    args: argv,
    options: { 'batch-dir': { type: 'string' }, receipt: { type: 'string' } },
    strict: true,
  });

  if (!values['batch-dir'] || !values.receipt) throw new ContractError('MISSING_DIRECTORY');

  const receiptPath = resolve(values.receipt);
  // A damaged receipt is replaced, never left behind: the new one says why its publication
  // details are missing, and the run fails.
  const receipt = await readJsonFile(receiptPath, 'RECEIPT').catch((error) => ({
    schemaVersion: SCHEMA_VERSION,
    receiptError: error.code,
  }));
  let verification;

  try {
    verification = await verifyBatch({
      rows: await readPayloadRows(resolve(values['batch-dir'])),
      baseUrl: processEnv.KPI_API_BASE_URL,
      publishableKey: requireSecret(processEnv, 'SUPABASE_PUBLISHABLE_KEY'),
      projectKey: requireSecret(processEnv, 'PROJECT_KEY'),
      ...options,
    });
  } catch (error) {
    const code = error?.kind ? `RECEIVER_VERIFY_${error.code}` : error?.code;
    verification = {
      ok: false,
      code: code ?? 'RECEIVER_VERIFY_FAILED',
      results: [],
      foreignRows: 0,
    };
  }

  await writeJson(receiptPath, { ...receipt, verification });

  await appendStepSummary(
    [
      `### KPI verification \`${receipt.publicationId ?? 'unknown'}\``,
      receipt.receiptError ? `Publication receipt was unreadable: ${receipt.receiptError}.` : '',
      '',
      receipt.recoveredFrom
        ? `Recovered from run ${receipt.recoveredFrom.sourceRunId}.`
        : 'Collected in this run.',
      verification.code ? `Read-back failed: ${verification.code}.` : '',
      '',
      '| KPI | Verification |',
      '| --- | --- |',
      ...verification.results.map(({ kpi_id, outcome }) => `| ${kpi_id} | ${outcome} |`),
    ],
    processEnv.GITHUB_STEP_SUMMARY,
  );

  for (const { kpi_id, outcome } of verification.results) console.log(`${kpi_id}: ${outcome}`);

  if (receipt.receiptError) {
    console.error(`::error::KPI publication receipt was unreadable: ${receipt.receiptError}`);
  }

  if (!verification.ok) {
    const failed = verification.results.filter(({ outcome }) => !PASSING.has(outcome));
    const detail =
      verification.code ?? failed.map(({ kpi_id, outcome }) => `${kpi_id}=${outcome}`).join(', ');
    console.error(`::error::KPI verification failed: ${detail}`);
    return 1;
  }

  return receipt.receiptError ? 1 : 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executeVerifyBatch());
}
