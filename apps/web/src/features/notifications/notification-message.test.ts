import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMaintenanceAlertDestination,
  claimNotificationId,
  parseNotificationMessageData,
  resolveMaintenanceAlertTarget,
} from './notification-message.ts';

test('parses the PIT-59 test message and keeps legacy testId compatibility', () => {
  assert.deepEqual(
    parseNotificationMessageData({
      title: 'Notificación de prueba',
      body: 'Todo listo',
      testId: 'test-id',
    }),
    {
      kind: 'test',
      notificationId: 'test-id',
      title: 'Notificación de prueba',
      body: 'Todo listo',
    },
  );
});

test('parses a complete maintenance alert', () => {
  assert.deepEqual(
    parseNotificationMessageData({
      kind: 'maintenance-alert',
      notificationId: 'alert-id',
      title: 'Mantenimiento próximo',
      body: 'El Rojo: Cambio de aceite',
      vehicleId: 'vehicle-id',
      scheduleId: 'schedule-id',
      status: 'upcoming',
    }),
    {
      kind: 'maintenance-alert',
      notificationId: 'alert-id',
      title: 'Mantenimiento próximo',
      body: 'El Rojo: Cambio de aceite',
      vehicleId: 'vehicle-id',
      scheduleId: 'schedule-id',
      status: 'upcoming',
    },
  );
});

test('rejects incomplete or unknown notification messages', () => {
  assert.equal(
    parseNotificationMessageData({
      kind: 'maintenance-alert',
      notificationId: 'alert-id',
      title: 'Mantenimiento próximo',
      body: 'El Rojo: Cambio de aceite',
      vehicleId: 'vehicle-id',
      status: 'upcoming',
    }),
    null,
  );
  assert.equal(
    parseNotificationMessageData({
      kind: 'unknown',
      notificationId: 'alert-id',
      title: 'Título',
      body: 'Cuerpo',
    }),
    null,
  );
});

test('builds the protected garage destination with encoded identifiers', () => {
  assert.equal(
    buildMaintenanceAlertDestination('vehicle/id', 'schedule id'),
    '/garage?tab=recomendados&vehicleId=vehicle%2Fid&scheduleId=schedule+id',
  );
});

test('claims each notification id only once', () => {
  const seenIds = new Set<string>();

  assert.equal(claimNotificationId(seenIds, 'notification-id'), true);
  assert.equal(claimNotificationId(seenIds, 'notification-id'), false);
});

test('resolves vehicle switching and validates the schedule against the active vehicle', () => {
  const vehicles = [{ id: 'vehicle-a' }, { id: 'vehicle-b' }];

  assert.deepEqual(
    resolveMaintenanceAlertTarget('vehicle-a', vehicles, undefined, 'vehicle-b', 'schedule-b'),
    { kind: 'switch-vehicle', vehicleId: 'vehicle-b' },
  );
  assert.deepEqual(
    resolveMaintenanceAlertTarget(
      'vehicle-b',
      vehicles,
      [{ id: 'schedule-b' }],
      'vehicle-b',
      'schedule-b',
    ),
    { kind: 'ready' },
  );
  assert.deepEqual(
    resolveMaintenanceAlertTarget(
      'vehicle-b',
      vehicles,
      [{ id: 'schedule-a' }],
      'vehicle-b',
      'schedule-b',
    ),
    { kind: 'invalid' },
  );
  assert.deepEqual(
    resolveMaintenanceAlertTarget('vehicle-a', vehicles, [], 'foreign-vehicle', 'schedule-b'),
    { kind: 'invalid' },
  );
});
