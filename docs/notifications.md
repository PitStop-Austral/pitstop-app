# Notification registration

PIT-58 establishes notification destinations but does not send or display push messages. Each
browser installation has a stable UUID in local storage and an FCM registration token in the
`NotificationDevice` table. `installationId` and `token` are unique; registering an existing
installation rotates its token and explicitly transfers it to the currently authenticated account.
A transaction-scoped PostgreSQL advisory lock serializes registrations so simultaneous claims for
the same token resolve without exposing a uniqueness error. A user can own multiple installations.

`User.notificationsEnabled` records that the user opted in. Removing the final installation does
not reset this preference; the absence of device rows means there is no current delivery target.
`User.notificationPromptShownAt` records the first time the invitation was presented and remains
unchanged on repeated marking calls. Firebase identity synchronization only updates email and name,
so both notification fields survive later authenticated requests.

## Authenticated API

- `POST /me/notification-devices` accepts `{ installationId, token }` and returns only
  `{ id, installationId }`.
- `DELETE /me/notification-devices/:installationId` returns `204` and deletes only a row owned by
  the authenticated user. Repeating it is safe.
- `PATCH /me/notification-prompt` returns `204` and stores the first server timestamp.
- `GET /me` returns `notificationsEnabled` and `notificationPromptShownAt`, never tokens or devices.

## Browser flow

The invitation opens only after the first successfully created maintenance. Browser support is
resolved before enabling the activation button so `Notification.requestPermission()` runs directly
inside the click gesture. After permission is granted, Firebase receives the existing PWA service
worker registration and `VITE_FIREBASE_VAPID_KEY`; the resulting token and local installation UUID
are sent to the API.

iOS and iPadOS require an installed Home Screen web app before notification permission is requested.
Unsupported browsers, denied permission, cancellation, and token-registration failures leave the
account and maintenance usable. The Profile activation control, push delivery, background display,
and notification navigation are later work.
