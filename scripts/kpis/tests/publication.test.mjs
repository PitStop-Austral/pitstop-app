import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { prepareBatch, writeBatch } from '../prepare-batch.mjs';
import { parseBudgetMs, publishBatch, validateBatchDir } from '../publish-batch.mjs';
import { buildVerifyRequest, verifyBatch } from '../verify-batch.mjs';
import {
  CONTEXT,
  PUBLICATION_ID,
  fakeTime,
  hangingFetch,
  fixture,
  jsonResponse,
  sequenceFetch,
  tempDir,
} from './helpers.mjs';

const RECEIVER = 'https://receiver.example';
const keys = { publishableKey: 'sb_publishable_test', projectKey: 'project-key-test' };
const payloadBytes = Buffer.from(
  '[{"kpi_id":"preventive_rate","date":"2026-10-21","env":"dev","value":60,"run_id":"x"}]',
);
const rows = [
  { kpi_id: 'preventive_rate', date: '2026-10-21', env: 'dev', value: 60, run_id: PUBLICATION_ID },
  { kpi_id: 'api_latency_p95', date: '2026-10-21', env: 'dev', value: 19, run_id: PUBLICATION_ID },
];

function publish(responses, overrides = {}) {
  const time = fakeTime();
  const fetchImplementation = sequenceFetch(responses);
  const result = publishBatch({
    payloadBytes,
    baseUrl: RECEIVER,
    ...keys,
    backupArtifactId: '987',
    deadline: time.now().getTime() + 120_000,
    fetchImplementation,
    sleep: time.sleep,
    now: time.now,
    ...overrides,
  });
  return { result, requests: fetchImplementation.requests, sleeps: time.sleeps };
}

async function batchDir(t) {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'api.json'), JSON.stringify(await fixture('api.json')));
  const batch = await prepareBatch({
    fragmentsDir: dir,
    enabled: { api: true },
    ...CONTEXT,
    publicationId: PUBLICATION_ID,
  });
  await writeBatch(join(dir, 'batch'), batch);
  return join(dir, 'batch');
}

test('validates a batch directory against its manifest hash and context', async (t) => {
  const dir = await batchDir(t);
  const batch = await validateBatchDir({ dir, ...CONTEXT });

  assert.equal(batch.rows.length, 5);
  assert.equal(batch.manifest.publicationId, PUBLICATION_ID);
  await assert.rejects(validateBatchDir({ dir, ...CONTEXT, env: 'prod' }), {
    code: 'ENV_MISMATCH',
  });
  await assert.rejects(validateBatchDir({ dir, ...CONTEXT, date: '2026-10-20' }), {
    code: 'DATE_MISMATCH',
  });

  await writeFile(join(dir, 'payload.json'), batch.payloadBytes.toString().replace('60', '61'));
  await assert.rejects(validateBatchDir({ dir, ...CONTEXT }), { code: 'PAYLOAD_HASH_MISMATCH' });
});

test('POSTs the exact preserved bytes with the receiver headers', async () => {
  const { result, requests } = publish([new Response(null, { status: 201 })]);

  assert.deepEqual(await result, { outcome: 'accepted', code: null, attempts: [{ status: 201 }] });
  assert.equal(
    requests[0].url,
    `${RECEIVER}/rest/v1/measurement?on_conflict=project_id%2Ckpi_id%2Cdate%2Cenv`,
  );
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(requests[0].options.headers, {
    'content-type': 'application/json',
    prefer: 'resolution=ignore-duplicates',
    apikey: 'sb_publishable_test',
    'x-project-key': 'project-key-test',
  });
  assert.equal(requests[0].options.body, payloadBytes);
});

test('refuses to POST before the backup artifact is confirmed', async () => {
  const { result, requests } = publish([], { backupArtifactId: '' });

  await assert.rejects(result, { code: 'BACKUP_NOT_CONFIRMED' });
  assert.equal(requests.length, 0);
});

test('never retries 400, 401, 403, or 409', async () => {
  for (const status of [400, 401, 403, 409]) {
    const { result, requests, sleeps } = publish([jsonResponse({ message: 'no' }, status)]);

    assert.deepEqual(await result, {
      outcome: 'rejected',
      code: `RECEIVER_HTTP_${status}`,
      attempts: [{ status }],
    });
    assert.equal(requests.length, 1);
    assert.deepEqual(sleeps, []);
  }
});

test('retries 5xx with 5s and 15s waits, always sending the same bytes', async () => {
  const { result, requests, sleeps } = publish([
    jsonResponse({}, 503),
    jsonResponse({}, 502),
    new Response(null, { status: 201 }),
  ]);

  assert.equal((await result).outcome, 'accepted');
  assert.deepEqual(sleeps, [5_000, 15_000]);
  assert.ok(requests.every(({ options }) => options.body === payloadBytes));
});

test('stops after three attempts in total', async () => {
  const { result, requests } = publish([
    jsonResponse({}, 500),
    jsonResponse({}, 500),
    jsonResponse({}, 500),
  ]);

  assert.deepEqual(await result, {
    outcome: 'unavailable',
    code: 'RECEIVER_RETRIES_EXHAUSTED',
    attempts: [{ status: 500 }, { status: 500 }, { status: 500 }],
  });
  assert.equal(requests.length, 3);
});

