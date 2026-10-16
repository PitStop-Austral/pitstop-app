import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';

import { collectApiFragment } from '../api-snapshot.mjs';
import { writeJson } from '../io.mjs';
import { prepareBatch, writeBatch } from '../prepare-batch.mjs';
import { executePublishBatch, publishBatch, validateBatchDir } from '../publish-batch.mjs';
import { executeRecoverBatch } from '../recover-batch.mjs';
import { executeVerifyBatch, verifyBatch } from '../verify-batch.mjs';
import { CONTEXT, fakeTime, fixture, jsonResponse, tempDir } from './helpers.mjs';

const keys = { publishableKey: 'sb_publishable_test', projectKey: 'project-key-test' };
const SOURCE_ARTIFACT = 'kpi-batch-dev-2026-10-21-555-1';

// A controlled PostgREST-like receiver: unique by (kpi_id, date, env), ignore-duplicates on insert.
async function startReceiver(t, { dropFirstResponse = false, laterStatus = 201 } = {}) {
  const rows = new Map();
  const stats = { posts: 0, gets: 0 };
  let drop = dropFirstResponse;

  const server = createServer(async (request, response) => {
    if (
      request.headers.apikey !== keys.publishableKey ||
      request.headers['x-project-key'] !== keys.projectKey
    ) {
      response.writeHead(403).end();
      return;
    }

    const url = new URL(request.url, 'http://receiver');

    if (request.method === 'POST') {
      stats.posts += 1;
      let body = '';
      for await (const chunk of request) body += chunk;

      for (const row of JSON.parse(body)) {
        const key = `${row.kpi_id}|${row.date}|${row.env}`;
        if (!rows.has(key)) rows.set(key, row);
      }

      // The rows are stored, but the client never sees the response.
      if (drop) {
        drop = false;
        request.socket.destroy();
        return;
      }

      response.writeHead(laterStatus).end();
      return;
    }

    stats.gets += 1;
    const ids = url.searchParams.get('kpi_id').slice('in.('.length, -1).split(',');
    const date = url.searchParams.get('date').slice('eq.'.length);
    const env = url.searchParams.get('env').slice('eq.'.length);
    const matches = [...rows.values()].filter(
      (row) => row.date === date && row.env === env && ids.includes(row.kpi_id),
    );
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(matches));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((done) => server.close(done)));

  return { url: `http://127.0.0.1:${server.address().port}`, rows, stats };
}

async function workspace(t) {
  const root = await tempDir();
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    fragments: join(root, 'fragments'),
    batch: join(root, 'batch'),
    artifact: join(root, 'artifact-store'),
    recovered: join(root, 'recovered'),
    receipt: join(root, 'receipt.json'),
    outputs: join(root, 'github-output'),
  };
}

// Runs the collect branch once and returns the saved batch plus spies over every source.
async function collect(t, receiver) {
  const paths = await workspace(t);
  const apiResponse = await fixture('api-response-ready.json');
  const enabled = { api: true, availability: true, delivery: false };
  const calls = { api: 0, prepare: 0 };

  const fragment = await collectApiFragment({
    processEnv: { API_BASE_URL: 'https://pitstop.example', CRON_SECRET: 'cron' },
    ...CONTEXT,
    fetchImplementation: async () => {
      calls.api += 1;
      return jsonResponse(apiResponse);
    },
  });
  await writeJson(join(paths.fragments, 'api.json'), fragment);
  await writeFile(
    join(paths.fragments, 'availability.json'),
    JSON.stringify(await fixture('availability.json')),
  );

  calls.prepare += 1;
  const batch = await prepareBatch({ fragmentsDir: paths.fragments, enabled, ...CONTEXT });
  await writeBatch(paths.batch, batch);
  // Stands in for actions/upload-artifact: the batch is preserved before the first POST.
  await cp(paths.batch, paths.artifact, { recursive: true });

  return { paths, batch, apiResponse, enabled, calls, receiver };
}

