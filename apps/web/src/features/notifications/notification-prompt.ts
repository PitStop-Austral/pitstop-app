import type { NotificationCapability } from './notification-support';

export const NOTIFICATION_PROMPT_STORAGE_PREFIX = 'pitstop:notification-prompt:';

export function notificationPromptStorageKey(userUid: string): string {
  return `${NOTIFICATION_PROMPT_STORAGE_PREFIX}${userUid}`;
}

export function shouldOfferNotificationPrompt(input: {
  capability: NotificationCapability;
  alreadyOfferedOnThisDevice: boolean;
}): boolean {
  if (input.alreadyOfferedOnThisDevice) return false;

  return input.capability === 'supported' || input.capability === 'ios-install-required';
}

export function hasOfferedNotificationPrompt(
  storage: Pick<Storage, 'getItem'>,
  userUid: string,
): boolean {
  try {
    return storage.getItem(notificationPromptStorageKey(userUid)) !== null;
  } catch {
    return false;
  }
}

export function markNotificationPromptOffered(
  storage: Pick<Storage, 'setItem'>,
  userUid: string,
): void {
  try {
    storage.setItem(notificationPromptStorageKey(userUid), 'true');
  } catch {
    // Some private browsing modes block local storage. The prompt can still be shown safely.
  }
}
