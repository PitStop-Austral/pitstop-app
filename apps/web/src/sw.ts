/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  buildMaintenanceAlertDestination,
  parseNotificationMessageData,
} from './features/notifications/notification-message';
import { firebaseConfig } from './lib/firebase-config';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/],
  }),
);

self.addEventListener('notificationclick', (event) => {
  const message = parseNotificationMessageData(event.notification.data);
  if (!message || message.kind !== 'maintenance-alert') return;

  event.notification.close();
  event.waitUntil(
    focusOrOpenDestination(buildMaintenanceAlertDestination(message.vehicleId, message.scheduleId)),
  );
});

async function focusOrOpenDestination(destination: string): Promise<void> {
  const destinationUrl = new URL(destination, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const sameOriginWindows = windows.filter(
    (client) => new URL(client.url).origin === self.location.origin,
  );
  const existing =
    sameOriginWindows.find((client) => client.visibilityState === 'visible') ??
    sameOriginWindows[0];

  if (existing) {
    const navigated = await existing.navigate(destinationUrl);
    await (navigated ?? existing).focus();
    return;
  }

  await self.clients.openWindow(destinationUrl);
}

const messaging = getMessaging(initializeApp(firebaseConfig));

onBackgroundMessage(messaging, async (payload) => {
  const message = parseNotificationMessageData(payload.data);
  if (!message) return;

  await self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/icon-192.png',
    tag: message.notificationId,
    data: message,
  });
});
