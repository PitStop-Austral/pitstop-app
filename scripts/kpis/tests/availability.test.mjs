import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  calculateAvailability,
  collectAvailabilityKpis,
  executeAvailabilityKpis,
  parseHealthReport,
  readZipEntry,
} from '../availability.mjs';
import { validateFragment } from '../contracts.mjs';
import { dayWindow } from '../dates.mjs';
import { jsonResponse, tempDir } from './helpers.mjs';

const CONTEXT = { date: '2026-10-21', env: 'prod' };
const WINDOW = dayWindow(CONTEXT.date);
const SLOT_MS = 30 * 60 * 1000;
const BASE = {
  ...CONTEXT,
  monitorEnv: 'prod',
  repository: 'PitStop-Austral/pitstop-app',
  token: 'test-token',
};

// Probe time `seconds` into slot `index` of the reported day.
const at = (index, seconds = 5) =>
  new Date(Date.parse(WINDOW.windowStart) + index * SLOT_MS + seconds * 1000).toISOString();

function check(target, checkedAt, ok = true, errorKind = ok ? null : 'http_error') {
  const httpStatus = ok ? 200 : errorKind === 'http_error' ? 503 : null;
  return { target, checkedAt, httpStatus, ok, errorKind };
}

function sample(checkedAt, { api = true, db = true, scheduled = true } = {}) {
  return { scheduled, checks: [check('api', checkedAt, api), check('db', checkedAt, db)] };
}

function report(runId, runAttempt, checkedAt, options) {
  const { checks } = sample(checkedAt, options);
  return { schemaVersion: 1, runId: String(runId), runAttempt, checks };
}

// Minimal stored (uncompressed) zip with one entry, like the ones GitHub serves.
function zip(content, name = 'health-checks.json') {
  const nameBytes = Buffer.from(name);
  const data = Buffer.from(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nameBytes.length, 12);
  end.writeUInt32LE(30 + nameBytes.length + data.length, 16);
  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}

// Serves monitor runs, their paginated artifacts, and artifact zips from an in-memory list.
// Each run: { id, event?, createdAt?, attempts: [{ attempt, body?, expired?, name? }] }; body is
// a report or a Buffer. Runs are created inside the reported day unless createdAt says otherwise.
function github(runs, { failPath } = {}) {
  const requests = [];
  const artifacts = new Map();
  const files = new Map();
  let nextArtifactId = 1;

  for (const run of runs) {
    artifacts.set(
      String(run.id),
      (run.attempts ?? []).map(({ attempt, body, expired = false, name }) => {
        const id = nextArtifactId++;
        if (body !== undefined) {
          files.set(String(id), Buffer.isBuffer(body) ? body : zip(JSON.stringify(body)));
        }
        return { id, name: name ?? `kpi-health-${run.id}-${attempt}`, expired };
      }),
    );
  }

  const fetchImplementation = async (url) => {
    const { pathname, searchParams } = new URL(url);
    requests.push(url.toString());
    if (failPath && pathname.includes(failPath)) return new Response('', { status: 500 });

    const page = Number(searchParams.get('page') ?? 1);
    const perPage = Number(searchParams.get('per_page') ?? 100);
    const slice = (items) => items.slice((page - 1) * perPage, page * perPage);
    let match;

    if (pathname.endsWith('/actions/workflows/kpi-health-monitor.yml/runs')) {
      const workflowRuns = runs.map(({ id, event = 'schedule', createdAt = at(0, 0) }) => ({
        id,
        event,
        created_at: createdAt,
      }));
      return jsonResponse({ total_count: workflowRuns.length, workflow_runs: slice(workflowRuns) });
    }
    if ((match = /\/actions\/runs\/(\d+)\/artifacts$/.exec(pathname))) {
      const items = artifacts.get(match[1]) ?? [];
      return jsonResponse({ total_count: items.length, artifacts: slice(items) });
    }
    if ((match = /\/actions\/artifacts\/(\d+)\/zip$/.exec(pathname))) {
      const file = files.get(match[1]);
      return file ? new Response(file) : new Response('', { status: 410 });
    }
    throw new Error(`unexpected request ${pathname}`);
  };
  fetchImplementation.requests = requests;
  return fetchImplementation;
}