// Recovery through the same CLI entry points the workflow runs, on a copy of the artifact.
function stepEnv({ paths, receiver }, overrides = {}) {
  return {
    KPI_API_BASE_URL: receiver.url,
    SUPABASE_PUBLISHABLE_KEY: keys.publishableKey,
    PROJECT_KEY: keys.projectKey,
    KPI_BACKUP_ARTIFACT_ID: '2',
    GITHUB_RUN_ID: '777',
    GITHUB_OUTPUT: paths.outputs,
    ...overrides,
  };
}

const verifyAgain = (run) =>
  executeVerifyBatch({
    argv: ['--batch-dir', run.paths.recovered, '--receipt', run.paths.receipt],
    env: stepEnv(run),
  });

const readReceipt = async (run) => JSON.parse(await readFile(run.paths.receipt, 'utf8'));

async function recover(run, processEnvOverrides = {}) {
  const { paths } = run;
  await cp(paths.artifact, paths.recovered, { recursive: true });
  const env = stepEnv(run, processEnvOverrides);
  const context = ['--date', CONTEXT.date, '--env', CONTEXT.env];

  const recovered = await executeRecoverBatch({
    argv: [
      'validate',
      ...context,
      '--source-run-id',
      '555',
      '--artifact-name',
      SOURCE_ARTIFACT,
      '--batch-dir',
      paths.recovered,
    ],
    env,
  });
  const published = await executePublishBatch({
    argv: ['--batch-dir', paths.recovered, ...context, '--receipt', paths.receipt],
    env,
    sleep: async () => {},
  });
  const verified = await executeVerifyBatch({
    argv: ['--batch-dir', paths.recovered, '--receipt', paths.receipt],
    env,
  });

  return { recovered, published, verified };
}

test('a lost POST response, then a manual recovery, store the same batch exactly once', async (t) => {
  const receiver = await startReceiver(t, { dropFirstResponse: true });
  const run = await collect(t, receiver);
  const { payloadBytes, rows } = await validateBatchDir({ dir: run.paths.batch, ...CONTEXT });
  const time = fakeTime();

  const result = await publishBatch({
    payloadBytes,
    baseUrl: receiver.url,
    ...keys,
    backupArtifactId: '1',
    deadline: time.now().getTime() + 120_000,
    sleep: time.sleep,
    now: time.now,
  });

  assert.equal(result.outcome, 'accepted');
  assert.deepEqual(result.attempts, [{ error: 'connection_error' }, { status: 201 }]);
  assert.equal(receiver.rows.size, 7);
  assert.ok(
    (await verifyBatch({ rows, baseUrl: receiver.url, ...keys })).results.every(
      ({ outcome }) => outcome === 'verified',
    ),
  );

  // Source data and flags change before the operator recovers; none of it may reach the batch.
  run.apiResponse.measurements[0].value = 99;
  run.enabled.availability = false;
  run.enabled.delivery = true;
  const callsBefore = { ...run.calls };

  const outcome = await recover(run);
  const receipt = JSON.parse(await readFile(run.paths.receipt, 'utf8'));

  assert.deepEqual(outcome, { recovered: 0, published: 0, verified: 0 });
  assert.deepEqual(run.calls, callsBefore);
  assert.equal(
    await readFile(join(run.paths.recovered, 'payload.json'), 'utf8'),
    run.batch.payloadText,
  );
  assert.equal(receipt.publicationId, run.batch.manifest.publicationId);
  assert.deepEqual(receipt.recoveredFrom, { sourceRunId: '555', artifactName: SOURCE_ARTIFACT });
  assert.ok(receipt.verification.results.every(({ outcome: kpi }) => kpi === 'verified'));
  assert.equal(receiver.rows.size, 7);
  assert.equal(receiver.rows.get('preventive_rate|2026-10-21|dev').value, 60);
  assert.equal(receiver.stats.posts, 3);
});

test('recovery delivers a batch whose original send never landed', async (t) => {
  const run = await collect(t, await startReceiver(t));

  assert.deepEqual(await recover(run), { recovered: 0, published: 0, verified: 0 });
  assert.equal(run.receiver.rows.size, 7);
  assert.ok(
    [...run.receiver.rows.values()].every(
      ({ run_id }) => run_id === run.batch.manifest.publicationId,
    ),
  );
});

