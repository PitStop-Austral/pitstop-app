export type TestNotificationMessageData = {
  kind: 'test';
  notificationId: string;
  title: string;
  body: string;
};

export type MaintenanceAlertMessageData = {
  kind: 'maintenance-alert';
  notificationId: string;
  title: string;
  body: string;
  vehicleId: string;
  scheduleId: string;
  status: 'upcoming' | 'overdue';
};

export type NotificationMessageData = TestNotificationMessageData | MaintenanceAlertMessageData;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseNotificationMessageData(
  data: Record<string, unknown> | undefined,
): NotificationMessageData | null {
  const title = readNonEmptyString(data?.title);
  const body = readNonEmptyString(data?.body);
  const notificationId =
    readNonEmptyString(data?.notificationId) ?? readNonEmptyString(data?.testId);
  if (!title || !body || !notificationId) return null;

  if (data?.kind === 'maintenance-alert') {
    const vehicleId = readNonEmptyString(data.vehicleId);
    const scheduleId = readNonEmptyString(data.scheduleId);
    const status = data.status === 'upcoming' || data.status === 'overdue' ? data.status : null;
    return vehicleId && scheduleId && status
      ? { kind: 'maintenance-alert', notificationId, title, body, vehicleId, scheduleId, status }
      : null;
  }

  if (data?.kind === undefined || data.kind === 'test') {
    return { kind: 'test', notificationId, title, body };
  }

  return null;
}

export function buildMaintenanceAlertDestination(vehicleId: string, scheduleId: string): string {
  const search = new URLSearchParams({ tab: 'recomendados', vehicleId, scheduleId });
  return `/garage?${search.toString()}`;
}

export function claimNotificationId(seenIds: Set<string>, notificationId: string): boolean {
  if (seenIds.has(notificationId)) return false;
  seenIds.add(notificationId);
  return true;
}

export type MaintenanceAlertTargetResolution =
  | { kind: 'waiting' }
  | { kind: 'invalid' }
  | { kind: 'switch-vehicle'; vehicleId: string }
  | { kind: 'ready' };

export function resolveMaintenanceAlertTarget(
  activeVehicleId: string | undefined,
  vehicles: ReadonlyArray<{ id: string }> | undefined,
  schedules: ReadonlyArray<{ id: string }> | undefined,
  vehicleId: string,
  scheduleId: string,
): MaintenanceAlertTargetResolution {
  if (!vehicles) return { kind: 'waiting' };
  if (!vehicles.some((vehicle) => vehicle.id === vehicleId)) return { kind: 'invalid' };
  if (activeVehicleId !== vehicleId) return { kind: 'switch-vehicle', vehicleId };
  if (!schedules) return { kind: 'waiting' };
  return schedules.some((schedule) => schedule.id === scheduleId)
    ? { kind: 'ready' }
    : { kind: 'invalid' };
}