const probeRun = (id, checkedAt, options = {}) => ({
  id,
  event: options.event,
  createdAt: options.createdAt,
  attempts: [{ attempt: 1, body: report(id, 1, checkedAt, options) }],
});

const diagnosticOf = (fragment, kpiId) =>
  fragment.diagnostics.find((diagnostic) => diagnostic.kpi_id === kpiId);

test('reads the real monitor artifact zip', async () => {
  const bytes = await readFile(new URL('./fixtures/kpi-health-39146296060-1.zip', import.meta.url));
  const checks = parseHealthReport(
    JSON.parse(readZipEntry(bytes, 'health-checks.json').toString('utf8')),
    { runId: 39146296060, runAttempt: 1 },
  );

  assert.deepEqual(
    checks.map(({ target, ok }) => [target, ok]),
    [
      ['api', true],
      ['db', true],
    ],
  );
  assert.throws(() => readZipEntry(Buffer.from('not a zip'), 'health-checks.json'), {
    code: 'INVALID_ARTIFACT',
  });
  assert.throws(() => readZipEntry(zip('{}', 'other.json'), 'health-checks.json'), {
    code: 'INVALID_ARTIFACT',
  });
});

test('rejects reports that do not match their artifact or the monitor contract', () => {
  const valid = report(7, 2, at(0));
  const ref = { runId: 7, runAttempt: 2 };
  assert.equal(parseHealthReport(valid, ref).length, 2);

  for (const invalid of [
    { ...valid, schemaVersion: 2 },
    { ...valid, runId: '8' },
    { ...valid, runAttempt: 1 },
    { ...valid, checks: [valid.checks[0]] },
    { ...valid, checks: [valid.checks[0], valid.checks[0]] },
    { ...valid, checks: [{ ...valid.checks[0], target: 'web' }, valid.checks[1]] },
    { ...valid, checks: [{ ...valid.checks[0], checkedAt: 'yesterday' }, valid.checks[1]] },
    { ...valid, checks: [{ ...valid.checks[0], httpStatus: 503 }, valid.checks[1]] },
    { ...valid, checks: [{ ...valid.checks[0], ok: 'true' }, valid.checks[1]] },
    { ...valid, checks: [{ ...check('api', at(0), false), errorKind: 'boom' }, valid.checks[1]] },
    null,
  ]) {
    assert.throws(() => parseHealthReport(invalid, ref), { code: 'INVALID_ARTIFACT' });
  }
});

test('computes the share of scheduled slots that succeeded', () => {
  const full = Array.from({ length: 48 }, (_, slot) => sample(at(slot), { api: slot >= 12 }));
  const result = calculateAvailability(full, WINDOW);
  assert.equal(result.api.value, 75);
  assert.deepEqual([result.api.numerator, result.api.denominator], [36, 48]);
  assert.equal(result.db.value, 100);
  assert.equal(result.api.coverage.observedSlots, 48);
  assert.deepEqual(result.api.coverage.missingSlots, []);

  const half = Array.from({ length: 24 }, (_, index) => sample(at(index * 2), { db: index >= 6 }));
  const partial = calculateAvailability(half, WINDOW).db;
  assert.equal(partial.value, 75);
  assert.deepEqual(partial.coverage, {
    expectedSlots: 48,
    observedSlots: 24,
    missingSlots: Array.from({ length: 24 }, (_, index) =>
      new Date(Date.parse(WINDOW.windowStart) + (index * 2 + 1) * SLOT_MS).toISOString(),
    ),
  });
});

test('treats failures and timeouts as measured downtime, and no samples as NO_DATA', () => {
  const down = calculateAvailability(
    [
      sample(at(0), { api: false, db: false }),
      {
        scheduled: true,
        checks: [check('api', at(1), false, 'timeout'), check('db', at(1), false, 'timeout')],
      },
    ],
    WINDOW,
  );
  assert.equal(down.api.status, 'READY');
  assert.equal(down.api.value, 0);
  assert.equal(down.db.value, 0);

  const empty = calculateAvailability([], WINDOW);
  assert.equal(empty.api.status, 'NO_DATA');
  assert.equal(empty.api.value, null);
  assert.equal(empty.api.coverage.missingSlots.length, 48);
});

