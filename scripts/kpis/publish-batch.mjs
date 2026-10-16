#!/usr/bin/env node

import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseEnv, requireSecret, validateBaseUrl } from './config.mjs';
import { ContractError, SCHEMA_VERSION, sha256, validatePayloadRows } from './contracts.mjs';
import { parseDate } from './dates.mjs';
import {
  TransportError,
  isDirectRun,
  parseJson,
  request,
  runCli,
  writeGithubOutputs,
  writeJson,
} from './io.mjs';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5_000, 15_000];
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BUDGET_MS = 120_000;

// Why the receiver refused a batch, per TEAM_GUIDE. These are never retried automatically.
const REJECTION_HINTS = {
  400: 'invalid payload contract',
  401: 'env does not match PROJECT_KEY',
  403: 'missing, invalid, or revoked PROJECT_KEY',
  409: 'unknown or foreign kpi_id, or integrity conflict',
};

export function receiverHeaders({ publishableKey, projectKey }) {
  return { apikey: publishableKey, 'x-project-key': projectKey };
}

// Loads a batch directory and proves it is intact and belongs to the expected context.
export async function validateBatchDir({ dir, date, env }) {
  const payloadBytes = await readFile(join(dir, 'payload.json')).catch(() => {
    throw new ContractError('PAYLOAD_MISSING');
  });
  const manifestText = await readFile(join(dir, 'manifest.json'), 'utf8').catch(() => {
    throw new ContractError('MANIFEST_MISSING');
  });
  const manifest = parseJson(manifestText, 'MANIFEST_INVALID_JSON');

  if (manifest?.schemaVersion !== SCHEMA_VERSION)
    throw new ContractError('UNSUPPORTED_SCHEMA_VERSION');
  if (manifest.date !== date) throw new ContractError('DATE_MISMATCH');
  if (manifest.env !== env) throw new ContractError('ENV_MISMATCH');
  if (sha256(payloadBytes) !== manifest.payloadSha256)
    throw new ContractError('PAYLOAD_HASH_MISMATCH');

  const rows = validatePayloadRows(
    parseJson(payloadBytes.toString('utf8'), 'PAYLOAD_INVALID_JSON'),
    {
      date,
      env,
    },
  );

  if (rows[0].run_id !== manifest.publicationId) throw new ContractError('PUBLICATION_ID_MISMATCH');

  return { payloadBytes, rows, manifest };
}

// Empty or unset uses the default; anything else must be a positive integer of milliseconds.
export function parseBudgetMs(value) {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return DEFAULT_BUDGET_MS;

  const budget = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new ContractError('INVALID_KPI_PUBLISH_BUDGET_MS');
  }
  return budget;
}

function retryAfterMs(headers, now) {
  const value = headers?.get('retry-after')?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;

  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now().getTime());
}

// POSTs the exact preserved bytes. Retries only transient failures (timeout, connection, 429, 5xx),
// at most three attempts in total, and stops early rather than wait past the deadline.
// `outcome`: accepted | rejected | unavailable | ambiguous. Once any attempt timed out or lost its
// connection, the rows may have landed, so the outcome stays ambiguous even if a later attempt
// is refused with a 4xx: only a read-back can tell.
export async function publishBatch({
  payloadBytes,
  baseUrl,
  publishableKey,
  projectKey,
  backupArtifactId,
  deadline,
  fetchImplementation = globalThis.fetch,
  sleep = delay,
  now = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  // The batch must already be preserved as an artifact before the first POST.
  if (!backupArtifactId) throw new ContractError('BACKUP_NOT_CONFIRMED');

  const url = new URL(`${validateBaseUrl(baseUrl, 'KPI_API_BASE_URL')}/rest/v1/measurement`);
  url.searchParams.set('on_conflict', 'project_id,kpi_id,date,env');
  const init = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=ignore-duplicates',
      ...receiverHeaders({ publishableKey, projectKey }),
    },
    body: payloadBytes,
  };
  const attempts = [];
  let ambiguous = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response = null;

    try {
      response = await request(fetchImplementation, url, init, timeoutMs);
      attempts.push({ status: response.status });
    } catch (error) {
      if (!(error instanceof TransportError)) throw error;
      attempts.push({ error: error.kind });
      ambiguous = true;
    }

    if (response && response.status >= 200 && response.status < 300) {
      return { outcome: 'accepted', code: null, attempts };
    }

    if (response && response.status !== 429 && response.status < 500) {
      return {
        outcome: ambiguous ? 'ambiguous' : 'rejected',
        code: `RECEIVER_HTTP_${response.status}`,
        attempts,
      };
    }

    if (attempt === MAX_ATTEMPTS) break;

    const waitMs = retryAfterMs(response?.headers, now) ?? RETRY_DELAYS_MS[attempt - 1];

    if (now().getTime() + waitMs > deadline) {
      return {
        outcome: ambiguous ? 'ambiguous' : 'unavailable',
        code: 'RETRY_DEADLINE_EXCEEDED',
        attempts,
      };
    }

    await sleep(waitMs);
  }

  return {
    outcome: ambiguous ? 'ambiguous' : 'unavailable',
    code: 'RECEIVER_RETRIES_EXHAUSTED',
    attempts,
  };
}

