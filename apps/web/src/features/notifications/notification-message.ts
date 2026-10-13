export type NotificationMessageData = {
  title: string;
  body: string;
  testId: string;
};

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
  const testId = readNonEmptyString(data?.testId);

  return title && body && testId ? { title, body, testId } : null;
}
