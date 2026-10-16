#!/usr/bin/env node

import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseEnv, requireSecret, resolveContext } from './config.mjs';
import { ContractError } from './contracts.mjs';
import { isDirectRun, parseJson, request, runCli, writeJson } from './io.mjs';
import { validateBatchDir } from './publish-batch.mjs';

export const KPI_WORKFLOW_PATH = '.github/workflows/kpi-daily.yml';
const PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 30_000;

async function githubGet({ apiUrl, path, token, fetchImplementation, timeoutMs }) {
  const response = await request(
    fetchImplementation,
    new URL(`${apiUrl.replace(/\/+$/, '')}${path}`),
    {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    },
    timeoutMs,
  );

  if (response.status === 404) return null;
  if (response.status !== 200) throw new ContractError(`GITHUB_HTTP_${response.status}`);
  return parseJson(response.text, 'GITHUB_INVALID_JSON');
}

// Confirms the operator-selected run is a KPI workflow run of this repository and still holds the
// named, unexpired artifact. It never searches other runs or picks the latest batch. The source run
// may have failed: that is exactly the case recovery exists for.
export async function checkSourceRun({
  apiUrl = 'https://api.github.com',
  repository,
  runId,
  artifactName,
  token,
  fetchImplementation = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const get = (path) => githubGet({ apiUrl, path, token, fetchImplementation, timeoutMs });
  const run = await get(`/repos/${repository}/actions/runs/${runId}`);

  if (!run) throw new ContractError('SOURCE_RUN_NOT_FOUND');
  if (run.repository?.full_name !== repository)
    throw new ContractError('SOURCE_RUN_WRONG_REPOSITORY');
  if (run.path !== KPI_WORKFLOW_PATH) throw new ContractError('SOURCE_RUN_WRONG_WORKFLOW');

  for (let page = 1; ; page += 1) {
    const listing = await get(
      `/repos/${repository}/actions/runs/${runId}/artifacts?per_page=${PAGE_SIZE}&page=${page}`,
    );
    const artifacts = listing?.artifacts ?? [];
    const artifact = artifacts.find(({ name }) => name === artifactName);

    if (artifact) {
      if (artifact.expired) throw new ContractError('ARTIFACT_EXPIRED');
      return { artifactId: artifact.id, runId };
    }

    if (artifacts.length < PAGE_SIZE) throw new ContractError('ARTIFACT_NOT_FOUND');
  }
}

// Validates the downloaded batch exactly as preserved and records where it came from.
// It never rebuilds the payload: a mismatch fails instead of recalculating.
export async function validateRecoveredBatch({ dir, date, env, sourceRunId, artifactName }) {
  const batch = await validateBatchDir({ dir, date, env });
  await writeJson(join(dir, 'recovery.json'), { sourceRunId, artifactName });
  return batch;
}

export async function executeRecoverBatch({
  argv = process.argv.slice(2),
  env: processEnv = process.env,
  ...options
} = {}) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      date: { type: 'string' },
      env: { type: 'string' },
      'source-run-id': { type: 'string' },
      'artifact-name': { type: 'string' },
      'batch-dir': { type: 'string' },
    },
    strict: true,
  });
  const context = resolveContext({
    eventName: 'workflow_dispatch',
    inputs: {
      environment: parseEnv(values.env),
      mode: 'recover',
      date: values.date,
      source_run_id: values['source-run-id'],
      artifact_name: values['artifact-name'],
    },
  });

  if (positionals[0] === 'check') {
    await checkSourceRun({
      apiUrl: processEnv.GITHUB_API_URL,
      repository: requireSecret(processEnv, 'GITHUB_REPOSITORY'),
      runId: context.sourceRunId,
      artifactName: context.artifactName,
      token: requireSecret(processEnv, 'GITHUB_TOKEN'),
      ...options,
    });
    console.log(`Found ${context.artifactName} in KPI run ${context.sourceRunId}`);
    return 0;
  }

  if (positionals[0] !== 'validate' || !values['batch-dir'])
    throw new ContractError('INVALID_COMMAND');

  const { manifest, rows } = await validateRecoveredBatch({
    dir: resolve(values['batch-dir']),
    date: context.date,
    env: context.env,
    sourceRunId: context.sourceRunId,
    artifactName: context.artifactName,
  });
  console.log(`Recovered KPI batch ${manifest.publicationId}: ${rows.length} rows, unchanged`);
  return 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executeRecoverBatch());
}