async function readRecovery(dir) {
  try {
    return JSON.parse(await readFile(join(dir, 'recovery.json'), 'utf8'));
  } catch {
    return null;
  }
}

export async function executePublishBatch({
  argv = process.argv.slice(2),
  env: processEnv = process.env,
  ...options
} = {}) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'batch-dir': { type: 'string' },
      date: { type: 'string' },
      env: { type: 'string' },
      receipt: { type: 'string' },
    },
    strict: true,
  });

  if (!values['batch-dir']) throw new ContractError('MISSING_DIRECTORY');

  const dir = resolve(values['batch-dir']);
  const date = parseDate(values.date);
  const env = parseEnv(values.env);
  const { payloadBytes, rows, manifest } = await validateBatchDir({ dir, date, env });

  if (positionals[0] === 'validate') {
    console.log(
      `KPI batch ${manifest.publicationId} is valid: ${rows.length} rows, sha256 ${manifest.payloadSha256}`,
    );
    return 0;
  }

  if (!values.receipt) throw new ContractError('MISSING_RECEIPT_PATH');

  const now = options.now ?? (() => new Date());
  const budgetMs = parseBudgetMs(processEnv.KPI_PUBLISH_BUDGET_MS);
  const result = await publishBatch({
    payloadBytes,
    baseUrl: processEnv.KPI_API_BASE_URL,
    publishableKey: requireSecret(processEnv, 'SUPABASE_PUBLISHABLE_KEY'),
    projectKey: requireSecret(processEnv, 'PROJECT_KEY'),
    backupArtifactId: processEnv.KPI_BACKUP_ARTIFACT_ID?.trim(),
    deadline: now().getTime() + budgetMs,
    ...options,
  });
  const recovery = await readRecovery(dir);
  // Only a clean refusal proves nothing was stored; anything else must be read back.
  const readBackRequired = result.outcome !== 'rejected';

  await writeJson(resolve(values.receipt), {
    schemaVersion: SCHEMA_VERSION,
    publicationId: manifest.publicationId,
    date,
    env,
    payloadSha256: manifest.payloadSha256,
    actionsRunId: processEnv.GITHUB_RUN_ID ?? 'local',
    actionsRunAttempt: processEnv.GITHUB_RUN_ATTEMPT ?? '1',
    backupArtifactId: processEnv.KPI_BACKUP_ARTIFACT_ID,
    recoveredFrom: recovery,
    publication: { ...result, readBackRequired },
    verification: null,
  });
  await writeGithubOutputs({ verify: readBackRequired }, processEnv.GITHUB_OUTPUT);

  if (result.outcome !== 'accepted') {
    const status = Number(result.code?.replace('RECEIVER_HTTP_', ''));
    const hint = REJECTION_HINTS[status] ? ` (${REJECTION_HINTS[status]})` : '';
    console.error(`::error::KPI publication ${result.outcome}: ${result.code}${hint}`);
    return 1;
  }

  console.log(
    `KPI batch ${manifest.publicationId} accepted after ${result.attempts.length} attempt(s)`,
  );
  return 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executePublishBatch());
}
