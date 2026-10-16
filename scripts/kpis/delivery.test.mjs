import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  calculateCiSuccess,
  calculateMeanTimeToMerge,
  collectDeliveryKpis,
  executeDeliveryKpis,
  reportingWindow,
} from './delivery.mjs';
import { ciRuns, pullRequests, window } from './delivery.fixtures.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

test('uses the Argentine closed-day boundaries', () => {
  assert.deepEqual(reportingWindow('2026-10-21'), window);
});

test('calculates success rates and excludes non-final conclusions', () => {
  assert.deepEqual(calculateCiSuccess(ciRuns, window.windowEnd), {
    excluded: { cancelled: 1, incomplete: 1 },
    numerator: 1,
    denominator: 2,
    sampleCount: 2,
    status: 'READY',
    value: 50,
  });
  assert.equal(calculateCiSuccess([], window.windowEnd).status, 'NO_DATA');
  assert.equal(
    calculateCiSuccess([...Array(8).fill(ciRuns[0]), ...Array(2).fill(ciRuns[1])], window.windowEnd)
      .value,
    80,
  );
  assert.equal(calculateCiSuccess([ciRuns[0]], window.windowEnd).value, 100);
  assert.equal(calculateCiSuccess([ciRuns[1]], window.windowEnd).value, 0);
});

test('averages merge duration, including fractional hours, without duplicates', () => {
  const result = calculateMeanTimeToMerge(
    [
      ...pullRequests,
      pullRequests[0],
      { number: 3, created_at: '2026-10-21T05:00:00.000Z', merged_at: '2026-10-21T04:00:00.000Z' },
      { number: 4, created_at: '2026-10-10T00:00:00.000Z', merged_at: null },
    ],
    window.windowStart,
    window.windowEnd,
  );

  assert.deepEqual(result, {
    invalidDurationCount: 1,
    sampleCount: 2,
    status: 'READY',
    value: 2.5,
  });
});

test('uses the first rerun attempt and rejects a missing PR relationship', async () => {
  const requests = [];
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      requests.push(url.toString());
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [
            {
              id: 10,
              created_at: '2026-10-20T10:00:00.000Z',
              pull_requests: [{ number: 8 }],
              run_attempt: 2,
              status: 'completed',
              conclusion: 'success',
              updated_at: '2026-10-20T10:00:00.000Z',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/actions/runs/10/attempts/1')) {
        return jsonResponse({
          status: 'completed',
          conclusion: 'failure',
          updated_at: '2026-10-20T10:00:00.000Z',
        });
      }
      if (url.pathname.endsWith('/pulls/8')) {
        return jsonResponse({ base: { ref: 'main' } });
      }
      if (url.pathname.endsWith('/pulls')) {
        return jsonResponse([]);
      }
      throw new Error('unexpected request');
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 0);
  assert.equal(
    requests.some((url) => url.endsWith('/actions/runs/10/attempts/1')),
    true,
  );
});

test('excludes workflow runs whose pull request does not target main', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [
            {
              id: 10,
              created_at: '2026-10-20T10:00:00.000Z',
              pull_requests: [{ number: 8 }],
              run_attempt: 1,
            },
          ],
        });
      }
      if (url.pathname.endsWith('/pulls/8')) {
        return jsonResponse({ base: { ref: 'develop' } });
      }
      return jsonResponse([]);
    },
  });

  assert.equal(report.diagnostics[0].status, 'NO_DATA');
  assert.equal(
    report.measurements.some(({ kpi_id }) => kpi_id === 'ci_success_rate'),
    false,
  );
});

test('splits a potentially truncated Actions range before accepting it', async () => {
  let actionRequests = 0;
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        actionRequests += 1;
        return jsonResponse(
          actionRequests === 1
            ? { total_count: 1000, workflow_runs: [] }
            : {
                total_count: 0,
                workflow_runs: [],
              },
        );
      }
      return jsonResponse([]);
    },
  });

  assert.equal(actionRequests, 3);
  assert.equal(report.diagnostics[0].status, 'NO_DATA');
});