test('honors a valid Retry-After on 429 and ignores an invalid one', async () => {
  const valid = publish([
    jsonResponse({}, 429, { 'retry-after': '2' }),
    new Response(null, { status: 201 }),
  ]);
  assert.equal((await valid.result).outcome, 'accepted');
  assert.deepEqual(valid.sleeps, [2_000]);

  const invalid = publish([
    jsonResponse({}, 429, { 'retry-after': 'soon' }),
    new Response(null, { status: 201 }),
  ]);
  assert.equal((await invalid.result).outcome, 'accepted');
  assert.deepEqual(invalid.sleeps, [5_000]);
});

test('fails instead of waiting past the deadline', async () => {
  const { result, requests, sleeps } = publish([jsonResponse({}, 429, { 'retry-after': '600' })]);

  assert.equal((await result).code, 'RETRY_DEADLINE_EXCEEDED');
  assert.equal(requests.length, 1);
  assert.deepEqual(sleeps, []);
});

test('a lost response is ambiguous: the request may have landed', async () => {
  const lost = () => new TypeError('socket hang up');
  const { result } = publish([lost(), lost(), lost()]);

  assert.deepEqual(await result, {
    outcome: 'ambiguous',
    code: 'RECEIVER_RETRIES_EXHAUSTED',
    attempts: [
      { error: 'connection_error' },
      { error: 'connection_error' },
      { error: 'connection_error' },
    ],
  });
});

test('a 4xx after a lost or timed-out attempt stays ambiguous', async () => {
  const lost = publish([new TypeError('socket hang up'), jsonResponse({}, 400)]);
  assert.deepEqual(await lost.result, {
    outcome: 'ambiguous',
    code: 'RECEIVER_HTTP_400',
    attempts: [{ error: 'connection_error' }, { status: 400 }],
  });

  const timedOut = publish([(options) => hangingFetch(null, options), jsonResponse({}, 409)], {
    timeoutMs: 10,
  });
  assert.deepEqual(await timedOut.result, {
    outcome: 'ambiguous',
    code: 'RECEIVER_HTTP_409',
    attempts: [{ error: 'timeout' }, { status: 409 }],
  });
});

test('parses the publish budget', () => {
  assert.equal(parseBudgetMs(undefined), 120_000);
  assert.equal(parseBudgetMs('  '), 120_000);
  assert.equal(parseBudgetMs('45000'), 45_000);

  for (const value of ['0', '-1', 'abc', '1.5', '1e5', '99999999999999999999']) {
    assert.throws(() => parseBudgetMs(value), { code: 'INVALID_KPI_PUBLISH_BUDGET_MS' }, value);
  }
});

test('reads back only the batch context and ids', () => {
  const url = buildVerifyRequest({ baseUrl: `${RECEIVER}/`, rows });

  assert.equal(url.origin + url.pathname, `${RECEIVER}/rest/v1/measurement`);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    select: 'kpi_id,date,env,value,run_id',
    date: 'eq.2026-10-21',
    env: 'eq.dev',
    kpi_id: 'in.(preventive_rate,api_latency_p95)',
  });
});

test('classifies each received KPI against the batch', async () => {
  const otherRun = '00000000-0000-4000-8000-000000000000';
  const cases = [
    [rows, { ok: true, outcomes: ['verified', 'verified'] }],
    [
      [rows[0], { ...rows[1], run_id: otherRun }],
      { ok: true, outcomes: ['verified', 'already_present'] },
    ],
    [
      [rows[0], { ...rows[1], value: 20, run_id: otherRun }],
      { ok: false, outcomes: ['verified', 'conflict'] },
    ],
    [[rows[0]], { ok: false, outcomes: ['verified', 'missing'] }],
    [[rows[0], rows[0], rows[1]], { ok: false, outcomes: ['duplicate', 'verified'] }],
  ];

  for (const [received, expected] of cases) {
    const fetchImplementation = sequenceFetch([jsonResponse(received)]);
    const verification = await verifyBatch({
      rows,
      baseUrl: RECEIVER,
      ...keys,
      fetchImplementation,
    });

    assert.equal(verification.ok, expected.ok);
    assert.deepEqual(
      verification.results.map(({ outcome }) => outcome),
      expected.outcomes,
    );
    assert.equal(
      fetchImplementation.requests[0].options.headers['x-project-key'],
      'project-key-test',
    );
  }
});

test('ignores rows from another env, date, or KPI', async () => {
  const received = [
    ...rows,
    { ...rows[0], env: 'prod', value: 1 },
    { ...rows[0], date: '2026-10-20', value: 2 },
    { ...rows[0], kpi_id: 'api_error_rate', value: 3 },
  ];
  const verification = await verifyBatch({
    rows,
    baseUrl: RECEIVER,
    ...keys,
    fetchImplementation: sequenceFetch([jsonResponse(received)]),
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.foreignRows, 3);
});

test('a failed read-back is an error, not a pass', async () => {
  const fetchImplementation = sequenceFetch([
    jsonResponse({ message: 'down' }, 503),
    jsonResponse({ rows }),
  ]);

  await assert.rejects(verifyBatch({ rows, baseUrl: RECEIVER, ...keys, fetchImplementation }), {
    code: 'RECEIVER_VERIFY_HTTP_503',
  });
  await assert.rejects(verifyBatch({ rows, baseUrl: RECEIVER, ...keys, fetchImplementation }), {
    code: 'RECEIVER_VERIFY_INVALID_BODY',
  });
});