test('places both checks of a run by its earliest probe', () => {
  const beforeStart = new Date(Date.parse(WINDOW.windowStart) - 1).toISOString();
  const result = calculateAvailability(
    [
      // api just before the day opens, db at its first instant: the whole run belongs to D-1.
      {
        scheduled: true,
        checks: [check('api', beforeStart, false), check('db', WINDOW.windowStart, false)],
      },
      // api at the end of slot 0, db at the start of slot 1: both land in slot 0.
      {
        scheduled: true,
        checks: [check('api', at(0, 30 * 60 - 0.1)), check('db', at(1, 0.5), false)],
      },
      // db probed first: its timestamp places the run.
      { scheduled: true, checks: [check('api', at(2, 40)), check('db', at(1, 30 * 60 - 1))] },
      sample(WINDOW.windowEnd, { api: false }),
      sample(at(47, 30 * 60 - 1)),
    ],
    WINDOW,
  );

  for (const target of ['api', 'db']) {
    // Slots 0, 1 and 47 observed; 2..46 missing.
    const { missingSlots } = result[target].coverage;
    assert.equal(missingSlots[0], at(2, 0), `${target} covers slots 0 and 1`);
    assert.equal(missingSlots.length, 45);
    assert.equal(result[target].denominator, 3);
  }
  assert.equal(result.api.numerator, 3);
  assert.equal(result.db.numerator, 2);
});

test('keeps one scheduled sample per slot and reports manual runs apart', () => {
  const result = calculateAvailability(
    [
      sample(at(0, 600), { api: true }),
      sample(at(0, 60), { api: false }),
      sample(at(1), { api: false, scheduled: false }),
      sample(at(2), { scheduled: false }),
    ],
    WINDOW,
  ).api;

  assert.deepEqual([result.numerator, result.denominator], [0, 1]);
  assert.deepEqual(result.manual, { numerator: 1, denominator: 2 });
  assert.equal(result.coverage.observedSlots, 1);
});

test('collects a valid fragment from the monitor artifacts', async () => {
  const fetchImplementation = github([
    probeRun(101, at(0)),
    probeRun(102, at(1), { api: false }),
    probeRun(103, at(2), { event: 'workflow_dispatch', db: false }),
    probeRun(104, at(-4), { createdAt: at(-4, 0) }),
  ]);
  const fragment = await collectAvailabilityKpis({ ...BASE, fetchImplementation });

  validateFragment(fragment, CONTEXT);
  assert.deepEqual(fragment.measurements, [
    { kpi_id: 'api_availability', value: 50 },
    { kpi_id: 'db_availability', value: 100 },
  ]);
  assert.deepEqual(fragment.sourceRef, {
    repository: BASE.repository,
    workflow: 'kpi-health-monitor.yml',
    monitorEnv: 'prod',
    runIds: ['101', '102', '103'],
  });
  const db = diagnosticOf(fragment, 'db_availability');
  assert.equal(db.status, 'READY');
  assert.deepEqual(db.manual, { numerator: 0, denominator: 1 });
  assert.equal(db.coverage.observedSlots, 2);

  const runsUrl = new URL(fetchImplementation.requests[0]);
  assert.equal(
    runsUrl.searchParams.get('created'),
    '2026-10-21T02:00:00.000Z..2026-10-22T02:59:59.999Z',
  );
  assert.equal(runsUrl.searchParams.get('status'), 'completed');
});

