import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectApiFragment } from '../api-snapshot.mjs';
import {
  CONTEXT,
  fixture,
  hangingFetch,
  jsonResponse,
  sequenceFetch,
  tempDir,
} from './helpers.mjs';

const SCRIPT = fileURLToPath(new URL('../api-snapshot.mjs', import.meta.url));
const processEnv = { API_BASE_URL: 'https://pitstop.example/', CRON_SECRET: 'cron-secret' };

const collect = (fetchImplementation, overrides = {}) =>
  collectApiFragment({ processEnv, ...CONTEXT, fetchImplementation, ...overrides });

test('requests the closed day with the service secret and adapts the response', async () => {
  const fetchImplementation = sequenceFetch([
    jsonResponse(await fixture('api-response-ready.json')),
  ]);
  const fragment = await collect(fetchImplementation);
  const [{ url, options }] = fetchImplementation.requests;

  assert.equal(url, 'https://pitstop.example/internal/kpis/daily?date=2026-10-21&env=dev');
  assert.equal(options.method, 'GET');
  assert.equal(options.headers.authorization, 'Bearer cron-secret');
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(fragment, await fixture('api.json'));
  // The API run id is a source reference, never the publication UUID.
  assert.equal(fragment.sourceRef.apiRunId, '2dd1afc0-43bb-4f82-bb16-0b4dbcb892c0');
  assert.equal(typeof fragment.diagnostics[0].numerator, 'string');
});

test('keeps NO_DATA in diagnostics without publishing a value', async () => {
  const fragment = await collect(
    sequenceFetch([jsonResponse(await fixture('api-response-no-data.json'))]),
  );

  assert.equal(fragment.error, undefined);
  assert.deepEqual(
    fragment.measurements.map(({ kpi_id }) => kpi_id),
    ['service_users_30d', 'active_vehicles_30d'],
  );
  assert.equal(fragment.diagnostics.filter(({ status }) => status === 'NO_DATA').length, 4);
});

test('turns source failures into an error fragment with a safe code', async () => {
  const cases = [
    [jsonResponse({ message: 'Unauthorized' }, 401), 'API_HTTP_401'],
    [jsonResponse({ message: 'Not Found' }, 404), 'API_HTTP_404'],
    [jsonResponse({ message: 'Database is down' }, 503), 'API_HTTP_503'],
    [new Response('<html>oops</html>', { status: 200 }), 'API_INVALID_JSON'],
    [new Response('{"runId":', { status: 200 }), 'API_INVALID_JSON'],
    [new TypeError('fetch failed: ECONNREFUSED 10.0.0.1'), 'API_CONNECTION_ERROR'],
  ];

  for (const [response, code] of cases) {
    const fragment = await collect(sequenceFetch([response]));

    assert.deepEqual(fragment, {
      schemaVersion: 1,
      source: 'api',
      ...CONTEXT,
      measurements: [],
      diagnostics: [],
      error: { code },
    });
  }
});

test('throws on a parseable response that breaks the contract', async () => {
  const ready = await fixture('api-response-ready.json');
  const [first, ...rest] = ready.measurements;
  const cases = [
    [{ ...ready, date: '2026-10-20' }, 'API_CONTEXT_MISMATCH'],
    [{ ...ready, env: 'prod' }, 'API_CONTEXT_MISMATCH'],
    [{ ...ready, runId: undefined }, 'API_INVALID_BODY'],
    [null, 'API_INVALID_BODY'],
    [{ ...ready, measurements: [{ ...first, value: 160 }, ...rest] }, 'VALUE_OUT_OF_RANGE'],
    [{ ...ready, measurements: [...ready.measurements, first] }, 'DUPLICATE_KPI'],
    [
      { ...ready, measurements: [...ready.measurements, { kpi_id: 'api_availability', value: 1 }] },
      'FOREIGN_KPI',
    ],
    // JSON has no NaN: a serializer that emits null for it must not pass as a value.
    [{ ...ready, measurements: [{ ...first, value: null }, ...rest] }, 'VALUE_NOT_FINITE'],
  ];

  for (const [body, code] of cases) {
    await assert.rejects(collect(sequenceFetch([jsonResponse(body)])), { code }, code);
  }
});

test('a hanging API fails with a timeout, not zeros', async () => {
  const fragment = await collect(hangingFetch, { timeoutMs: 10 });
  assert.deepEqual(fragment.error, { code: 'API_TIMEOUT' });
});

test('fails without calling the API when its configuration is missing', async () => {
  const fetchImplementation = sequenceFetch([]);

  assert.equal(
    (
      await collect(fetchImplementation, {
        processEnv: { API_BASE_URL: 'https://pitstop.example' },
      })
    ).error.code,
    'MISSING_CRON_SECRET',
  );
  assert.equal(
    (await collect(fetchImplementation, { processEnv: { CRON_SECRET: 's' } })).error.code,
    'INVALID_API_BASE_URL',
  );
  assert.equal(fetchImplementation.requests.length, 0);
});

function runCli(args, env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { PATH: process.env.PATH, ...env } },
      (error, stdout, stderr) => resolve({ exitCode: error?.code ?? 0, stdout, stderr }),
    );
  });
}

test('CLI writes the fragment and its exit code reflects the source status', async (t) => {
  const ready = JSON.stringify(await fixture('api-response-ready.json'));
  const contractBreaking = JSON.stringify({ ...JSON.parse(ready), env: 'prod' });
  const replies = [
    [200, ready],
    [503, '{"message":"down"}'],
    [200, contractBreaking],
  ];
  const server = createServer((request, response) => {
    const [status, body] = replies.shift();
    assert.equal(request.headers.authorization, 'Bearer cli-secret');
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const dir = await tempDir();
  t.after(() =>
    Promise.all([
      new Promise((done) => server.close(done)),
      rm(dir, { recursive: true, force: true }),
    ]),
  );

  const env = {
    API_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    CRON_SECRET: 'cli-secret',
  };
  const output = join(dir, 'nested', 'api.json');
  const args = ['--date', '2026-10-21', '--env', 'dev', '--output', output];

  const success = await runCli(args, env);
  assert.equal(success.exitCode, 0);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), await fixture('api.json'));

  const failure = await runCli(args, env);
  assert.equal(failure.exitCode, 1);
  assert.match(failure.stderr, /::error::KPI source api failed: API_HTTP_503/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')).error, { code: 'API_HTTP_503' });
  assert.doesNotMatch(failure.stderr + failure.stdout, /cli-secret/);

  const invalid = await runCli(args, env);
  assert.equal(invalid.exitCode, 1);
  assert.match(invalid.stderr, /broke the contract: API_CONTEXT_MISMATCH/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), {
    schemaVersion: 1,
    source: 'api',
    ...CONTEXT,
    measurements: [],
    diagnostics: [],
    invalid: { code: 'API_CONTEXT_MISMATCH' },
  });

  const badArgs = await runCli(
    ['--date', '2026-10-21', '--env', 'staging', '--output', join(dir, 'bad.json')],
    env,
  );
  assert.equal(badArgs.exitCode, 1);
  assert.match(badArgs.stderr, /INVALID_ENV/);
  await assert.rejects(stat(join(dir, 'bad.json')), { code: 'ENOENT' });
});
