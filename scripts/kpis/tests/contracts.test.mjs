import assert from 'node:assert/strict';
import test from 'node:test';

import { KPIS, SOURCES, validateFragment, validatePayloadRows } from '../contracts.mjs';
import { CONTEXT, PUBLICATION_ID, fixture } from './helpers.mjs';

const row = (overrides = {}) => ({
  kpi_id: 'preventive_rate',
  date: CONTEXT.date,
  env: CONTEXT.env,
  value: 60,
  run_id: PUBLICATION_ID,
  ...overrides,
});

test('every KPI id belongs to exactly one known source', () => {
  assert.deepEqual(
    SOURCES.map((source) => Object.keys(KPIS).filter((id) => KPIS[id].source === source).length),
    [6, 2, 2],
  );
});

for (const source of SOURCES) {
  test(`the ${source} fixture satisfies the shared contract`, async () => {
    const fragment = await fixture(`${source}.json`);
    assert.equal(validateFragment(fragment, CONTEXT), fragment);
  });
}

test('rejects fragments for another date, env, or schema version', async () => {
  const fragment = await fixture('availability.json');

  assert.throws(() => validateFragment(fragment, { ...CONTEXT, env: 'prod' }), {
    code: 'ENV_MISMATCH',
  });
  assert.throws(() => validateFragment(fragment, { ...CONTEXT, date: '2026-10-20' }), {
    code: 'DATE_MISMATCH',
  });
  assert.throws(() => validateFragment({ ...fragment, schemaVersion: 2 }, CONTEXT), {
    code: 'UNSUPPORTED_SCHEMA_VERSION',
  });
});

test('rejects duplicate, foreign, non-finite, null, and out-of-range measurements', async () => {
  const fragment = await fixture('availability.json');
  const withMeasurements = (measurements) => ({ ...fragment, measurements });

  const cases = [
    [[...fragment.measurements, fragment.measurements[0]], 'DUPLICATE_KPI'],
    [[{ kpi_id: 'preventive_rate', value: 60 }], 'FOREIGN_KPI'],
    [
      [{ kpi_id: 'api_availability', value: Number.NaN }, fragment.measurements[1]],
      'VALUE_NOT_FINITE',
    ],
    [[{ kpi_id: 'api_availability', value: null }, fragment.measurements[1]], 'VALUE_NOT_FINITE'],
    [
      [{ kpi_id: 'api_availability', value: 100.5 }, fragment.measurements[1]],
      'VALUE_OUT_OF_RANGE',
    ],
    [
      [{ kpi_id: 'api_availability', value: 75, extra: 1 }, fragment.measurements[1]],
      'MEASUREMENT_SHAPE_INVALID',
    ],
  ];

  for (const [measurements, code] of cases) {
    assert.throws(() => validateFragment(withMeasurements(measurements), CONTEXT), { code });
  }
});

test('keeps measurements and diagnostics consistent', async () => {
  const fragment = await fixture('availability.json');
  const [first, second] = fragment.diagnostics;

  assert.throws(
    () =>
      validateFragment(
        { ...fragment, diagnostics: [{ ...first, status: 'NO_DATA' }, second] },
        CONTEXT,
      ),
    { code: 'MEASUREMENT_NOT_READY' },
  );
  assert.throws(
    () => validateFragment({ ...fragment, measurements: [fragment.measurements[1]] }, CONTEXT),
    {
      code: 'READY_WITHOUT_MEASUREMENT',
    },
  );
  assert.throws(
    () =>
      validateFragment(
        { ...fragment, diagnostics: [{ ...first, numerator: '-1' }, second] },
        CONTEXT,
      ),
    { code: 'INVALID_COUNT' },
  );
});

test('accepts a failed-source fragment but not one that also carries measurements', async () => {
  const fragment = await fixture('availability.json');
  const failed = {
    ...fragment,
    measurements: [],
    diagnostics: [],
    error: { code: 'PROBES_UNAVAILABLE' },
  };

  assert.equal(validateFragment(failed, CONTEXT), failed);
  assert.throws(
    () => validateFragment({ ...failed, measurements: fragment.measurements }, CONTEXT),
    {
      code: 'ERROR_WITH_MEASUREMENTS',
    },
  );
  assert.throws(() => validateFragment({ ...failed, error: { code: 'raw message' } }, CONTEXT), {
    code: 'INVALID_ERROR_CODE',
  });
});

