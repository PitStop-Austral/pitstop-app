# Maintenance registration

PIT-49 adds maintenance creation for the active vehicle. The authenticated app layout owns a
single `MaintenanceSheetProvider`, so the primary action in both navigation variants opens the same
responsive form from any authenticated screen. When the account has no vehicles, that action opens
the vehicle creation sheet instead. While vehicle data is loading or unavailable, the action is
disabled.

## Data model

`Maintenance` belongs to `Vehicle` and stores the service name, category, calendar date, mileage,
optional workshop, optional cost, optional notes, and timestamps. Categories are persisted as the
`MaintenanceCategory` enum (`MANTENIMIENTO` or `ARREGLO`). Deleting a vehicle cascades to its
maintenance records. The `(vehicleId, date)` index supports future history queries by vehicle and
date.

## API

`POST /vehicles/:vehicleId/maintenances` is authenticated by the global Firebase guard. The service
looks up the vehicle by both id and authenticated owner, returning `404` for missing and unowned
vehicles. The request validates the UUID, service and optional field limits, category, real calendar
date, Argentina-local non-future date, integer mileage, and non-negative cost with at most two
decimal places.

Creation and the conditional odometer update run in one Prisma transaction. The submitted mileage
raises the vehicle odometer only when it is greater than the saved value; historical records with
equal or lower mileage do not reduce it. Responses serialize the maintenance date as `YYYY-MM-DD`
and the Prisma decimal cost as `number | null`.

## Web flow

The form defaults to the service catalog's oil-change option, `MANTENIMIENTO`, the current calendar
date in `America/Argentina/Buenos_Aires`, and the active vehicle mileage. The same timezone boundary
is enforced by the API, so the form never offers a locally valid date that the server considers
future. Choosing `Otro` enables a custom trimmed service name. Empty workshop, cost, and notes
fields are sent as `null`.

On success, the form closes, shows `Servicio registrado`, and invalidates the `vehicles` query
prefix. This refreshes the active vehicle and its odometer without reloading, while also covering
future per-vehicle maintenance queries. During submission the footer shows `Guardando...` and the
sheet cannot be dismissed.

## Maintenance history

`GET /vehicles/:vehicleId/maintenances` returns the vehicle's full history, newest first: ordered by
`date` descending and, for records sharing a date, by `createdAt` descending, so the last one
registered that day leads. It reuses the same ownership check and response mapper as creation, so an
unowned or missing vehicle returns `404` and a non-UUID id returns `400`.

The Calendario route lists that history for the active vehicle. Its query key includes the vehicle
id, so each vehicle caches its own list and switching the active vehicle swaps the list without a
reload. Registering a maintenance already invalidates the `vehicles` prefix, which covers this query
too, so a new record appears at the top of the list immediately.

The route shows, in order, a loading indicator, a retryable error state, an invitation to pick a
vehicle when the account has none, and an empty state that opens the registration form when the
vehicle has no records. The error state only replaces the list while there is nothing cached, so a
failed background refetch leaves the records already on screen untouched. The list itself is a
single column on phones and two columns from 1024 px. Each card shows the service icon and name, a
badge for maintenance or repair, and the last service date and mileage; the next-service line is a
placeholder until frequencies exist.

The history controls run locally on the loaded active-vehicle list: text search matches service
type, workshop, and notes without case or accent differences; category filters combine with a
descending date, mileage, or cost order. Missing costs sort last, and a no-match state can reset
all controls without affecting the distinct empty-history state.

## Detail, edit, and delete

`GET`, `PATCH`, and `DELETE /vehicles/:vehicleId/maintenances/:id` look the record up by id, vehicle,
and owner together, so a maintenance belonging to another user or to another vehicle returns `404`;
non-UUID ids return `400`. If the record disappears between that check and the write, Prisma's
`P2025` is also mapped to `404`. `DELETE` answers `204` without a body.

`PATCH` changes only the fields present in the body. Required fields reject `null`; `null` clears
the optional workshop, cost, and notes, and an empty or blank string also clears workshop and notes
(an empty cost is a `400`). The date follows the same Argentina-local non-future rule as creation. A
new mileage raises the vehicle odometer through the same conditional update as creation, but
lowering a record's mileage or deleting it never lowers the odometer; the odometer is corrected from
the vehicle itself.

In Calendario, tapping a history card opens the detail sheet: service, category badge, date,
mileage, workshop, cost, and notes, with `No especificado` for a missing workshop or cost and no
notes block when there are none. Its `⋮` menu offers `Editar`, which opens the registration form
prefilled (a service outside the catalog opens as `Otro` with its name), and `Eliminar`, which opens
a confirmation sheet. `MaintenanceSheetProvider` keeps a single open-sheet state, so moving from the
detail to edit or delete replaces the sheet instead of stacking dialogs. On phones the detail has a
`Cerrar` footer; on desktop it closes with the X, Escape, or a click outside.