test('collects every Actions page before calculating the success rate', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        const page = url.searchParams.get('page');
        return jsonResponse({
          total_count: 2,
          workflow_runs:
            page === '1'
              ? [
                  {
                    id: 10,
                    created_at: '2026-10-20T10:00:00.000Z',
                    pull_requests: [{ number: 8 }],
                    run_attempt: 1,
                    status: 'completed',
                    conclusion: 'success',
                    updated_at: '2026-10-20T10:00:00.000Z',
                  },
                ]
              : [
                  {
                    id: 11,
                    created_at: '2026-10-20T11:00:00.000Z',
                    pull_requests: [{ number: 9 }],
                    run_attempt: 1,
                    status: 'completed',
                    conclusion: 'failure',
                    updated_at: '2026-10-20T11:00:00.000Z',
                  },
                ],
        });
      }
      if (url.pathname.endsWith('/pulls/8') || url.pathname.endsWith('/pulls/9')) {
        return jsonResponse({ base: { ref: 'main' } });
      }
      return jsonResponse([]);
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 50);
});

test('marks CI as ERROR when its first rerun attempt cannot be recovered', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [
            {
              id: 10,
              created_at: '2026-10-20T10:00:00.000Z',
              pull_requests: [{ number: 8 }],
              run_attempt: 2,
            },
          ],
        });
      }
      if (url.pathname.endsWith('/pulls/8')) {
        return jsonResponse({ base: { ref: 'main' } });
      }
      if (url.pathname.endsWith('/actions/runs/10/attempts/1')) {
        return jsonResponse({}, 404);
      }
      return jsonResponse([]);
    },
  });

  assert.deepEqual(report.diagnostics[0], {
    kpi_id: 'ci_success_rate',
    status: 'ERROR',
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    numerator: null,
    denominator: null,
    sampleCount: 0,
    diagnosticCode: 'GITHUB_REQUEST_FAILED',
  });
});

test('reports incomplete evidence and GitHub failures as errors', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [{ id: 10, created_at: '2026-10-20T10:00:00.000Z', pull_requests: [] }],
        });
      }
      return jsonResponse({ message: 'not returned to output' }, 503);
    },
  });

  assert.deepEqual(
    report.diagnostics.map(({ kpi_id, status }) => ({ kpi_id, status })),
    [
      { kpi_id: 'ci_success_rate', status: 'ERROR' },
      { kpi_id: 'mean_time_to_merge', status: 'ERROR' },
    ],
  );
  assert.equal(JSON.stringify(report).includes('not returned to output'), false);
});

test('writes a CLI fragment and returns a nonzero code for source errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitstop-delivery-'));
  const outputPath = join(directory, 'delivery.json');

  try {
    const code = await executeDeliveryKpis({
      argv: [
        '--date',
        '2026-10-21',
        '--env',
        'dev',
        '--repository',
        'PitStop-Austral/pitstop-app',
        '--output',
        outputPath,
      ],
      env: { GITHUB_TOKEN: 'secret-token' },
      fetchImplementation: async () => jsonResponse({}, 503),
    });
    const contents = await readFile(outputPath, 'utf8');

    assert.equal(code, 1);
    assert.equal(JSON.parse(contents).source, 'delivery');
    assert.equal(contents.includes('secret-token'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('writes ERROR diagnostics instead of treating a missing token as no data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitstop-delivery-'));
  const outputPath = join(directory, 'nested', 'delivery.json');

  try {
    const code = await executeDeliveryKpis({
      argv: [
        '--date',
        '2026-10-21',
        '--env',
        'dev',
        '--repository',
        'PitStop-Austral/pitstop-app',
        '--output',
        outputPath,
      ],
      env: {},
    });

    assert.equal(code, 1);
    assert.deepEqual(
      JSON.parse(await readFile(outputPath, 'utf8')).diagnostics.map(
        ({ status, diagnosticCode }) => ({
          status,
          diagnosticCode,
        }),
      ),
      [
        { status: 'ERROR', diagnosticCode: 'GITHUB_TOKEN_REQUIRED' },
        { status: 'ERROR', diagnosticCode: 'GITHUB_TOKEN_REQUIRED' },
      ],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
