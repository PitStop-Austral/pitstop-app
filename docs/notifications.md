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
unchanged on repeated marking calls. It is retained for account history; the client decides whether
to present the invitation again per browser installation and Firebase UID. Firebase identity
synchronization only updates email and name, so both notification fields survive later authenticated
requests.

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
- `PATCH /me/preferences` accepts `upcomingThresholdDays` (0–3650) and
  `upcomingThresholdKm` (0–500000), both integers. These account-level values define when a
  schedule becomes upcoming; `0` disables advance notices without affecting overdue schedules.

## Browser flow

After the authenticated app finishes loading, each browser installation offers the invitation once
per Firebase UID. The client stores `pitstop:notification-prompt:<firebaseUid>` in local storage
when the sheet opens, so another account on the same browser and the same account on another
browser or installed PWA receive their own offer. The sheet is not shown when notification support
is unavailable or the permission is denied, and registering a first maintenance does not trigger
it. Browser support is resolved before enabling the activation button so
`Notification.requestPermission()` runs directly inside the click gesture. After permission is
granted, Firebase receives the existing PWA service worker registration and
`VITE_FIREBASE_VAPID_KEY`; the resulting token and local installation UUID are sent to the API.

iOS and iPadOS require an installed Home Screen web app before notification permission is requested.
Unsupported browsers, denied permission, cancellation, and token-registration failures leave the
account and maintenance usable. A valid message produces one Sonner toast while the app has focus,
or one native notification from the existing PWA worker while it is in the background. Both paths
use `notificationId` for deduplication; the PIT-59 test payload's legacy `testId` remains accepted.
Maintenance alerts include a **Ver** action and native-notification clicks open the matching vehicle
and frequency in the garage. Mileage reminders include an **Actualizar** action and open the matching
vehicle with the mileage sheet ready. The complete destination is preserved through login and
registration.

## Daily maintenance alerts

GitHub Actions invokes `GET /cron/maintenance-alerts` every day at 12:00 UTC (09:00 Argentina).
Scheduled GitHub workflows can start later during periods of high load, so this is a daily target,
not an exact delivery guarantee. The endpoint is public with respect to Firebase Authentication but
requires `Authorization: Bearer <CRON_SECRET>` and returns `401` before reviewing schedules when the
credential is absent or invalid.

Generate the shared secret locally without committing it:

```bash
openssl rand -hex 32
```

Set the generated value as `CRON_SECRET` in the deployed API and as a GitHub Actions repository
secret with the same name. Add the deployed API base URL, without the cron path, as the repository
variable `API_BASE_URL`. The workflow is in `.github/workflows/maintenance-alerts.yml`; it can also
be started from **Actions > Maintenance alerts > Run workflow** after the workflow exists on the
default branch.

Each eligible frequency is claimed once per installation and calculated due date/kilometre pair.
The daily review uses the owning account's saved advance thresholds, so changing them immediately
changes which schedules qualify as upcoming on the next review.
Claims are idempotent across repeated or concurrent workflow runs. Each delivery is claimed
immediately before its send; if a run is interrupted, later unclaimed deliveries remain eligible for
the next run. A claimed delivery in `PENDING` or `FAILED` is not retried for the same due occurrence.
Changing the frequency or recording maintenance can create a new due occurrence and therefore a new
alert.

The same cron reviews vehicles whose owner has notifications enabled and at least one registered
device. A mileage reminder is delivered per installation after 30 full 24-hour periods without a
kilometre confirmation, with new delivery periods at 60, 90, and subsequent 30-day intervals.
Confirming the same or a greater mileage through `PATCH /vehicles/:id/mileage` restarts the period;
editing other vehicle data, its photo, or maintenance history does not. Sent and pending deliveries
are not repeated for the same period, while failed deliveries are retried. The cron response keeps
the maintenance-alert counters and adds `mileageReminders: { sent, failed, skipped }`.

## Send a test notification

The endpoint is disabled by default, including production. Set `NOTIFICATION_TEST_ENABLED=true` in
the API environment only for development or QA, then restart the API.

Use a local development server, a production build, or an HTTPS deployment from the same Firebase
environment. For final production-worker validation, use:

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

Record the platform, browser, environment, visual result and `testId` or `notificationId` for each
case. Never record the FCM token, Firebase ID token or Admin credentials.

| Case                               | Expected result                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| App focused                        | One in-app toast; its action opens the correct maintenance or mileage destination        |
| App open in another/background tab | One native notification; clicking it opens the correct destination                       |
| App tab closed                     | One native notification; clicking it opens or focuses PitStop at the correct destination |
| Logout                             | No foreground listener remains and the device association is removed                     |
| Account switch                     | The previous listener is removed; one listener is installed for the new session          |

Repeat the delivery cases on desktop, Android, and an iOS/iPadOS 16.4+ Home Screen installation with
permission granted. Closing a tab is not equivalent to force-stopping the browser or operating
system, and delivery is not promised after a force stop. For PIT-63, run the workflow manually after
deployment and record real delivery/navigation evidence for focused, background, and closed states;
do not treat Firebase acceptance or local tests as delivery evidence.

### PIT-63 local verification - 2026-10-14

The maintenance alert flow was verified with a production web build served by `pnpm preview`, the
local API and PostgreSQL, and PitStop installed as a Chrome PWA on macOS. Notification
`59c54255-c73b-4177-b55e-98566f061d5a` produced one foreground toast; **Ver** opened vehicle
`PIT063` at its `Filtro de aire` frequency and the consumed destination parameters were removed from
the URL. With the PWA closed, the same setup displayed a native notification and clicking it opened
the correct vehicle and frequency. A direct `ServiceWorkerRegistration.showNotification` probe also
confirmed that Chrome and macOS could display native notifications independently of FCM.

GitHub Actions evidence remains pending until this workflow is present on the default branch. After
merge, run **Actions > Maintenance alerts > Run workflow** against the deployed environment and add
the workflow URL plus the focused, background, and closed-state results here.
