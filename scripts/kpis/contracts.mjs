import { createHash } from 'node:crypto';

import { dayWindow } from './dates.mjs';
import { ContractError } from './io.mjs';

export { ContractError };

export const SCHEMA_VERSION = 1;
export const ENVS = ['dev', 'prod'];
export const SOURCES = ['api', 'availability', 'delivery'];
export const STATUSES = ['READY', 'NO_DATA', 'ERROR'];
export const MAX_BATCH_ROWS = 10;

const PERCENT = { unit: '%', min: 0, max: 100 };
const COUNT = { unit: 'count', min: 0, integer: true };
const MILLISECONDS = { unit: 'ms', min: 0 };
const HOURS = { unit: 'h', min: 0 };

// The only KPI ids a source may report. Availability and delivery are integration points owned
// by PIT-72 and PIT-74; their collectors are not part of this module.
export const KPIS = {
  preventive_rate: { source: 'api', ...PERCENT },
  alert_resolution_rate: { source: 'api', ...PERCENT },
  service_users_30d: { source: 'api', ...COUNT },
  active_vehicles_30d: { source: 'api', ...COUNT },
  api_error_rate: { source: 'api', ...PERCENT },
  api_latency_p95: { source: 'api', ...MILLISECONDS },
  api_availability: { source: 'availability', ...PERCENT },
  db_availability: { source: 'availability', ...PERCENT },
  ci_success_rate: { source: 'delivery', ...PERCENT },
  mean_time_to_merge: { source: 'delivery', ...HOURS },
};

const SAFE_CODE = /^[A-Z0-9_]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COUNT_STRING = /^\d+$/;
const ROW_KEYS = ['date', 'env', 'kpi_id', 'run_id', 'value'];

