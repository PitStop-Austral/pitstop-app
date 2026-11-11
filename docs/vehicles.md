# Vehicle management

PitStop stores vehicles per authenticated user. Every vehicle has a brand, model, year, fuel type,
Argentine plate, mileage, and optional nickname. It can also store an optional technical sheet with
engine and gearbox oil, transmission type, front and rear tire details, and bulb references. Plates
are normalized to uppercase without spaces and must use either the `AAA000` or `AA000AA` format. A
user cannot register the same plate twice.

The authenticated vehicle API exposes:

- `GET /vehicles` to list the current user's vehicles in creation order.
- `POST /vehicles` to create a vehicle, its five default maintenance frequencies, and make it the
  user's active vehicle in one transaction. The rules cover oil change (10,000 km / 6 months),
  wheel alignment (10,000 km / 12 months), air filter (15,000 km / 12 months), oil filter
  (10,000 km / 6 months), and timing belt (100,000 km / 60 months).
- `PATCH /vehicles/:id` to update an owned vehicle except its mileage. Requests containing
  `mileage` are rejected; requests for another user's vehicle return 404.
- `PATCH /vehicles/:id/mileage` with `{ "mileage": number }` to update only an owned vehicle's
  mileage. The value cannot be lower than the saved mileage; lower values return 400 and equal
  values are allowed and still confirm the mileage timestamp used by reminder delivery.
- `GET /vehicles/:id/mileage-history` to get the owned vehicle's odometer evolution over the last
  12 months (Argentina dates). It combines the sign-up mileage (`initialMileage`, ignored when
  `null`), every maintenance's km and date, and every stored `MileageReading`. Each successful
  `PATCH /vehicles/:id/mileage` stores one reading; rejected updates do not. Points follow the
  running maximum, so the line never goes down:
  - The highest reading before the period becomes a `WINDOW_START` point.
  - When no reading predates the period, the period starts at the first reading.
  - Readings that don't beat the max, and future-dated readings, are left out.
  - On a day with several readings, only the highest is kept.

  The response includes `readingsCount` (all readings, any date), `kmInPeriod`, and
  `averageMonthlyKm` (floored, 30.44-day months, minimum 1). Another user's vehicle returns 404.
  The `add_mileage_readings` migration backfilled one reading per vehicle at
  `mileageUpdatedAt`. It skipped vehicles whose current km already matched their sign-up km or a
  maintenance's km.

- `DELETE /vehicles/:id` to permanently delete an owned vehicle. If it was active, the oldest
  remaining vehicle becomes active; if none remain, the active vehicle is set to `null`. The delete
  and reassignment run in one transaction, and requests for another user's vehicle return 404.
- `PATCH /me/active-vehicle` with `{ "vehicleId": "UUID" }` to change the active vehicle. The
  vehicle must belong to the authenticated user or the API returns 404.

Request bodies are validated by Nest's global `ValidationPipe`. Years must be between 1900 and the
current year plus one, and mileage and tire pressure must fit PostgreSQL's non-negative integer
range. Oil quantities accept up to two decimal places between 0 and 99.99 liters. Empty technical
fields are stored as `null`; decimal quantities are serialized as JSON numbers.

The Garage route uses TanStack Query for vehicle and current-user state. It shows an empty state for
accounts without vehicles and reuses `VehicleFormSheet` for creation and editing. For a user with no
vehicles, it first offers a three-step onboarding sheet for brand/model, year/fuel, and plate/mileage.
Closing or completing that sheet records `pitstop:vehicle-onboarding:<firebaseUid>` in browser local
storage, so it is offered only once per account on that device; the empty-state form remains available
after it is skipped. Successful mutations invalidate the affected query caches before the form closes.
The mobile header and desktop sidebar expose the same active-vehicle picker; the selection is stored
in the account and Garage falls back to the first vehicle if no valid active vehicle is saved. While
vehicles and the current user load, the picker shows a disabled spinner; a non-blank nickname appears
under brand and model in both the picker button and the "Elegir vehículo" sheet.

The same form collects the technical sheet in four optional sections: Lubricants, Transmission,
Tires, and Lights. Clearing a previously completed field sends `null`, so editing never restores a
stale value. Mileage is collected when creating a vehicle but is intentionally absent from the
general edit form; the dedicated Garage sheet is the only update path after creation.

For the active vehicle, Garage renders a hero card (photo placeholder, name, status chip, and
odometer) alongside a tabbed detail panel — Información, Recomendados, and Deseos (the vehicle's
wishlist, see [wishlist.md](./wishlist.md)). Información shows five read-only cards for
identification, lubricants, transmission, tires, and lights. All technical fields remain visible
when empty and display `A definir`; paired values fall back independently and only completed
measurements receive units. The cards stack on smaller screens and use a two-column layout from
1280 px, with identification spanning both columns. The active tab is kept in the `tab` URL search
param (`/garage?tab=...`, defaulting to `info`) so it survives a page reload.
The odometer offers an "Actualizar km" action that opens a prefilled mileage form; successful
updates refresh the displayed vehicle without a page reload.
Below the hero card (left column from 1024 px, between the hero card and the tabs on smaller
screens; the hero card is not sticky) an "Evolución del kilometraje" card draws that history as an
SVG step line with no chart library. It shows km in the last 12 months and the monthly average.
Its points are buttons with roving tabindex (arrows, Home/End, Escape), and selecting one shows its
date, km, source, and increase in an `aria-live` detail. With fewer than two readings, or no
points, it shows an empty state whose button opens the same mileage sheet. Mileage updates and
maintenance create, edit, or delete invalidate `['vehicles', id, 'mileage-history']`.
Mileage-reminder deep links select the requested owned vehicle, consume the destination parameters,
and open this same sheet. A missing or foreign vehicle leaves Garage open without a sheet and shows
an error message.
