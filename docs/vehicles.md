# Vehicle management

PitStop stores vehicles per authenticated user. Every vehicle has a brand, model, year, fuel type,
Argentine plate, mileage, and optional nickname. Plates are normalized to uppercase without spaces
and must use either the `AAA000` or `AA000AA` format. A user cannot register the same plate twice.

The authenticated vehicle API exposes:

- `GET /vehicles` to list the current user's vehicles in creation order.
- `POST /vehicles` to create a vehicle and make it the user's active vehicle in one transaction.
- `PATCH /vehicles/:id` to update an owned vehicle. Requests for another user's vehicle return 404.

Request bodies are validated by Nest's global `ValidationPipe`. Years must be between 1900 and the
current year plus one, and mileage must fit PostgreSQL's non-negative integer range.

The Garage route uses TanStack Query for vehicle and current-user state. It shows an empty state for
accounts without vehicles and reuses `VehicleFormSheet` for creation and editing. Successful
mutations invalidate the affected query caches before the form closes.

For the active vehicle, Garage renders a hero card (photo placeholder, name, status chip, and
odometer) alongside a tabbed detail panel — Información, Recomendados, Historial, and Deseos. Only
Información has real content today (a read-only identification grid); the other tabs show a
"coming soon" empty state. The active tab is kept in the `tab` URL search param (`/garage?tab=...`,
defaulting to `info`) so it survives a page reload.
