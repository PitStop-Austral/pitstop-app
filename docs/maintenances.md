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