The detail reads the cached history list as its initial data, so it opens without waiting. A saved
edit writes the response into the detail cache before invalidating the `vehicles` prefix, and a
delete removes the detail query first, so neither a reopened detail nor the refetch shows stale or
missing data. If the detail cannot be loaded or no longer exists, the sheet closes with an error
toast.

## Maintenance frequencies

PIT-52 adds one schedule per vehicle and normalized service type. A schedule stores optional positive
integer month and kilometer intervals, with at least one required. Months are capped at 240
(20 years, enforced by the API and the Garage form) so the due date stays within the `Date` range. The database unique constraint
prevents duplicates even when two requests arrive together. `POST /vehicles/:vehicleId/schedules`
creates a schedule, and `GET /vehicles/:vehicleId/schedules` lists that vehicle's saved rules;
both require ownership. Duplicate creation returns `409`.

The baseline is the latest maintenance record of the same service type, ordered by service date and
creation time. Without one, creation captures the Argentina-local calendar date and current vehicle
mileage.

PIT-53 computes due state on the server (`apps/api/src/modules/schedules/schedule-due.ts`) and both
schedule endpoints return it: `nextDueDate` (baseline + calendar months, clamped to month end),
`nextDueMileage` (baseline + km), `remainingDays`, `remainingKm`, `status`, and `dueReason`. A
missing interval yields `null` for its fields and is ignored. `status` is `overdue` when today >=
`nextDueDate` or current mileage >= `nextDueMileage`; otherwise `upcoming` when either remaining
value is within the user's thresholds (`User.upcomingThresholdDays` 30 and `upcomingThresholdKm`
1500 by default, no editing UI yet); otherwise `on_track`. Limits are inclusive and `overdue` wins.
`dueReason` is `date`, `mileage`, or `both` for the criteria that triggered the status, `null` when
on track. All dates are UTC midnight of the Argentina calendar day, so `remainingDays` is a whole
number. The result is computed per request from the current vehicle mileage, so mileage updates
change it without touching the schedule; the web consumes it as-is and never recalculates it.

Garage's Recomendados tab opens the responsive frequency form. It reuses the service catalog,
supports custom services, and allows months, kilometers, or both. The vehicle-specific schedules
query prevents duplicate selection and refreshes after creation. PIT-56 lists the active vehicle's
schedules in that tab as cards showing the service icon, the name (up to two lines), and its
intervals ("Cada X km", "Cada N meses") side by side, with a chevron. `sortSchedules` orders them by
the API status (overdue, upcoming, on track), then by fewest remaining days and kilometers (missing
values last), and breaks ties by name with `localeCompare`. The list is one column below 1360 px
and two from there.

PIT-57 adds schedule detail, editing, and deletion. `GET /vehicles/:vehicleId/schedules/:scheduleId`
returns one owned schedule with the same computed due fields as the list. `PATCH` accepts a partial
schedule update (`type`, `intervalMonths`, and `intervalKm`), requires at least one positive
interval after merging with the current row, maps duplicate normalized service types to `409`, and
returns the updated computed schedule. Editing only intervals preserves the original baseline;
changing the normalized type recalculates the baseline from the latest matching maintenance or,
without one, the current Argentina-local date and vehicle mileage. `DELETE` removes one owned
schedule and returns `204`; missing, unowned, or mismatched vehicle schedules return `404`.

In Garage, tapping a schedule card opens its detail sheet immediately from the cached list and then
revalidates it through the detail endpoint. The detail shows the service, status, intervals,
baseline date and mileage, and next due values. Its `⋮` menu offers `Editar` and `Eliminar`.
Editing reuses the frequency form with prefilled values, excludes the current type from duplicate
validation, shows the saved reference while the type is unchanged, and explains that the reference
will be recalculated after saving when the type changes. Deletion uses a destructive confirmation
sheet. Schedule create, detail, edit, and delete share one discriminated Garage state so those
overlays replace each other instead of stacking.

The database-backed schedule roundtrip is a separate check. Set `TEST_DATABASE_URL` to a dedicated
PostgreSQL database whose name ends in `_test`, apply migrations with
`DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy`,
then run `pnpm --filter api test:e2e:db`. The test seeds and removes its own user and vehicle; it
never falls back to the application's `DATABASE_URL`.

## First-maintenance notification invitation

`POST /vehicles/:vehicleId/maintenances` has a creation-only response field named
`isFirstMaintenance`. The API locks the authenticated user's row and counts maintenance records
across all vehicles owned by that user before inserting, so concurrent requests cannot both report
that they created the first record. List, detail, and update responses do not include this field.

After a successful create, `MaintenanceSheetProvider` replaces the closed maintenance form with the
notification invitation only when this flag is true and `notificationPromptShownAt` is still null.
Editing, signing in, switching vehicles, a failed create, and later maintenance records never open
the invitation.
