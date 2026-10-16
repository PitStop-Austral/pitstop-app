import assert from 'node:assert/strict';
import test from 'node:test';

import { requireSecret, resolveContext, validateBaseUrl } from '../config.mjs';

const now = new Date('2026-10-22T04:00:00.000Z');
const recoverInputs = {
  environment: 'dev',
  mode: 'recover',
  date: '2026-10-21',
  source_run_id: '123456789',
  artifact_name: 'kpi-batch-dev-2026-10-21-123456789-1',
};

test('a schedule resolves env from KPI_SCHEDULE_ENV and collects the previous Argentine day', () => {
  assert.deepEqual(resolveContext({ eventName: 'schedule', scheduleEnv: 'prod', now }), {
    env: 'prod',
    mode: 'collect',
    date: '2026-10-21',
  });
});

test('a schedule falls back to dev when KPI_SCHEDULE_ENV is missing or blank', () => {
  for (const scheduleEnv of [undefined, '', '  ']) {
    assert.equal(resolveContext({ eventName: 'schedule', scheduleEnv, now }).env, 'dev');
  }
});

test('a schedule ignores manual inputs', () => {
  const context = resolveContext({
    eventName: 'schedule',
    inputs: { environment: 'prod', mode: 'recover', date: '2026-10-01' },
    scheduleEnv: 'dev',
    now,
  });

  assert.deepEqual(context, { env: 'dev', mode: 'collect', date: '2026-10-21' });
});

test('a manual input takes precedence over KPI_SCHEDULE_ENV', () => {
  const context = resolveContext({
    eventName: 'workflow_dispatch',
    inputs: { environment: 'prod' },
    scheduleEnv: 'dev',
    now,
  });

  assert.equal(context.env, 'prod');
});

test('rejects env values other than dev and prod from either source', () => {
  for (const environment of ['staging', 'DEV', 'production']) {
    assert.throws(
      () => resolveContext({ eventName: 'workflow_dispatch', inputs: { environment }, now }),
      {
        code: 'INVALID_ENV',
      },
    );
  }

  assert.throws(() => resolveContext({ eventName: 'schedule', scheduleEnv: 'staging', now }), {
    code: 'INVALID_ENV',
  });
});

test('collect uses an explicit closed date and rejects an open one', () => {
  const inputs = { environment: 'dev', mode: 'collect' };

  assert.equal(
    resolveContext({
      eventName: 'workflow_dispatch',
      inputs: { ...inputs, date: '2026-10-15' },
      now,
    }).date,
    '2026-10-15',
  );
  assert.throws(
    () =>
      resolveContext({
        eventName: 'workflow_dispatch',
        inputs: { ...inputs, date: '2026-10-22' },
        now,
      }),
    { code: 'DAY_NOT_CLOSED' },
  );
  assert.throws(
    () => resolveContext({ eventName: 'workflow_dispatch', inputs: { mode: 'replay' }, now }),
    {
      code: 'INVALID_MODE',
    },
  );
});

test('recover returns the explicitly selected batch', () => {
  assert.deepEqual(resolveContext({ eventName: 'workflow_dispatch', inputs: recoverInputs, now }), {
    env: 'dev',
    mode: 'recover',
    date: '2026-10-21',
    sourceRunId: '123456789',
    artifactName: 'kpi-batch-dev-2026-10-21-123456789-1',
  });
});

test('recover requires date, source_run_id, and artifact_name', () => {
  const cases = [
    ['date', 'RECOVER_DATE_REQUIRED'],
    ['source_run_id', 'RECOVER_SOURCE_RUN_REQUIRED'],
    ['artifact_name', 'RECOVER_ARTIFACT_REQUIRED'],
  ];

  for (const [field, code] of cases) {
    assert.throws(
      () =>
        resolveContext({
          eventName: 'workflow_dispatch',
          inputs: { ...recoverInputs, [field]: ' ' },
          now,
        }),
      { code },
    );
  }
});

test('recover rejects a malformed run id or an artifact from another env or date', () => {
  const resolveWith = (overrides) =>
    resolveContext({
      eventName: 'workflow_dispatch',
      inputs: { ...recoverInputs, ...overrides },
      now,
    });

  assert.throws(() => resolveWith({ source_run_id: '12a' }), { code: 'INVALID_SOURCE_RUN_ID' });
  assert.throws(() => resolveWith({ environment: 'prod' }), { code: 'ARTIFACT_CONTEXT_MISMATCH' });
  assert.throws(() => resolveWith({ date: '2026-10-20' }), { code: 'ARTIFACT_CONTEXT_MISMATCH' });
  assert.throws(() => resolveWith({ artifact_name: 'kpi-sources-dev-2026-10-21-123456789-1' }), {
    code: 'ARTIFACT_CONTEXT_MISMATCH',
  });
});

test('validates base URLs and required secrets without echoing them', () => {
  assert.equal(
    validateBaseUrl(' https://pitstop.example/ ', 'API_BASE_URL'),
    'https://pitstop.example',
  );
  assert.equal(validateBaseUrl('http://127.0.0.1:4000', 'API_BASE_URL'), 'http://127.0.0.1:4000');

  for (const value of [
    undefined,
    '',
    'not a url',
    'http://pitstop.example',
    'ftp://pitstop.example',
  ]) {
    assert.throws(() => validateBaseUrl(value, 'API_BASE_URL'), { code: 'INVALID_API_BASE_URL' });
  }

  assert.equal(requireSecret({ CRON_SECRET: ' s3cret ' }, 'CRON_SECRET'), 's3cret');
  assert.throws(() => requireSecret({ CRON_SECRET: ' ' }, 'CRON_SECRET'), {
    message: 'MISSING_CRON_SECRET',
  });
});