test('uses the first attempt with a valid artifact and counts unusable evidence', async () => {
  const fragment = await collectAvailabilityKpis({
    ...BASE,
    fetchImplementation: github([
      // Both attempts uploaded: attempt 1 wins even though the rerun succeeded.
      {
        id: 201,
        attempts: [
          { attempt: 2, body: report(201, 2, at(0, 300)) },
          { attempt: 1, body: report(201, 1, at(0), { api: false }) },
        ],
      },
      // Attempt 1 left no artifact: the rerun is the run's only sample, but a person started it,
      // so it is manual and fills no slot.
      { id: 202, attempts: [{ attempt: 2, body: report(202, 2, at(1)) }] },
      // Attempt 1 is invalid, attempt 2 is valid: also manual.
      {
        id: 203,
        attempts: [
          { attempt: 1, body: Buffer.from('broken') },
          { attempt: 2, body: report(203, 2, at(2)) },
        ],
      },
      { id: 204, attempts: [{ attempt: 1, body: report(999, 1, at(3)) }] },
      { id: 205, attempts: [{ attempt: 1, body: zip('{not json') }] },
      { id: 206, attempts: [{ attempt: 1, body: report(206, 1, at(4)), expired: true }] },
      { id: 207, attempts: [{ attempt: 1 }] },
      { id: 208 },
      { id: 209, attempts: [{ attempt: 1, name: 'something-else' }] },
      // Created in the lookback hour (D-1): their unusable evidence is not counted for D.
      { id: 210, createdAt: at(-1), attempts: [{ attempt: 1, body: zip('{not json') }] },
      { id: 211, createdAt: at(-1), attempts: [{ attempt: 1 }] },
      { id: 212, createdAt: at(-1) },
    ]),
  });

  validateFragment(fragment, CONTEXT);
  const api = diagnosticOf(fragment, 'api_availability');
  assert.deepEqual([api.numerator, api.denominator], [0, 1]);
  assert.deepEqual(api.manual, { numerator: 2, denominator: 2 });
  assert.equal(api.coverage.observedSlots, 1);
  assert.equal(api.invalidArtifacts, 3);
  assert.equal(api.expiredArtifacts, 2);
  assert.equal(api.runsWithoutArtifact, 2);
  assert.deepEqual(fragment.sourceRef.runIds, ['201', '202', '203']);
});

test('reads every page of runs and artifacts', async () => {
  const runs = Array.from({ length: 120 }, (_, index) => probeRun(1000 + index, at(index % 48)));
  runs[0].attempts = Array.from({ length: 105 }, (_, index) => ({
    attempt: 105 - index,
    body: report(1000, 105 - index, at(0)),
  }));
  const fetchImplementation = github(runs);
  const fragment = await collectAvailabilityKpis({ ...BASE, fetchImplementation });

  const api = diagnosticOf(fragment, 'api_availability');
  assert.equal(api.coverage.observedSlots, 48);
  assert.equal(fragment.sourceRef.runIds.length, 120);
  assert.ok(
    fetchImplementation.requests.some((url) => url.includes('runs?') && url.includes('page=2')),
  );
  assert.ok(
    fetchImplementation.requests.some(
      (url) => url.includes('/runs/1000/artifacts') && url.includes('page=2'),
    ),
  );
});

test('reports GitHub read failures as ERROR, distinct from NO_DATA', async () => {
  const empty = await collectAvailabilityKpis({ ...BASE, fetchImplementation: github([]) });
  assert.deepEqual(
    empty.diagnostics.map(({ status }) => status),
    ['NO_DATA', 'NO_DATA'],
  );

  for (const failPath of ['/runs', '/artifacts', '/zip']) {
    const fragment = await collectAvailabilityKpis({
      ...BASE,
      fetchImplementation: github([probeRun(301, at(0))], { failPath }),
    });
    validateFragment(fragment, CONTEXT);
    assert.deepEqual(fragment.measurements, []);
    assert.deepEqual(
      fragment.diagnostics.map(({ status, code }) => [status, code]),
      [
        ['ERROR', 'GITHUB_REQUEST_FAILED'],
        ['ERROR', 'GITHUB_REQUEST_FAILED'],
      ],
    );
  }

  const transport = await collectAvailabilityKpis({
    ...BASE,
    fetchImplementation: async () => {
      throw new Error('socket hang up');
    },
  });
  assert.equal(transport.diagnostics[0].code, 'GITHUB_REQUEST_FAILED');

  // A bug (here a TypeError on a null run) is not disguised as a GitHub failure.
  const bug = await collectAvailabilityKpis({
    ...BASE,
    fetchImplementation: async () => jsonResponse({ total_count: 1, workflow_runs: [null] }),
  });
  validateFragment(bug, CONTEXT);
  assert.deepEqual(
    bug.diagnostics.map(({ status, code }) => [status, code]),
    [
      ['ERROR', 'UNEXPECTED_ERROR'],
      ['ERROR', 'UNEXPECTED_ERROR'],
    ],
  );
});

