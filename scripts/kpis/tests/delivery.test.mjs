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
} from '../delivery.mjs';
import { validateFragment } from '../contracts.mjs';
import {
  ciRuns,
  mergedMainWorkflowRun,
  pullRequests,
  window,
} from './fixtures/delivery-github.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

test('uses the Argentine closed-day boundaries', () => {
  assert.deepEqual(reportingWindow('2026-10-21'), window);
});

test('calculates success rates and excludes non-final conclusions', () => {
  assert.deepEqual(calculateCiSuccess(ciRuns, window.windowEnd), {
    excluded: { cancelled: 1, skipped: 1, timed_out: 1, neutral: 1, incomplete: 1 },
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

test('uses exact run and merge window boundaries', () => {
  assert.deepEqual(
    calculateCiSuccess(
      [
        { conclusion: 'success', status: 'completed', updated_at: window.windowEnd },
        { conclusion: 'failure', status: 'completed', updated_at: '2026-10-21T23:59:59.999Z' },
      ],
      window.windowEnd,
    ),
    {
      excluded: { incomplete: 1 },
      numerator: 0,
      denominator: 1,
      sampleCount: 1,
      status: 'READY',
      value: 0,
    },
  );

  assert.deepEqual(
    calculateMeanTimeToMerge(
      [
        { number: 1, created_at: '2026-09-21T03:00:00.000Z', merged_at: window.windowStart },
        { number: 2, created_at: '2026-10-21T03:00:00.000Z', merged_at: window.windowEnd },
      ],
      window.windowStart,
      window.windowEnd,
    ),
    { invalidDurationCount: 0, sampleCount: 1, status: 'READY', value: 24 },
  );
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

test('counts a non-main PR opened before the window when it merged inside it', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({ total_count: 0, workflow_runs: [] });
      }
      if (url.pathname.endsWith('/pulls')) {
        return jsonResponse([
          {
            number: 1,
            base: { ref: 'develop' },
            created_at: '2026-09-21T03:00:00.000Z',
            merged_at: window.windowStart,
          },
          { number: 2, created_at: '2026-10-20T00:00:00.000Z', merged_at: null },
          {
            number: 3,
            created_at: '2026-10-21T00:00:00.000Z',
            merged_at: window.windowEnd,
          },
        ]);
      }
      return jsonResponse([]);
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'mean_time_to_merge').value, 24);
  assert.deepEqual(report.sourceRef.merge.pullRequestNumbers, [1]);
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
  const runsRequest = new URL(requests.find((url) => url.includes('/actions/workflows/')));
  assert.equal(runsRequest.pathname.endsWith('/actions/workflows/ci.yml/runs'), true);
  assert.equal(runsRequest.searchParams.get('event'), 'pull_request');
  assert.deepEqual(report.sourceRef, {
    repository: 'PitStop-Austral/pitstop-app',
    workflow: 'ci.yml',
    ci: { pullRequestNumbers: [8], runIds: [10] },
    merge: { pullRequestNumbers: [] },
  });
  assert.equal(validateFragment(report, { date: '2026-10-21', env: 'dev' }), report);
});

test('resolves merged pull requests from commits and caches each SHA', async () => {
  let commitRequests = 0;
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 2,
          workflow_runs: [
            mergedMainWorkflowRun,
            { ...mergedMainWorkflowRun, id: 11, conclusion: 'failure' },
          ],
        });
      }
      if (url.pathname.endsWith('/commits/merged-sha/pulls')) {
        commitRequests += 1;
        return jsonResponse([
          { number: 3, base: { ref: 'main' }, head: { ref: 'other-branch' } },
          { number: 8, base: { ref: 'main' }, head: { ref: 'feature/merged' } },
          { number: 5, base: { ref: 'main' }, head: { ref: 'feature/merged' } },
        ]);
      }
      if (url.pathname.endsWith('/pulls')) return jsonResponse([]);
      throw new Error('unexpected request');
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 50);
  assert.equal(commitRequests, 1);
  assert.deepEqual(report.sourceRef.ci.pullRequestNumbers, [5]);
  assert.equal(report.calculationVersion, 'delivery-v2');
});

test('excludes commit pull requests that do not target main without a branch fallback', async () => {
  const requests = [];
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      requests.push(new URL(url));
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [{ ...mergedMainWorkflowRun, head_sha: 'sprint-sha' }],
        });
      }
      if (url.pathname.endsWith('/commits/sprint-sha/pulls')) {
        return jsonResponse([
          { number: 9, base: { ref: 'sprint2' }, head: { ref: 'feature/merged' } },
        ]);
      }
      if (url.pathname.endsWith('/pulls')) return jsonResponse([]);
      throw new Error('unexpected request');
    },
  });

  assert.equal(report.diagnostics[0].status, 'NO_DATA');
  assert.deepEqual(report.diagnostics[0].excluded, { no_main_pull_request: 1 });
  assert.equal(
    requests.some((url) => url.pathname.endsWith('/pulls') && url.searchParams.has('head')),
    false,
  );
});

test('falls back to the branch when a commit has no pull requests', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 2,
          workflow_runs: [
            { ...mergedMainWorkflowRun, head_sha: 'orphan-sha', head_branch: 'feature/one' },
            {
              ...mergedMainWorkflowRun,
              id: 11,
              head_sha: 'missing-sha',
              head_branch: 'feature/two',
            },
          ],
        });
      }
      if (url.pathname.includes('/commits/')) return jsonResponse([]);
      if (
        url.pathname.endsWith('/pulls') &&
        url.searchParams.get('head') === 'PitStop-Austral:feature/one'
      ) {
        return jsonResponse([{ number: 8, base: { ref: 'main' }, head: { ref: 'feature/one' } }]);
      }
      if (url.pathname.endsWith('/pulls')) return jsonResponse([]);
      throw new Error('unexpected request');
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 100);
  assert.deepEqual(report.diagnostics[0].excluded, { no_main_pull_request: 1 });
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