test('validates the exact receiver payload rows', () => {
  assert.doesNotThrow(() =>
    validatePayloadRows([row(), row({ kpi_id: 'mean_time_to_merge', value: 5.25 })], CONTEXT),
  );

  const cases = [
    [[], 'INVALID_ROW_COUNT'],
    [
      Object.keys(KPIS)
        .concat('preventive_rate')
        .map((kpi_id) => row({ kpi_id })),
      'INVALID_ROW_COUNT',
    ],
    [[{ ...row(), project_id: 'x' }], 'ROW_SHAPE_INVALID'],
    [[row({ value: null })], 'VALUE_NOT_FINITE'],
    [[row({ env: 'prod' })], 'ENV_MISMATCH'],
    [
      [row(), row({ kpi_id: 'api_error_rate', run_id: '00000000-0000-4000-8000-000000000000' })],
      'MIXED_RUN_ID',
    ],
    [[row(), row()], 'DUPLICATE_KPI'],
    [[row({ kpi_id: 'service_users_30d', value: 2.5 })], 'VALUE_NOT_INTEGER'],
    [[row({ kpi_id: 'api_latency_p95', value: -1 })], 'VALUE_OUT_OF_RANGE'],
    [[row({ kpi_id: 'unknown_kpi' })], 'UNKNOWN_KPI'],
  ];

  for (const [rows, code] of cases) {
    assert.throws(() => validatePayloadRows(rows, CONTEXT), { code });
  }
});

test('accepts the closed-day window and longer windows that end with it', async () => {
  const api = await fixture('api.json');
  const thirtyDay = api.diagnostics.find(({ kpi_id }) => kpi_id === 'service_users_30d');
  const oneDay = api.diagnostics.find(({ kpi_id }) => kpi_id === 'api_error_rate');

  assert.deepEqual(
    [oneDay.windowStart, oneDay.windowEnd],
    ['2026-10-21T03:00:00.000Z', '2026-10-22T03:00:00.000Z'],
  );
  assert.deepEqual(
    [thirtyDay.windowStart, thirtyDay.windowEnd],
    ['2026-09-22T03:00:00.000Z', '2026-10-22T03:00:00.000Z'],
  );
  assert.equal(validateFragment(api, CONTEXT), api);
});

test('rejects windows that do not end with the closed day or start after it', async () => {
  const fragment = await fixture('availability.json');
  const [first, second] = fragment.diagnostics;
  const withWindow = (window) => ({ ...fragment, diagnostics: [{ ...first, ...window }, second] });

  const cases = [
    // Ends at the previous or next Argentine midnight.
    [{ windowEnd: '2026-10-21T03:00:00.000Z' }, 'WINDOW_END_MISMATCH'],
    [{ windowEnd: '2026-10-23T03:00:00.000Z' }, 'WINDOW_END_MISMATCH'],
    // UTC midnight instead of the Argentine cut.
    [
      { windowStart: '2026-10-21T00:00:00.000Z', windowEnd: '2026-10-22T00:00:00.000Z' },
      'WINDOW_END_MISMATCH',
    ],
    // A 30-day window shifted one day late.
    [
      { windowStart: '2026-09-23T03:00:00.000Z', windowEnd: '2026-10-23T03:00:00.000Z' },
      'WINDOW_END_MISMATCH',
    ],
    // Covers only part of the reported day.
    [{ windowStart: '2026-10-21T04:00:00.000Z' }, 'WINDOW_START_AFTER_DAY'],
    [{ windowStart: '2026-10-22T03:00:00.000Z' }, 'WINDOW_START_AFTER_DAY'],
    [{ windowStart: 'yesterday' }, 'INVALID_WINDOW'],
    [{ windowEnd: undefined }, 'INVALID_WINDOW'],
  ];

  for (const [window, code] of cases) {
    assert.throws(
      () => validateFragment(withWindow(window), CONTEXT),
      { code },
      JSON.stringify(window),
    );
  }
});
