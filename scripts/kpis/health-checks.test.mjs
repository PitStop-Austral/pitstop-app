import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectHealthChecks, executeHealthCheckMonitor } from './health-checks.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function sequenceFetch(responses, requests = []) {
  return async (url, options) => {
    requests.push({ url: url.toString(), options });
    const response = responses.shift();

    if (response instanceof Error) {
      throw response;
    }

    if (typeof response === 'function') {
      return response(options);
    }

    return response;
  };
}

function sequenceClock(...timestamps) {
  return () => new Date(timestamps.shift());
}

test('records two successful checks in deterministic order', async () => {
  const requests = [];
  const report = await collectHealthChecks({
    baseUrl: 'https://pitstop.example/api/',
    fetchImplementation: sequenceFetch(
      [jsonResponse({ status: 'ok' }), jsonResponse({ database: 'up' })],
      requests,
    ),
    now: sequenceClock('2026-10-15T12:00:00.000Z', '2026-10-15T12:00:01.000Z'),
    runAttempt: 2,
    runId: '123456789',
  });

  assert.deepEqual(report, {
    schemaVersion: 1,
    runId: '123456789',
    runAttempt: 2,
    checks: [
      {
        target: 'api',
        checkedAt: '2026-10-15T12:00:00.000Z',
        httpStatus: 200,
        ok: true,
        errorKind: null,
      },
      {
        target: 'db',
        checkedAt: '2026-10-15T12:00:01.000Z',
        httpStatus: 200,
        ok: true,
        errorKind: null,
      },
    ],
  });
  assert.deepEqual(
    requests.map(({ url }) => url),
    ['https://pitstop.example/api/health', 'https://pitstop.example/api/health/db'],
  );
  assert.equal(
    requests.every(({ options }) => options.method === 'GET'),
    true,
  );
});

for (const failingTarget of ['api', 'db']) {
  test(`preserves both results when the ${failingTarget} check returns HTTP 503`, async () => {
    const responses =
      failingTarget === 'api'
        ? [jsonResponse({ secret: 'must-not-leak' }, 503), jsonResponse({ database: 'up' })]
        : [jsonResponse({ status: 'ok' }), jsonResponse({ secret: 'must-not-leak' }, 503)];
    const report = await collectHealthChecks({
      baseUrl: 'https://pitstop.example',
      fetchImplementation: sequenceFetch(responses),
    });

    assert.equal(report.checks.length, 2);
    assert.deepEqual(
      report.checks.map(({ target, httpStatus, ok, errorKind }) => ({
        target,
        httpStatus,
        ok,
        errorKind,
      })),
      failingTarget === 'api'
        ? [
            { target: 'api', httpStatus: 503, ok: false, errorKind: 'http_error' },
            { target: 'db', httpStatus: 200, ok: true, errorKind: null },
          ]
        : [
            { target: 'api', httpStatus: 200, ok: true, errorKind: null },
            { target: 'db', httpStatus: 503, ok: false, errorKind: 'http_error' },
          ],
    );
    assert.equal(JSON.stringify(report).includes('must-not-leak'), false);
  });
}

test('classifies a timeout and still runs the database check', async () => {
  const requests = [];
  const report = await collectHealthChecks({
    baseUrl: 'https://pitstop.example',
    fetchImplementation: sequenceFetch(
      [
        ({ signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          }),
        jsonResponse({ database: 'up' }),
      ],
      requests,
    ),
    timeoutMs: 5,
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(
    report.checks.map(({ target, httpStatus, ok, errorKind }) => ({
      target,
      httpStatus,
      ok,
      errorKind,
    })),
    [
      { target: 'api', httpStatus: null, ok: false, errorKind: 'timeout' },
      { target: 'db', httpStatus: 200, ok: true, errorKind: null },
    ],
  );
});

test('classifies a connection error without storing its raw message', async () => {
  const report = await collectHealthChecks({
    baseUrl: 'https://pitstop.example',
    fetchImplementation: sequenceFetch([
      new TypeError('connection failed with secret-token'),
      jsonResponse({ database: 'up' }),
    ]),
  });

  assert.equal(report.checks[0].errorKind, 'connection_error');
  assert.equal(report.checks[0].httpStatus, null);
  assert.equal(JSON.stringify(report).includes('secret-token'), false);
});

test('classifies invalid JSON and an unexpected contract as invalid responses', async () => {
  const report = await collectHealthChecks({
    baseUrl: 'https://pitstop.example',
    fetchImplementation: sequenceFetch([
      new Response('not-json', { status: 200 }),
      jsonResponse({ database: 'down' }),
    ]),
  });

  assert.deepEqual(
    report.checks.map(({ httpStatus, ok, errorKind }) => ({ httpStatus, ok, errorKind })),
    [
      { httpStatus: 200, ok: false, errorKind: 'invalid_response' },
      { httpStatus: 200, ok: false, errorKind: 'invalid_response' },
    ],
  );
});

test('classifies a response body transport failure as a connection error', async () => {
  const failedBody = new ReadableStream({
    start(controller) {
      controller.error(new TypeError('body connection failed with secret-token'));
    },
  });
  const report = await collectHealthChecks({
    baseUrl: 'https://pitstop.example',
    fetchImplementation: sequenceFetch([
      new Response(failedBody, { status: 200 }),
      jsonResponse({ database: 'up' }),
    ]),
  });

  assert.deepEqual(
    report.checks.map(({ target, httpStatus, ok, errorKind }) => ({
      target,
      httpStatus,
      ok,
      errorKind,
    })),
    [
      { target: 'api', httpStatus: 200, ok: false, errorKind: 'connection_error' },
      { target: 'db', httpStatus: 200, ok: true, errorKind: null },
    ],
  );
  assert.equal(JSON.stringify(report).includes('secret-token'), false);
});

test('treats a missing base URL as two connection errors', async () => {
  const report = await collectHealthChecks({ baseUrl: undefined });

  assert.deepEqual(
    report.checks.map(({ target, httpStatus, ok, errorKind }) => ({
      target,
      httpStatus,
      ok,
      errorKind,
    })),
    [
      { target: 'api', httpStatus: null, ok: false, errorKind: 'connection_error' },
      { target: 'db', httpStatus: null, ok: false, errorKind: 'connection_error' },
    ],
  );
});

test('writes the artifact before returning an unhealthy exit code', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitstop-health-'));
  const outputPath = join(directory, 'health-checks.json');

  try {
    const exitCode = await executeHealthCheckMonitor({
      env: {
        API_BASE_URL: 'https://pitstop.example',
        GITHUB_RUN_ATTEMPT: '3',
        GITHUB_RUN_ID: '987654321',
      },
      fetchImplementation: sequenceFetch([
        jsonResponse({ raw: 'credential-value' }, 503),
        jsonResponse({ database: 'up' }),
      ]),
      now: sequenceClock('2026-10-15T12:30:00.000Z', '2026-10-15T12:30:01.000Z'),
      outputPath,
    });
    const contents = await readFile(outputPath, 'utf8');
    const report = JSON.parse(contents);

    assert.equal(exitCode, 1);
    assert.equal(report.runId, '987654321');
    assert.equal(report.runAttempt, 3);
    assert.equal(report.checks.length, 2);
    assert.equal(contents.includes('credential-value'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