test('includes runs created at window start and excludes runs created at window end', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 2,
          workflow_runs: [
            {
              id: 10,
              created_at: window.windowStart,
              pull_requests: [{ number: 8 }],
              run_attempt: 1,
              status: 'completed',
              conclusion: 'success',
              updated_at: '2026-09-22T04:00:00.000Z',
            },
            {
              id: 11,
              created_at: window.windowEnd,
              pull_requests: [{ number: 9 }],
              run_attempt: 1,
              status: 'completed',
              conclusion: 'failure',
              updated_at: '2026-10-21T20:00:00.000Z',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/pulls/8')) return jsonResponse({ base: { ref: 'main' } });
      return jsonResponse([]);
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 100);
  assert.deepEqual(report.sourceRef.ci.runIds, [10]);
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
                total_count: 1,
                workflow_runs: [
                  {
                    id: 10,
                    created_at: '2026-10-20T10:00:00.000Z',
                    pull_requests: [{ number: 8 }],
                    run_attempt: 1,
                    status: 'completed',
                    conclusion: 'success',
                    updated_at: '2026-10-20T10:00:00.000Z',
                  },
                ],
              },
        );
      }
      if (url.pathname.endsWith('/pulls/8')) return jsonResponse({ base: { ref: 'main' } });
      return jsonResponse([]);
    },
  });

  assert.equal(actionRequests, 3);
  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 100);
  assert.deepEqual(report.sourceRef.ci.runIds, [10]);
});

test('deduplicates reruns returned on multiple Actions pages', async () => {
  let pullRequestRequests = 0;
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
                    id: 10,
                    created_at: '2026-10-20T10:00:00.000Z',
                    pull_requests: [{ number: 8 }],
                    run_attempt: 1,
                    status: 'completed',
                    conclusion: 'success',
                    updated_at: '2026-10-20T10:00:00.000Z',
                  },
                ],
        });
      }
      if (url.pathname.endsWith('/pulls/8')) {
        pullRequestRequests += 1;
        return jsonResponse({ base: { ref: 'main' } });
      }
      return jsonResponse([]);
    },
  });

  assert.equal(report.measurements.find(({ kpi_id }) => kpi_id === 'ci_success_rate').value, 100);
  assert.equal(pullRequestRequests, 1);
});

test('marks an unavailable first rerun attempt as incomplete evidence', async () => {
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
    code: 'EVIDENCE_INCOMPLETE',
  });
});

test('marks a first rerun response without conclusion or completion time as incomplete evidence', async () => {
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
      if (url.pathname.endsWith('/pulls/8')) return jsonResponse({ base: { ref: 'main' } });
      if (url.pathname.endsWith('/actions/runs/10/attempts/1')) return jsonResponse({});
      return jsonResponse([]);
    },
  });

  assert.equal(report.diagnostics[0].code, 'EVIDENCE_INCOMPLETE');
});

test('reports invalid commit responses and GitHub failures as errors', async () => {
  const report = await collectDeliveryKpis({
    date: '2026-10-21',
    env: 'dev',
    repository: 'PitStop-Austral/pitstop-app',
    token: 'secret-token',
    fetchImplementation: async (url) => {
      if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
        return jsonResponse({
          total_count: 1,
          workflow_runs: [mergedMainWorkflowRun],
        });
      }
      if (url.pathname.endsWith('/commits/merged-sha/pulls')) return jsonResponse({});
      return jsonResponse({ message: 'not returned to output' }, 503);
    },
  });

  assert.deepEqual(
    report.diagnostics.map(({ kpi_id, status, code }) => ({ kpi_id, status, code })),
    [
      { kpi_id: 'ci_success_rate', status: 'ERROR', code: 'GITHUB_INVALID_RESPONSE' },
      { kpi_id: 'mean_time_to_merge', status: 'ERROR', code: 'GITHUB_REQUEST_FAILED' },
    ],
  );
  assert.equal(JSON.stringify(report).includes('not returned to output'), false);
});

test('writes a CLI fragment and returns a nonzero code for source errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitstop-delivery-'));
  const outputPath = join(directory, 'delivery.json');

  try {
    const code = await executeDeliveryKpis({
      argv: ['--date', '2026-10-21', '--env', 'dev', '--output', outputPath],
      env: { GITHUB_REPOSITORY: 'PitStop-Austral/pitstop-app', GITHUB_TOKEN: 'secret-token' },
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
    const report = JSON.parse(await readFile(outputPath, 'utf8'));

    assert.equal(code, 1);
    assert.equal(report.calculationVersion, 'delivery-v2');
    assert.deepEqual(
      report.diagnostics.map(({ status, code }) => ({
        status,
        code,
      })),
      [
        { status: 'ERROR', code: 'GITHUB_TOKEN_REQUIRED' },
        { status: 'ERROR', code: 'GITHUB_TOKEN_REQUIRED' },
      ],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('writes ERROR diagnostics when neither repository option nor environment is configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitstop-delivery-'));
  const outputPath = join(directory, 'delivery.json');

  try {
    const code = await executeDeliveryKpis({
      argv: ['--date', '2026-10-21', '--env', 'dev', '--output', outputPath],
      env: { GITHUB_TOKEN: 'secret-token' },
    });

    assert.equal(code, 1);
    assert.deepEqual(
      JSON.parse(await readFile(outputPath, 'utf8')).diagnostics.map(({ code }) => code),
      ['GITHUB_REPOSITORY_REQUIRED', 'GITHUB_REPOSITORY_REQUIRED'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
