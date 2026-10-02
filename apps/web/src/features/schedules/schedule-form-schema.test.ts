import assert from 'node:assert/strict';
import test from 'node:test';
import { toServiceFieldValue } from '../maintenances/service-catalog.ts';
import {
  getDisabledScheduleOptions,
  getInitialScheduleFormValues,
  getScheduleFormValues,
  parseScheduleForm,
} from './schedule-form-schema.ts';

test('supports months, kilometers and both', () => {
  const base = getInitialScheduleFormValues();
  assert.deepEqual(parseScheduleForm({ ...base, useMonths: true, months: '6' }, []), {
    success: true,
    data: { type: 'Cambio de aceite', intervalMonths: 6, intervalKm: null },
  });
  assert.deepEqual(parseScheduleForm({ ...base, useKm: true, km: '10000' }, []), {
    success: true,
    data: { type: 'Cambio de aceite', intervalMonths: null, intervalKm: 10000 },
  });
  assert.deepEqual(
    parseScheduleForm({ ...base, useMonths: true, months: '6', useKm: true, km: '10000' }, []),
    {
      success: true,
      data: { type: 'Cambio de aceite', intervalMonths: 6, intervalKm: 10000 },
    },
  );
});

test('rejects no interval and invalid selected intervals', () => {
  const base = getInitialScheduleFormValues();
  assert.deepEqual(parseScheduleForm(base, []).success, false);
  for (const invalid of ['0', '-1', '1.5', '', '2147483648']) {
    assert.deepEqual(parseScheduleForm({ ...base, useKm: true, km: invalid }, []).success, false);
  }
});

test('caps months at 240 but keeps the large km limit', () => {
  const base = getInitialScheduleFormValues();
  assert.deepEqual(
    parseScheduleForm({ ...base, useMonths: true, months: '240' }, []).success,
    true,
  );
  assert.deepEqual(parseScheduleForm({ ...base, useMonths: true, months: '241' }, []), {
    success: false,
    errors: { months: 'Ingresá hasta 240 meses' },
  });
  assert.deepEqual(parseScheduleForm({ ...base, useKm: true, km: '2147483647' }, []).success, true);
});

test('accepts custom services and rejects case-insensitive duplicates', () => {
  const base = { ...getInitialScheduleFormValues(), useKm: true, km: '10000' };
  const custom = { ...base, service: toServiceFieldValue('Revisión de dirección') };
  assert.deepEqual(parseScheduleForm(custom, []).success, true);
  assert.deepEqual(parseScheduleForm(custom, ['REVISIÓN DE DIRECCIÓN']).success, false);
});

test('starts on an available catalog service when the default already has a schedule', () => {
  assert.equal(getInitialScheduleFormValues(['cambio de ACEITE']).service.option, 'Filtros');
});

test('keeps the custom service option available after a frequency named Otro exists', () => {
  assert.deepEqual(getDisabledScheduleOptions(['Filtros', 'oTrO']), ['Filtros']);
  const custom = {
    ...getInitialScheduleFormValues(['Otro']),
    service: toServiceFieldValue('Revisión de dirección'),
    useKm: true,
    km: '10000',
  };
  assert.equal(parseScheduleForm(custom, ['Otro']).success, true);
  assert.equal(
    parseScheduleForm({ ...custom, service: toServiceFieldValue('Otro') }, ['Otro']).success,
    false,
  );
});

test('prefills every editable field from a schedule', () => {
  const values = getScheduleFormValues({
    id: 'schedule-id',
    vehicleId: 'vehicle-id',
    type: 'Revisión de dirección',
    intervalMonths: 6,
    intervalKm: null,
    baselineDate: '2026-02-14',
    baselineMileage: 45000,
    nextDueDate: '2026-08-14',
    nextDueMileage: null,
    remainingDays: 30,
    remainingKm: null,
    status: 'upcoming',
    dueReason: 'date',
    createdAt: '2026-02-14T00:00:00.000Z',
    updatedAt: '2026-02-14T00:00:00.000Z',
  });

  assert.deepEqual(values, {
    service: toServiceFieldValue('Revisión de dirección'),
    useMonths: true,
    months: '6',
    useKm: false,
    km: '',
  });
});

test('editing can keep its own type while other types remain unavailable', () => {
  const currentType = 'Cambio de aceite';
  const otherTypes = ['Filtros'];
  const values = {
    ...getInitialScheduleFormValues(),
    service: toServiceFieldValue(currentType),
    useKm: true,
    km: '10000',
  };

  assert.equal(parseScheduleForm(values, otherTypes).success, true);
  assert.equal(
    parseScheduleForm({ ...values, service: toServiceFieldValue('Filtros') }, otherTypes).success,
    false,
  );
});