test('without a confirmed backup nothing is posted', async (t) => {
  const run = await collect(t, await startReceiver(t));

  await assert.rejects(recover(run, { KPI_BACKUP_ARTIFACT_ID: '' }), {
    code: 'BACKUP_NOT_CONFIRMED',
  });
  assert.equal(run.receiver.stats.posts, 0);
});

test('a different value already in the receiver is a conflict and is not overwritten', async (t) => {
  const run = await collect(t, await startReceiver(t));
  const previous = {
    kpi_id: 'preventive_rate',
    ...CONTEXT,
    value: 55,
    run_id: '00000000-0000-4000-8000-000000000000',
  };
  run.receiver.rows.set('preventive_rate|2026-10-21|dev', previous);

  const outcome = await recover(run);
  const receipt = JSON.parse(await readFile(run.paths.receipt, 'utf8'));

  assert.deepEqual(outcome, { recovered: 0, published: 0, verified: 1 });
  assert.equal(receipt.verification.ok, false);
  assert.equal(
    receipt.verification.results.find(({ kpi_id }) => kpi_id === 'preventive_rate').outcome,
    'conflict',
  );
  assert.equal(run.receiver.rows.get('preventive_rate|2026-10-21|dev'), previous);
});

test('a refusal after a lost response is still read back, and the receipt says so', async (t) => {
  const run = await collect(
    t,
    await startReceiver(t, { dropFirstResponse: true, laterStatus: 400 }),
  );

  const outcome = await recover(run);
  const receipt = await readReceipt(run);

  assert.deepEqual(outcome, { recovered: 0, published: 1, verified: 0 });
  assert.match(await readFile(run.paths.outputs, 'utf8'), /^verify=true$/m);
  assert.deepEqual(receipt.publication, {
    outcome: 'ambiguous',
    code: 'RECEIVER_HTTP_400',
    attempts: [{ error: 'connection_error' }, { status: 400 }],
    readBackRequired: true,
  });
  // The first attempt had stored the rows; only the read-back reveals it.
  assert.ok(receipt.verification.results.every(({ outcome: kpi }) => kpi === 'verified'));
});

test('an invalid publish budget fails before any POST', async (t) => {
  const run = await collect(t, await startReceiver(t));

  for (const budget of ['abc', '0', '-5', '1.5', '1e5']) {
    await assert.rejects(recover(run, { KPI_PUBLISH_BUDGET_MS: budget }), {
      code: 'INVALID_KPI_PUBLISH_BUDGET_MS',
    });
  }
  assert.equal(run.receiver.stats.posts, 0);

  // Empty means the default budget.
  assert.deepEqual(await recover(run, { KPI_PUBLISH_BUDGET_MS: ' ' }), {
    recovered: 0,
    published: 0,
    verified: 0,
  });
});

test('a damaged payload or receipt still leaves a receipt with a safe diagnostic', async (t) => {
  const run = await collect(t, await startReceiver(t));
  assert.equal((await recover(run)).verified, 0);
  const payloadPath = join(run.paths.recovered, 'payload.json');
  const payload = await readFile(payloadPath, 'utf8');
  const gets = run.receiver.stats.gets;

  await writeFile(payloadPath, payload.slice(0, 40));
  assert.equal(await verifyAgain(run), 1);
  let receipt = await readReceipt(run);
  assert.equal(receipt.verification.ok, false);
  assert.equal(receipt.verification.code, 'PAYLOAD_INVALID_JSON');
  assert.equal(receipt.publication.outcome, 'accepted');
  assert.equal(run.receiver.stats.gets, gets);

  await writeFile(payloadPath, payload);
  await writeFile(run.paths.receipt, '{"schemaVersion":1,"publ');
  assert.equal(await verifyAgain(run), 1);
  receipt = await readReceipt(run);
  assert.equal(receipt.receiptError, 'RECEIPT_INVALID_JSON');
  assert.equal(receipt.verification.ok, true);

  await rm(run.paths.receipt);
  assert.equal(await verifyAgain(run), 1);
  assert.equal((await readReceipt(run)).receiptError, 'RECEIPT_MISSING');
});