test('refuses unmonitored environments and missing configuration without calling GitHub', async () => {
  for (const [overrides, code] of [
    [{ env: 'dev', date: CONTEXT.date }, 'ENV_NOT_MONITORED'],
    [{ monitorEnv: null }, 'HEALTH_MONITOR_ENV_REQUIRED'],
    [{ monitorEnv: 'staging' }, 'HEALTH_MONITOR_ENV_REQUIRED'],
    [{ repository: null }, 'GITHUB_REPOSITORY_REQUIRED'],
    [{ repository: 'not a repo' }, 'INVALID_REPOSITORY'],
    [{ token: null }, 'GITHUB_TOKEN_REQUIRED'],
  ]) {
    const fetchImplementation = github([probeRun(401, at(0))]);
    const fragment = await collectAvailabilityKpis({ ...BASE, ...overrides, fetchImplementation });

    validateFragment(fragment, { date: CONTEXT.date, env: overrides.env ?? CONTEXT.env });
    assert.deepEqual(
      fragment.diagnostics.map(({ status, code: value }) => [status, value]),
      [
        ['ERROR', code],
        ['ERROR', code],
      ],
    );
    assert.equal(fetchImplementation.requests.length, 0);
  }
});

test('the CLI writes the fragment and exits non-zero only on ERROR', async () => {
  const dir = await tempDir();
  const output = join(dir, 'availability.json');
  const argv = ['--date', CONTEXT.date, '--env', 'prod', '--output', output];
  const env = {
    GITHUB_REPOSITORY: BASE.repository,
    GITHUB_TOKEN: 'test-token',
    KPI_HEALTH_MONITOR_ENV: 'prod',
  };
  const now = new Date('2026-10-22T04:00:00.000Z');

  assert.equal(
    await executeAvailabilityKpis({
      argv,
      env,
      now,
      fetchImplementation: github([probeRun(1, at(0))]),
    }),
    0,
  );
  const written = JSON.parse(await readFile(output, 'utf8'));
  validateFragment(written, CONTEXT);
  assert.equal(JSON.stringify(written).includes('test-token'), false);

  assert.equal(
    await executeAvailabilityKpis({
      argv,
      env: { ...env, KPI_HEALTH_MONITOR_ENV: 'dev' },
      now,
      fetchImplementation: github([]),
    }),
    1,
  );
  await assert.rejects(
    executeAvailabilityKpis({ argv: ['--date', CONTEXT.date, '--env', 'prod'], env, now }),
    { code: 'MISSING_OUTPUT' },
  );
});

test('the CLI refuses a day that has not closed and writes no fragment', async () => {
  const output = join(await tempDir(), 'availability.json');
  const fetchImplementation = github([probeRun(1, at(0))]);

  // `now` is afternoon of the same Argentine day as --date, and its last instant.
  for (const now of ['2026-10-21T18:00:00.000Z', '2026-10-22T02:59:59.999Z']) {
    await assert.rejects(
      executeAvailabilityKpis({
        argv: ['--date', CONTEXT.date, '--env', 'prod', '--output', output],
        env: {
          GITHUB_REPOSITORY: BASE.repository,
          GITHUB_TOKEN: 'test-token',
          KPI_HEALTH_MONITOR_ENV: 'prod',
        },
        now: new Date(now),
        fetchImplementation,
      }),
      { code: 'DAY_NOT_CLOSED' },
    );
  }

  await assert.rejects(readFile(output), { code: 'ENOENT' });
  assert.equal(fetchImplementation.requests.length, 0);
});
