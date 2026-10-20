import assert from 'node:assert/strict';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { sha256 } from '../contracts.mjs';
import { prepareBatch, writeBatch } from '../prepare-batch.mjs';
import { CONTEXT, PUBLICATION_ID, fixture, tempDir } from './helpers.mjs';

const ALL = { api: true, availability: true, delivery: true };
const now = () => new Date('2026-10-22T04:00:05.000Z');

async function fragmentsDir(t, fragments) {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  for (const [source, value] of Object.entries(fragments)) {
    await writeFile(
      join(dir, `${source}.json`),
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }

  return dir;
}

const prepare = (dir, enabled = ALL) =>
  prepareBatch({
    fragmentsDir: dir,
    enabled,
    ...CONTEXT,
    publicationId: PUBLICATION_ID,
    now,
    sourceRunId: '42',
  });

async function allFixtures() {
  return {
    api: await fixture('api.json'),
    availability: await fixture('availability.json'),
    delivery: await fixture('delivery.json'),
  };
}

test('combines the three sources into one batch with a shared publication UUID', async (t) => {
  const batch = await prepare(await fragmentsDir(t, await allFixtures()));
  const rows = JSON.parse(batch.payloadText);

  assert.equal(batch.hasErrors, false);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map(({ kpi_id }) => kpi_id).sort(), [
    'active_vehicles_30d',
    'alert_resolution_rate',
    'api_availability',
    'api_error_rate',
    'api_latency_p95',
    'ci_success_rate',
    'db_availability',
    'mean_time_to_merge',
    'preventive_rate',
    'service_users_30d',
  ]);
  assert.deepEqual(rows[0], {
    kpi_id: 'preventive_rate',
    date: '2026-10-21',
    env: 'dev',
    value: 60,
    run_id: PUBLICATION_ID,
  });
  assert.ok(rows.every(({ run_id }) => run_id === PUBLICATION_ID));
  assert.equal(batch.manifest.payloadSha256, sha256(batch.payloadText));
  assert.equal(batch.manifest.sources.api.calculationVersion, '1');
  assert.deepEqual(batch.manifest.sources.api.sourceRef, {
    apiRunId: '2dd1afc0-43bb-4f82-bb16-0b4dbcb892c0',
  });
  assert.equal(batch.manifest.sourceRunId, '42');
  assert.equal(batch.manifest.createdAt, '2026-10-22T04:00:05.000Z');
  assert.equal(batch.manifest.diagnostics.length, 10);
});

test('disabled sources are skipped even when a file exists', async (t) => {
  const batch = await prepare(await fragmentsDir(t, await allFixtures()), { api: true });

  assert.equal(JSON.parse(batch.payloadText).length, 6);
  assert.deepEqual(batch.manifest.sources.availability, { enabled: false, status: 'DISABLED' });
  assert.equal(batch.hasErrors, false);
});

test('NO_DATA stays a diagnostic and never becomes a null or zero row', async (t) => {
  const api = await fixture('api.json');
  api.measurements = api.measurements.filter(({ kpi_id }) => kpi_id !== 'preventive_rate');
  api.diagnostics[0] = { ...api.diagnostics[0], status: 'NO_DATA', code: 'NO_SERVICES' };

  const batch = await prepare(await fragmentsDir(t, { api }), { api: true });
  const rows = JSON.parse(batch.payloadText);

  assert.equal(
    rows.some(({ kpi_id }) => kpi_id === 'preventive_rate'),
    false,
  );
  assert.equal(
    rows.some(({ value }) => value === null),
    false,
  );
  assert.equal(batch.hasErrors, false);
});

test('without READY measurements there is no payload to post', async (t) => {
  const api = await fixture('api.json');
  api.measurements = [];
  api.diagnostics = api.diagnostics.map((diagnostic) => ({ ...diagnostic, status: 'NO_DATA' }));

  const batch = await prepare(await fragmentsDir(t, { api }), { api: true });

  assert.equal(batch.payloadText, null);
  assert.equal(batch.manifest.payloadSha256, null);
  assert.equal(batch.manifest.rowCount, 0);
});

test('a failed source keeps the job failing but its READY siblings are batched', async (t) => {
  const fragments = await allFixtures();
  fragments.availability = {
    ...fragments.availability,
    measurements: [],
    diagnostics: [],
    error: { code: 'PROBES_UNAVAILABLE' },
  };

  const batch = await prepare(await fragmentsDir(t, fragments));

  assert.equal(batch.hasErrors, true);
  assert.equal(batch.manifest.sources.availability.status, 'ERROR');
  assert.equal(batch.manifest.sources.availability.errorCode, 'PROBES_UNAVAILABLE');
  assert.equal(JSON.parse(batch.payloadText).length, 8);
});

test('a KPI-level ERROR diagnostic marks its source as failed', async (t) => {
  const api = await fixture('api.json');
  api.measurements = api.measurements.filter(({ kpi_id }) => kpi_id !== 'alert_resolution_rate');
  api.diagnostics[1] = { ...api.diagnostics[1], status: 'ERROR', code: 'ALERTS_QUERY_FAILED' };

  const batch = await prepare(await fragmentsDir(t, { api }), { api: true });

  assert.equal(batch.hasErrors, true);
  assert.equal(batch.manifest.sources.api.status, 'ERROR');
});

test('an enabled source without a file is a visible error', async (t) => {
  const { api } = await allFixtures();
  const batch = await prepare(await fragmentsDir(t, { api }), { api: true, delivery: true });

  assert.equal(batch.hasErrors, true);
  assert.deepEqual(batch.manifest.sources.delivery, {
    enabled: true,
    status: 'ERROR',
    errorCode: 'FRAGMENT_MISSING',
  });
  assert.equal(JSON.parse(batch.payloadText).length, 6);
});

test('a fragment that breaks the global contract blocks the whole batch', async (t) => {
  const fragments = await allFixtures();
  const cases = [
    [{ ...fragments, delivery: { ...fragments.delivery, env: 'prod' } }, 'ENV_MISMATCH'],
    [{ ...fragments, delivery: { ...fragments.availability } }, 'FRAGMENT_SOURCE_MISMATCH'],
    [{ ...fragments, delivery: '{not json' }, 'FRAGMENT_INVALID_JSON'],
    [
      {
        ...fragments,
        api: {
          ...fragments.api,
          measurements: [],
          diagnostics: [],
          invalid: { code: 'API_CONTEXT_MISMATCH' },
        },
      },
      'API_CONTEXT_MISMATCH',
    ],
  ];

  for (const [input, code] of cases) {
    await assert.rejects(prepare(await fragmentsDir(t, input)), { code });
  }
});

test('writeBatch stores the exact payload bytes and the manifest', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const batch = await prepare(await fragmentsDir(t, await allFixtures()));

  await writeBatch(dir, batch);

  assert.equal(await readFile(join(dir, 'payload.json'), 'utf8'), batch.payloadText);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')), batch.manifest);

  const emptyDir = join(dir, 'empty');
  await writeBatch(emptyDir, { payloadText: null, manifest: batch.manifest });
  await assert.rejects(stat(join(emptyDir, 'payload.json')), { code: 'ENOENT' });
});
