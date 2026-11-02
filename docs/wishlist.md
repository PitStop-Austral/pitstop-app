# Vehicle wishlist

Each vehicle has a wishlist: things the user wants to buy for the car, with an estimated price, a
priority, and whether they were already bought. PIT-77 adds the database storage and PIT-80 the API.
There is no screen yet.

## Data model

`WishlistItem` belongs to `Vehicle` and stores a name, optional estimated price
(`Decimal(12, 2)`, Argentine pesos), priority, optional note, purchase state, and timestamps.
Priorities are persisted as the `WishlistPriority` enum (`ALTA`, `MEDIA`, `BAJA`). New items default
to `MEDIA` and not purchased. Deleting a vehicle cascades to its wishlist items. The
`(vehicleId, purchased, priority, createdAt)` index supports listing a vehicle's items with pending
ones first, by priority, with a stable creation-date tiebreak.

The `add_wishlist_items` migration adds hand-written CHECK constraints that Prisma cannot declare:

- `WishlistItem_estimatedPrice_non_negative`: the price is `NULL` or `>= 0`.
- `WishlistItem_name_not_blank`: `length(btrim(name)) > 0`. `btrim` only strips spaces, so a name
  made only of tabs or non-breaking spaces still passes; the API should trim before saving.
- `WishlistItem_purchasedAt_matches_purchased`: `purchasedAt` is set if and only if `purchased` is
  true. The API sets or clears `purchasedAt` when the purchase state changes; the database does not.

`purchasedAt` is `timestamp(3)` without time zone (as specified by the ticket), unlike the KPI,
alert, and HTTP request log tables, which use `timestamptz`.

`apps/api/test/wishlist-items.db-spec.ts` covers the defaults, each CHECK, the vehicle foreign key,
and the cascade against the `_test` database.

## API

`apps/api/src/modules/wishlist` exposes four routes, protected by the global Firebase guard (no token
→ `401`). Both path params go through `ParseUUIDPipe`.

| Method   | Route                                         | Body                                            | Response           |
| -------- | --------------------------------------------- | ----------------------------------------------- | ------------------ |
| `GET`    | `/vehicles/:vehicleId/wishlist`               | —                                               | `200` ordered list |
| `POST`   | `/vehicles/:vehicleId/wishlist`               | `name`, `estimatedPrice?`, `priority?`, `note?` | `201` created item |
| `PATCH`  | `/vehicles/:vehicleId/wishlist/:id/purchased` | `{ "purchased": boolean }`                      | `200` updated item |
| `DELETE` | `/vehicles/:vehicleId/wishlist/:id`           | —                                               | `204`              |

Items are returned with `estimatedPrice` as a JSON number (or `null`); `updatedAt` is not exposed.
Invalid body fields return `400` with exactly one Spanish message per field. Other `400`s keep
Nest's English messages: an unknown body field (rejected by `forbidNonWhitelisted`) and a path id
that is not a UUID (`ParseUUIDPipe`). `priority` defaults to `MEDIA`, and a blank `note` is saved as
`null`.

The list is ordered by `purchased asc, priority asc, createdAt desc, id asc`: pending items first,
from `ALTA` to `BAJA` (the enum declaration order), newest first within a priority, with `id` as a
stable tiebreak; purchased items go last.

Marking an item as purchased sets `purchasedAt` to the current time, and unmarking clears it.
The write is conditional (`purchased: !purchased`), so sending the state the item already has,
including two concurrent requests, keeps its original `purchasedAt`.

Every route first checks that the vehicle belongs to the caller. A missing vehicle or one owned by
someone else returns `404 "Vehículo no encontrado"` (never `403`, so its existence is not revealed).
An item that is not on that vehicle returns `404 "Deseo no encontrado"`. Writes are scoped by
`{ id, vehicleId }`.

`apps/api/test/wishlist.db-spec.ts` covers the ordering, the purchase toggle, deletion isolation,
and the cross-account `404`s against the `_test` database.
