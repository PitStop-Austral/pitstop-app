import { useEffect } from 'react';

import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { isNotificationMessagingSupported, subscribeToForegroundMessages } from './messaging';
import { parseNotificationMessageData } from './notification-message';

type NotificationMessageListenerProps = {
  userId: string;
};

export function NotificationMessageListener({ userId }: NotificationMessageListenerProps) {
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const seenTestIds = new Set<string>();

    void isNotificationMessagingSupported()
      .then((supported) => {
        if (!active || !supported) return;

        unsubscribe = subscribeToForegroundMessages((payload) => {
          const message = parseNotificationMessageData(payload.data);
          if (!message || seenTestIds.has(message.testId)) return;

          seenTestIds.add(message.testId);
          toast(<Text variant="label">{message.title}</Text>, {
            description: (
              <Text color="muted" variant="caption">
                {message.body}
              </Text>
            ),
            icon: <Icon color="primary" name="Bell" size="sm" />,
            id: message.testId,
          });
        });
      })
      .catch(() => {
        // Notification support can disappear when browser settings change mid-session.
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
