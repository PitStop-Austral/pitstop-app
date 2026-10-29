# Vehicle wishlist

PIT-77 adds database storage for each vehicle's wishlist: things the user wants to buy for the car,
with an estimated price, a priority, and whether they were already bought. There is no API or screen
yet.

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
