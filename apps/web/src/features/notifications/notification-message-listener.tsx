import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/sonner';
import { Text } from '@/components/ui/text';
import { isNotificationMessagingSupported, subscribeToForegroundMessages } from './messaging';
import {
  buildMaintenanceAlertDestination,
  claimNotificationId,
  parseNotificationMessageData,
} from './notification-message';

type NotificationMessageListenerProps = {
  userId: string;
};

export function NotificationMessageListener({ userId }: NotificationMessageListenerProps) {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const seenNotificationIds = new Set<string>();

    void isNotificationMessagingSupported()
      .then((supported) => {
        if (!active || !supported) return;

        unsubscribe = subscribeToForegroundMessages((payload) => {
          const message = parseNotificationMessageData(payload.data);
          if (!message || !claimNotificationId(seenNotificationIds, message.notificationId)) return;
          toast(<Text variant="label">{message.title}</Text>, {
            description: (
              <Text color="muted" variant="caption">
                {message.body}
              </Text>
            ),
            icon: <Icon color="primary" name="Bell" size="sm" />,
            id: message.notificationId,
            ...(message.kind === 'maintenance-alert'
              ? {
                  action: {
                    label: <Text variant="label">Ver</Text>,
                    onClick: () =>
                      navigate({
                        href: buildMaintenanceAlertDestination(
                          message.vehicleId,
                          message.scheduleId,
                        ),
                      }),
                  },
                }
              : {}),
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
  }, [navigate, userId]);

  return null;
}
