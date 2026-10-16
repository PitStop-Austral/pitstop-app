#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseEnv } from './config.mjs';
import {
  ContractError,
  SCHEMA_VERSION,
  SOURCES,
  sha256,
  validateFragment,
  validatePayloadRows,
} from './contracts.mjs';
import { parseDate } from './dates.mjs';
import {
  appendStepSummary,
  isDirectRun,
  parseJson,
  runCli,
  writeGithubOutputs,
  writeJson,
} from './io.mjs';

async function readFragment(fragmentsDir, source, readFileImplementation) {
  try {
    return await readFileImplementation(join(fragmentsDir, `${source}.json`), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

// Combines the enabled sources' fragments into one batch. A present fragment that breaks the
// contract aborts everything (throws); a missing or failed enabled source only marks the batch
// as having errors, and its READY siblings are still published.
export async function prepareBatch({
  fragmentsDir,
  enabled,
  date,
  env,
  publicationId = randomUUID(),
  now = () => new Date(),
  sourceRunId = 'local',
  readFileImplementation = readFile,
}) {
  const sources = {};
  const diagnostics = [];
  const rows = [];

  for (const source of SOURCES) {
    if (!enabled[source]) {
      sources[source] = { enabled: false, status: 'DISABLED' };
      continue;
    }

    const text = await readFragment(fragmentsDir, source, readFileImplementation);

    if (text === null) {
      sources[source] = { enabled: true, status: 'ERROR', errorCode: 'FRAGMENT_MISSING' };
      continue;
    }

    const fragment = validateFragment(parseJson(text, 'FRAGMENT_INVALID_JSON'), { date, env });

    if (fragment.source !== source) throw new ContractError('FRAGMENT_SOURCE_MISMATCH');

    const entry = {
      enabled: true,
      calculationVersion: fragment.calculationVersion ?? null,
      sourceRef: fragment.sourceRef ?? null,
    };

    if (fragment.error) {
      sources[source] = { ...entry, status: 'ERROR', errorCode: fragment.error.code };
      continue;
    }

    const hasKpiError = fragment.diagnostics.some(({ status }) => status === 'ERROR');
    sources[source] = { ...entry, status: hasKpiError ? 'ERROR' : 'OK' };
    diagnostics.push(...fragment.diagnostics.map((diagnostic) => ({ source, ...diagnostic })));
    rows.push(
      ...fragment.measurements.map(({ kpi_id, value }) => ({
        kpi_id,
        date,
        env,
        value,
        run_id: publicationId,
      })),
    );
  }

  const payloadText =
    rows.length > 0
      ? `${JSON.stringify(validatePayloadRows(rows, { date, env }), null, 2)}\n`
      : null;

  return {
    payloadText,
    hasErrors: Object.values(sources).some(({ status }) => status === 'ERROR'),
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      publicationId,
      date,
      env,
      rowCount: rows.length,
      payloadSha256: payloadText === null ? null : sha256(payloadText),
      createdAt: now().toISOString(),
      sourceRunId,
      sources,
      diagnostics,
    },
  };
}

// The payload is written once here; every later step reads and sends these exact bytes.
export async function writeBatch(outputDir, { payloadText, manifest }) {
  await mkdir(outputDir, { recursive: true });
  if (payloadText !== null) await writeFile(join(outputDir, 'payload.json'), payloadText, 'utf8');
  await writeJson(join(outputDir, 'manifest.json'), manifest);
}

export async function executePrepareBatch({
  argv = process.argv.slice(2),
  env: processEnv = process.env,
} = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      date: { type: 'string' },
      env: { type: 'string' },
      'fragments-dir': { type: 'string' },
      'output-dir': { type: 'string' },
    },
    strict: true,
  });

  if (!values['fragments-dir'] || !values['output-dir'])
    throw new ContractError('MISSING_DIRECTORY');

  const batch = await prepareBatch({
    fragmentsDir: resolve(values['fragments-dir']),
    enabled: {
      api: true,
      availability: processEnv.KPI_ENABLE_AVAILABILITY === 'true',
      delivery: processEnv.KPI_ENABLE_DELIVERY === 'true',
    },
    date: parseDate(values.date),
    env: parseEnv(values.env),
    sourceRunId: processEnv.GITHUB_RUN_ID?.trim() || 'local',
  });

  await writeBatch(resolve(values['output-dir']), batch);
  await writeGithubOutputs(
    { ready: batch.payloadText !== null, has_errors: batch.hasErrors },
    processEnv.GITHUB_OUTPUT,
  );

  const { manifest } = batch;
  await appendStepSummary(
    [
      `### KPI coverage ${manifest.env} ${manifest.date}`,
      '',
      `Publication \`${manifest.publicationId}\`: ${manifest.rowCount} row(s) to publish.`,
      '',
      '| Source | Status | Error |',
      '| --- | --- | --- |',
      ...Object.entries(manifest.sources).map(
        ([source, { status, errorCode }]) => `| ${source} | ${status} | ${errorCode ?? ''} |`,
      ),
      '',
      '| Source | KPI | Status | Code |',
      '| --- | --- | --- | --- |',
      ...manifest.diagnostics.map(
        ({ source, kpi_id, status, code }) =>
          `| ${source} | ${kpi_id} | ${status} | ${code ?? ''} |`,
      ),
    ],
    processEnv.GITHUB_STEP_SUMMARY,
  );

  for (const [source, { status, errorCode }] of Object.entries(manifest.sources)) {
    if (status === 'ERROR')
      console.error(`::error::KPI source ${source} failed: ${errorCode ?? 'KPI_ERROR'}`);
  }
  console.log(`KPI batch ${manifest.publicationId}: ${manifest.rowCount} rows`);
  return 0;
}

if (isDirectRun(import.meta.url)) {
  await runCli(() => executePrepareBatch());
}
