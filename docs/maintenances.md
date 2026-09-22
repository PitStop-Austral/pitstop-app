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
