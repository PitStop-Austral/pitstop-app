import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';

import { firebaseApp } from '@/lib/firebase';
import { getAppServiceWorkerRegistration } from '@/lib/service-worker-registration';
import { revokeMessagingToken } from './messaging-token-revocation';
import {
  isIosDevice,
  resolveNotificationCapability,
  type NotificationCapability,
} from './notification-support';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isStandalone(): boolean {
  const standaloneNavigator = navigator as NavigatorWithStandalone;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}

export async function getNotificationCapability(): Promise<NotificationCapability> {
  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorkerApi = 'serviceWorker' in navigator;
  const hasPushManagerApi = 'PushManager' in window;
  const messagingSupported =
    hasNotificationApi && hasServiceWorkerApi && hasPushManagerApi
      ? await isSupported().catch(() => false)
      : false;

  return resolveNotificationCapability({
    isIos: isIosDevice(navigator),
    isStandalone: isStandalone(),
    isSecureContext: window.isSecureContext,
    hasNotificationApi,
    hasServiceWorkerApi,
    hasPushManagerApi,
    messagingSupported,
    permission: hasNotificationApi ? Notification.permission : 'default',
    hasVapidKey: Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY),
  });
}

export async function getNotificationToken(): Promise<string> {
  const registration = await getAppServiceWorkerRegistration();
  return getToken(getMessaging(firebaseApp), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export async function deleteNotificationToken(): Promise<void> {
  await revokeMessagingToken({
    isSupported: () => isSupported().catch(() => false),
    getRegistration: getAppServiceWorkerRegistration,
    getMessaging: () => getMessaging(firebaseApp),
    bindTokenToRegistration: (messaging, registration) =>
      getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      }),
    deleteToken,
  });
}
