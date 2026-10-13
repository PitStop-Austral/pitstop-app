# Notifications

PIT-58 establishes notification destinations and PIT-59 completes a development/QA delivery test.
Each browser installation has a stable UUID in local storage and an FCM registration token in the
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
- `POST /me/notification-devices/:installationId/test` sends a fixed data-only notification when
  `NOTIFICATION_TEST_ENABLED=true`. It returns `{ messageId, testId }` and never accepts a token,
  user, title or body from the caller.
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
account and maintenance usable. A valid test message produces one Sonner toast while the app has
focus, or one native notification from the existing PWA worker while it is in the background. Both
paths use `testId` for deduplication. Notification navigation remains later work.

## Send a test notification

The endpoint is disabled by default, including production. Set `NOTIFICATION_TEST_ENABLED=true` in
the API environment only for development or QA, then restart the API.

Use a production build or an HTTPS deployment from the same Firebase environment. The service
worker does not run under `pnpm dev`; locally, use:

```bash
pnpm --filter web build
pnpm --filter web preview
```

After signing in and activating notifications:

1. Open browser DevTools and evaluate the following expression to read the installation UUID:

   ```javascript
   localStorage.getItem('pitstop:notification-installation-id');
   ```

2. In the Network panel, select an authenticated API request such as `GET /me` and temporarily copy
   the value after `Bearer` from its `Authorization` request header. Treat it as a credential and do
   not save it in documentation, screenshots or shell history.
3. Replace the placeholders and call the API without a request body:

   ```bash
   curl --request POST \
     --header 'Authorization: Bearer <FIREBASE_ID_TOKEN>' \
     '<API_URL>/me/notification-devices/<INSTALLATION_ID>/test'
   ```

A successful response has this shape:

```json
{
  "messageId": "projects/example/messages/example",
  "testId": "00000000-0000-4000-8000-000000000000"
}
```

`messageId` confirms that Firebase accepted the message; it is not proof that the device displayed
it. Delivery is confirmed visually on the target installation.

## Manual evidence

Record the platform, browser, environment, visual result and `testId` for each case. Never record the
FCM token, Firebase ID token or Admin credentials.

| Case                               | Expected result                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| App focused                        | One in-app toast with the fixed title and body                                            |
| App open in another/background tab | One native system notification                                                            |
| App tab closed                     | One native system notification while the browser/system still permits background delivery |
| Logout                             | No foreground listener remains and the device association is removed                      |
| Account switch                     | The previous listener is removed; one listener is installed for the new session           |

Repeat the delivery cases on desktop, Android, and an iOS/iPadOS 16.4+ Home Screen installation with
permission granted. Closing a tab is not equivalent to force-stopping the browser or operating
system, and delivery is not promised after a force stop.