function fail(code) {
  throw new ContractError(code);
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

export function isSafeCode(value) {
  return typeof value === 'string' && SAFE_CODE.test(value);
}

export function validateValue(kpiId, value) {
  const kpi = KPIS[kpiId] ?? fail('UNKNOWN_KPI');

  if (typeof value !== 'number' || !Number.isFinite(value)) fail('VALUE_NOT_FINITE');
  if (value < kpi.min || (kpi.max !== undefined && value > kpi.max)) fail('VALUE_OUT_OF_RANGE');
  if (kpi.integer && !Number.isInteger(value)) fail('VALUE_NOT_INTEGER');
}

// Every window ends exactly when the reported day closes. It may start earlier than that day
// (30-day KPIs such as service_users_30d), but never later.
function validateWindow(diagnostic, day) {
  const start = Date.parse(diagnostic.windowStart);
  const end = Date.parse(diagnostic.windowEnd);

  if (
    typeof diagnostic.windowStart !== 'string' ||
    typeof diagnostic.windowEnd !== 'string' ||
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    fail('INVALID_WINDOW');
  }
  if (end !== Date.parse(day.windowEnd)) fail('WINDOW_END_MISMATCH');
  if (start > Date.parse(day.windowStart)) fail('WINDOW_START_AFTER_DAY');
}

function validateCount(value) {
  if (value === undefined || value === null) return;
  if (
    typeof value === 'string'
      ? !COUNT_STRING.test(value)
      : !Number.isSafeInteger(value) || value < 0
  ) {
    fail('INVALID_COUNT');
  }
}

function assertOwnedUnique(kpiId, source, seen) {
  if (KPIS[kpiId]?.source !== source) fail('FOREIGN_KPI');
  if (seen.has(kpiId)) fail('DUPLICATE_KPI');
  seen.add(kpiId);
}

// Validates a source fragment against the shared contract and the resolved run context.
// A fragment carrying `error` is a well-formed report of a failed source, not a contract violation.
export function validateFragment(fragment, { date, env }) {
  if (!isObject(fragment)) fail('FRAGMENT_NOT_OBJECT');
  if (fragment.schemaVersion !== SCHEMA_VERSION) fail('UNSUPPORTED_SCHEMA_VERSION');
  if (!SOURCES.includes(fragment.source)) fail('UNKNOWN_SOURCE');
  if (fragment.date !== date) fail('DATE_MISMATCH');
  if (fragment.env !== env) fail('ENV_MISMATCH');
  if (!Array.isArray(fragment.measurements) || !Array.isArray(fragment.diagnostics)) {
    fail('FRAGMENT_SHAPE_INVALID');
  }
  if (
    fragment.calculationVersion !== undefined &&
    typeof fragment.calculationVersion !== 'string'
  ) {
    fail('INVALID_CALCULATION_VERSION');
  }
  if (fragment.sourceRef !== undefined && !isObject(fragment.sourceRef)) fail('INVALID_SOURCE_REF');

  // A collector that received contract-breaking data marks its fragment invalid: the batch stops.
  if (fragment.invalid !== undefined) {
    fail(isSafeCode(fragment.invalid?.code) ? fragment.invalid.code : 'SOURCE_CONTRACT_INVALID');
  }

  if (fragment.error !== undefined) {
    if (!isObject(fragment.error) || !isSafeCode(fragment.error.code)) fail('INVALID_ERROR_CODE');
    if (fragment.measurements.length > 0) fail('ERROR_WITH_MEASUREMENTS');
    return fragment;
  }

  const day = dayWindow(date);
  const statuses = new Map();
  const seenDiagnostics = new Set();

  for (const diagnostic of fragment.diagnostics) {
    if (!isObject(diagnostic)) fail('DIAGNOSTIC_NOT_OBJECT');
    assertOwnedUnique(diagnostic.kpi_id, fragment.source, seenDiagnostics);
    if (!STATUSES.includes(diagnostic.status)) fail('INVALID_STATUS');
    if (diagnostic.code !== undefined && !isSafeCode(diagnostic.code))
      fail('INVALID_DIAGNOSTIC_CODE');
    validateWindow(diagnostic, day);
    validateCount(diagnostic.numerator);
    validateCount(diagnostic.denominator);
    validateCount(diagnostic.sampleCount);
    statuses.set(diagnostic.kpi_id, diagnostic.status);
  }

  const seenMeasurements = new Set();

  for (const measurement of fragment.measurements) {
    if (!isObject(measurement) || Object.keys(measurement).sort().join() !== 'kpi_id,value') {
      fail('MEASUREMENT_SHAPE_INVALID');
    }
    assertOwnedUnique(measurement.kpi_id, fragment.source, seenMeasurements);
    if (statuses.get(measurement.kpi_id) !== 'READY') fail('MEASUREMENT_NOT_READY');
    validateValue(measurement.kpi_id, measurement.value);
  }

  for (const [kpiId, status] of statuses) {
    if (status === 'READY' && !seenMeasurements.has(kpiId)) fail('READY_WITHOUT_MEASUREMENT');
  }

  return fragment;
}

// Validates the exact receiver payload: 1–10 rows, five fields each, one shared publication UUID.
export function validatePayloadRows(rows, { date, env }) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_BATCH_ROWS) {
    fail('INVALID_ROW_COUNT');
  }

  const seen = new Set();

  for (const row of rows) {
    if (!isObject(row) || Object.keys(row).sort().join() !== ROW_KEYS.join())
      fail('ROW_SHAPE_INVALID');
    if (row.date !== date) fail('DATE_MISMATCH');
    if (row.env !== env) fail('ENV_MISMATCH');
    if (typeof row.run_id !== 'string' || !UUID.test(row.run_id)) fail('INVALID_RUN_ID');
    if (row.run_id !== rows[0].run_id) fail('MIXED_RUN_ID');
    if (seen.has(row.kpi_id)) fail('DUPLICATE_KPI');
    seen.add(row.kpi_id);
    validateValue(row.kpi_id, row.value);
  }

  return rows;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
