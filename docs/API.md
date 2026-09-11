# API reference

The Laravel backend is the only thing that talks to the database. Everything the
frontend knows about inventory it learns through this API.

- **Base URL** — `{APP_URL}/api/v1`
- **Format** — JSON in, JSON out. Send `Accept: application/json` on every
  request; without it Laravel may redirect instead of returning a JSON error
  body.
- **Authentication** — Sanctum personal access tokens, sent as
  `Authorization: Bearer <token>`. There are no cookies and no CSRF token, which
  is what allows the frontend to be served from a different origin to the API.
- **Quantities are integers.** Every quantity field in every request and response
  is a whole number of the product's unit. There are no fractional quantities
  anywhere in the inventory engine.

---

## Contents

1. [Conventions](#conventions)
2. [Errors](#errors)
3. [Authentication](#authentication)
4. [Permissions and roles](#permissions-and-roles)
5. [Dashboard](#dashboard)
6. [Products](#products)
7. [Categories](#categories)
8. [Suppliers](#suppliers)
9. [Inventory](#inventory)
10. [Stock IN](#stock-in)
11. [Stock OUT](#stock-out)
12. [Price catalogue](#price-catalogue)
13. [Reports and CSV export](#reports-and-csv-export)
14. [Notifications](#notifications)
15. [Audit logs](#audit-logs)
16. [Users](#users)
17. [Settings](#settings)
18. [Rate limits](#rate-limits)

---

## Conventions

### Single records

A single record is wrapped in `data`:

```json
{
  "data": { "id": 14, "sku": "FS-1042", "name": "Brass hinge, 75mm" }
}
```

### Collections

Collections are paginated and carry Laravel's `meta` and `links`:

```json
{
  "data": [{ "id": 14 }, { "id": 15 }],
  "links": {
    "first": "https://api.example.com/api/v1/products?page=1",
    "last": "https://api.example.com/api/v1/products?page=4",
    "prev": null,
    "next": "https://api.example.com/api/v1/products?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "to": 25,
    "per_page": 25,
    "last_page": 4,
    "total": 94,
    "path": "https://api.example.com/api/v1/products"
  }
}
```

List endpoints with a meaningful aggregate add `meta.totals`, computed over the
**filtered** set — so the KPI row above a table always agrees with the table
under it. Two shapes exist:

```json
// product / inventory lists
"totals": { "products": 94, "units": 18422, "low_stock": 7, "out_of_stock": 2 }

// movement lists (stock in, stock out, product movement)
"totals": { "movements": 412, "units": 9840, "products": 61 }
```

### Shared query parameters

Every list and report endpoint validates its filters through one shared
contract, so the same parameters mean the same thing everywhere.

| Parameter | Type | Notes |
| --- | --- | --- |
| `page` | integer ≥ 1 | 1-based. |
| `per_page` | integer 5–200 | Defaults to 25 (30 for audit logs). |
| `search` | string, ≤ 120 | Matched against the natural identifiers for the resource — SKU, barcode and name for products; name, code and contact for suppliers; reference and notes for movements. |
| `sort` | string, ≤ 40 | A whitelisted column for the resource. An unrecognised value falls back to the natural order rather than erroring. |
| `direction` | `asc` \| `desc` | |
| `date_from`, `date_to` | `YYYY-MM-DD` | Inclusive. `date_to` must be on or after `date_from`. Applied to the resource's own timestamp (`occurred_at` for movements and ledger lines, `received_at` for batches). |
| `product_id`, `supplier_id`, `category_id` | integer | Validated against the current tenant. |
| `type` | `stock_in` \| `stock_out` \| `adjustment` | Movement type. |
| `stock_status` | `in_stock` \| `low_stock` \| `out_of_stock` | |
| `include_archived` | boolean | Off by default. |
| `include_inactive` | boolean | Off by default. |
| `include_depleted` | boolean | Batch lists hide exhausted batches unless this is set. |

An id belonging to another business **fails validation** — it never silently
returns an empty list. The message is deliberately plain: *"That product does not
belong to your business."*

### Enumerations in responses

Anything the UI has to both display and branch on comes back as an object with a
machine value and a human label, so the frontend never hard-codes English:

```json
{ "type": { "value": "stock_out", "label": "Stock out" } }
```

Product units are `each`, `box`, `pallet`, `pack`, `gram`, `kilogram`, `litre`,
`millilitre`, `metre` — and carry an `abbreviation` as well as a `label`.

### Timestamps

ISO 8601 with offset (`2026-09-11T14:02:51+00:00`). Stored in UTC; the business's
`timezone` setting is for display only.

---

## Errors

Every failure returns the same envelope. `error` is a stable machine code meant
to be branched on; `message` is meant to be shown to a person.

```json
{
  "message": "Human-readable sentence.",
  "error": "machine_readable_code"
}
```

| Status | `error` | When |
| --- | --- | --- |
| 401 | `unauthenticated` | Missing, malformed, or revoked token. |
| 403 | `forbidden` | Authenticated, but a permission or policy check failed. |
| 403 | `invalid_signature` | An expired or tampered signed link. |
| 404 | `not_found` | No such record **in your business**, or no such route. |
| 409 | `immutable_record` | An attempt to update or delete an append-only record (ledger entries, stock movements, allocations, audit logs). |
| 422 | `validation_failed` | Input validation. Includes `errors`. |
| 422 | `insufficient_stock` | A stock OUT or negative adjustment would take a product below zero. Includes the real numbers. |
| 500 | `server_error` | In production the message is generic and the detail goes to the logs. With `APP_DEBUG=true` the real exception is returned instead. |

Responses Laravel produces itself — `405` for a wrong verb, `429` for a throttled
request — carry `message` but no `error` code. `429` also carries `Retry-After`.

### Cross-tenant access returns 404, not 403

Asking for a record that belongs to another business returns `404 not_found`,
identical to asking for a record that does not exist. A 403 would confirm the id
is real, which is itself a leak. This is a deliberate part of the isolation
design — see [ARCHITECTURE.md](ARCHITECTURE.md).

### Validation errors

Laravel's `errors` shape is preserved, because the frontend maps it straight onto
inline field errors.

```json
{
  "message": "The given data was invalid.",
  "error": "validation_failed",
  "errors": {
    "quantity": ["Received quantity must be at least 1."],
    "product_id": ["That product does not belong to your business."]
  }
}
```

### Insufficient stock

The one business-rule failure with a dedicated code, because the UI handles it
specially — it shows the real available figure rather than a generic field error.

```json
{
  "message": "Not enough stock for Brass hinge, 75mm (FS-1042): 50 requested but only 34 available.",
  "error": "insufficient_stock",
  "errors": { "quantity": ["Only 34 available."] },
  "context": {
    "product_id": 14,
    "product_sku": "FS-1042",
    "requested": 50,
    "available": 34
  }
}
```

A withdrawal that would go negative is rejected **in full**, inside the
transaction. It never partially fulfils, and it never writes a ledger line.

---

## Authentication

### `POST /auth/register`

Creates a business and its first Owner, provisions the three default roles, and
returns a token — so the caller lands straight in a working dashboard. Throttled
to 6 per hour per IP to keep automated tenant creation impractical.

```json
{
  "business_name": "Fast Sold LLC",
  "name": "Dana Okafor",
  "email": "dana@example.com",
  "password": "a-long-passphrase",
  "industry": "wholesale",
  "timezone": "America/New_York",
  "currency": "USD"
}
```

`201 Created`:

```json
{
  "message": "Your business is ready.",
  "token": "12|kXb9…",
  "user": {
    "id": 1,
    "name": "Dana Okafor",
    "email": "dana@example.com",
    "initials": "DO",
    "role": { "value": "owner", "label": "Owner" },
    "permissions": ["dashboard.view", "products.view", "…"],
    "business": { "id": 1, "name": "Fast Sold LLC", "currency": "USD" }
  }
}
```

### `POST /auth/login`

Throttled 10/minute per IP by the route, plus 5 attempts per 5 minutes per
email+IP inside the controller. An unknown address and a wrong password return
the same message and take the same time — one hash comparison runs either way,
against a dummy hash when no account matches.

```json
{ "email": "dana@example.com", "password": "a-long-passphrase", "device_name": "web" }
```

`200 OK` returns the same `{ message, token, user }` shape as registration.
Signing in revokes previous tokens with the same `device_name`, so a token left
behind on a shared machine stops working. A deactivated user, or a user whose
business has been deactivated, is refused here rather than at the first API call.

### `GET /auth/me`

The current user with `permissions` resolved (role defaults, plus per-user
grants, minus per-user revocations, with owner-only keys filtered out). Call this
on app boot rather than trusting a cached copy.

### `POST /auth/logout` / `POST /auth/logout-all`

Revokes the current token, or every token belonging to the user.

---

## Permissions and roles

Each route carries a `permission:<key>` gate; controllers then run the matching
policy for the individual record, so a permission alone is never enough to reach
another tenant's data. The frontend mirrors these keys to decide what to
*render*, and that is the only thing it uses them for.

| Group | Keys |
| --- | --- |
| Dashboard | `dashboard.view` |
| Products | `products.view`, `products.manage`, `products.delete` |
| Categories | `categories.view`, `categories.manage` |
| Suppliers | `suppliers.view`, `suppliers.manage` |
| Inventory | `inventory.view`, `inventory.stock-in`, `inventory.stock-out`, `inventory.adjust` |
| Reports | `reports.view`, `reports.export` |
| Prices | `prices.view`, `prices.manage` |
| Notifications | `notifications.view` |
| Audit | `audit-logs.view` |
| Users | `users.view`, `users.manage` |
| Settings | `settings.view`, `settings.manage`, `roles.manage` |

**Owner-only.** `roles.manage`, `settings.manage`, `audit-logs.view` and
`users.manage` can never be granted to a Manager or Staff role, or to an
individual non-Owner user. They are excluded from the accepted input set rather
than silently dropped afterwards.

Default role sets:

| Role | Default permissions |
| --- | --- |
| **Owner** | Everything, implicitly. The Owner role is not editable. |
| **Manager** | Dashboard; products view+manage; categories view+manage; suppliers view+manage; inventory view, stock in, stock out, adjust; reports view+export; prices view+manage; notifications; users view. |
| **Staff** | Dashboard; products, categories, suppliers and inventory view; stock in; stock out; notifications. No adjustments, no exports, no price edits, no user management. |

---

## Dashboard

### `GET /dashboard`

One request returns everything the dashboard renders, so the page does not fan
out into a dozen round trips on load. Accepts `days` (clamped to 7–180, default
30) for the trend window.

```json
{
  "data": {
    "kpis": {
      "total_products": 94,
      "total_inventory_units": 18422,
      "low_stock_count": 7,
      "out_of_stock_count": 2,
      "stock_in_units": 4120,
      "stock_out_units": 3866,
      "stock_in_movements": 118,
      "stock_out_movements": 204,
      "adjustment_movements": 9,
      "active_suppliers": 11,
      "categories_count": 6
    },
    "movement_trend": [{ "date": "2026-08-13", "stock_in": 240, "stock_out": 186 }],
    "category_breakdown": [
      { "category": "Fasteners", "color": "#1E989F", "products": 18, "units": 4820 }
    ],
    "top_movers": [
      { "product_id": 14, "name": "Brass hinge, 75mm", "sku": "FS-1042", "units_out": 412 }
    ],
    "recent_stock_in": ["…StockMovement…"],
    "recent_stock_out": ["…StockMovement…"],
    "low_stock": ["…Product…"],
    "out_of_stock": ["…Product…"],
    "recent_activity": ["…AuditLog…"],
    "recent_notifications": ["…Notification…"],
    "period": { "days": 30, "from": "2026-08-12", "to": "2026-09-11" }
  }
}
```

The trend series is gap-filled: every day in the window is present, with zeros
where nothing moved, so the chart does not have to interpolate.

---

## Products

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/products` | `products.view` |
| POST | `/products` | `products.manage` |
| GET | `/products/{product}` | `products.view` |
| PUT/PATCH | `/products/{product}` | `products.manage` |
| POST | `/products/{product}/archive` | `products.delete` |
| POST | `/products/{product}/restore` | `products.delete` |
| DELETE | `/products/{product}` | `products.delete` |
| GET | `/products/{product}/ledger` | `inventory.view` |
| GET | `/products/{product}/movements` | `inventory.view` |
| GET | `/products/{product}/batches` | `inventory.view` |
| PUT | `/products/{product}/suppliers` | `products.manage` or `suppliers.manage` |

The list accepts the shared filters (`search`, `category_id`, `supplier_id`,
`stock_status`, `include_archived`, `include_inactive`, `sort`, `direction`) and
returns `meta.totals`.

`POST /products`:

```json
{
  "sku": "FS-1042",
  "name": "Brass hinge, 75mm",
  "barcode": "0764927318846",
  "description": "Satin finish, loose pin.",
  "category_id": 3,
  "unit": "each",
  "minimum_stock_level": 40,
  "reorder_quantity": 200,
  "supplier_ids": [2, 7],
  "is_active": true
}
```

`sku` is upper-cased on input, restricted to `A–Z 0–9 . _ - /`, and unique
**within the business** — two tenants may both use `FS-1042`. An `image` may be
sent as `multipart/form-data` (jpg/png/webp, ≤ 4 MB).

Note what is *not* in the payload: there is no `quantity_on_hand`. Quantity is
never set directly. It is the outcome of stock movements, and the only way to
change it is to record one.

`GET /products/{product}` loads the category, suppliers, current price with its
history, open batches with their suppliers, and batch/movement counts — enough
for the whole product detail page in one request.

### Delete vs archive

`DELETE` is a soft delete, and the policy permits it **only for a product that
has never moved**. A product with movement history returns `403 forbidden`;
history must not become unreadable because someone tidied up a product list.
Archiving is the intended route for a discontinued product: it leaves everything
intact and hides it from the default list, and `restore` brings it back.

---

## Categories

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/categories` | `categories.view` |
| POST | `/categories` | `categories.manage` |
| GET | `/categories/{category}` | `categories.view` |
| PUT/PATCH | `/categories/{category}` | `categories.manage` |
| POST | `/categories/{category}/archive` | `categories.manage` |
| DELETE | `/categories/{category}` | `categories.manage` |

```json
{ "name": "Fasteners", "description": "Screws, bolts, anchors.", "color": "#1E989F", "is_active": true }
```

Categories are flat — a single level, which keeps the list legible and the
queries unambiguous. `name` is unique within the business, and `color` is a hex
value used for the category chip in the UI. Deleting a category that still has
products returns `403`; reassign or archive instead. The list response reports
product counts and summed units per category.

---

## Suppliers

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/suppliers` | `suppliers.view` |
| POST | `/suppliers` | `suppliers.manage` |
| GET | `/suppliers/{supplier}` | `suppliers.view` |
| PUT/PATCH | `/suppliers/{supplier}` | `suppliers.manage` |
| DELETE | `/suppliers/{supplier}` | `suppliers.manage` |
| POST | `/suppliers/{supplier}/toggle-active` | `suppliers.manage` |
| GET | `/suppliers/{supplier}/batches` | `inventory.view` |
| GET | `/suppliers/{supplier}/movements` | `inventory.view` |

```json
{
  "name": "Harbour Metals Ltd",
  "code": "HARB",
  "contact_name": "Priya Raman",
  "email": "orders@harbourmetals.example",
  "phone": "+1 555 0143",
  "website": "https://harbourmetals.example",
  "address_line1": "4 Dockside Way",
  "address_line2": null,
  "city": "Newark",
  "state": "NJ",
  "postal_code": "07102",
  "country": "US",
  "default_lead_time_days": 14,
  "notes": "Pallet rate above 500 units.",
  "is_active": true,
  "product_ids": [14, 15]
}
```

`code` is optional and unique within the business; `country` is a two-letter
code. A supplier with batch history **cannot be deleted** — deactivate it
instead. That preserves non-negotiable rule 6: every receipt keeps its supplier
attribution forever.

---

## Inventory

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/inventory` | `inventory.view` |
| GET | `/inventory/ledger` | `inventory.view` |
| GET | `/inventory/movements` | `inventory.view` |
| GET | `/inventory/batches` | `inventory.view` |
| GET | `/inventory/products/{product}/availability` | `inventory.view` |
| POST | `/inventory/adjustments` | `inventory.adjust` |

### `GET /inventory`

The current position per product — quantity on hand, stock status, batch counts —
with `meta.totals`. Accepts the shared filters.

### `GET /inventory/batches`

Open batches, oldest received first: the FIFO queue itself. Exhausted batches are
hidden unless `include_depleted=1`.

### `GET /inventory/ledger`

The append-only ledger, newest first (default 50 per page). Accepts
`product_id`, `supplier_id`, `type`, `date_from`, `date_to`, `search`.

```json
{
  "id": 9043,
  "type": { "value": "stock_out", "label": "Stock out" },
  "quantity_change": -18,
  "balance_after": 34,
  "reference": "SO-2026-0091",
  "notes": null,
  "occurred_at": "2026-09-11T14:02:51+00:00",
  "meta": null,
  "product": { "id": 14, "sku": "FS-1042", "name": "Brass hinge, 75mm" },
  "supplier": { "id": 2, "name": "Harbour Metals Ltd" },
  "batch": { "id": 77, "batch_number": "B-2026-0412" },
  "user": { "id": 4, "name": "Sam Reyes" },
  "movement_id": 5120,
  "created_at": "2026-09-11T14:02:51+00:00"
}
```

One ledger line **per batch touched**. A withdrawal that spans three batches
writes three lines, each with its own `balance_after`, so the running balance is
continuous and every unit is traceable to the batch it came from.
`quantity_change` is signed: positive for IN, negative for OUT, either sign for
an adjustment.

There is no `PUT`, `PATCH` or `DELETE` on this resource. A wrong verb returns
`405`; an update forced at the model layer throws and surfaces as
`409 immutable_record`.

### `GET /inventory/products/{product}/availability`

```json
{
  "data": {
    "product_id": 14,
    "sku": "FS-1042",
    "quantity_on_hand": 104,
    "available": 104,
    "minimum_stock_level": 40,
    "stock_status": "in_stock"
  }
}
```

`quantity_on_hand` is the denormalised cache on the product row; `available` is
summed from the batch rows, which are the source of truth. They agree unless
something has gone wrong — which is exactly what `php artisan inventory:reconcile`
checks for.

### `POST /inventory/adjustments`

For a stock count correction, damage, loss or shrinkage.

```json
{
  "product_id": 14,
  "quantity_delta": -6,
  "reason": "Damaged in transit; photographed.",
  "reference": "COUNT-2026-09",
  "occurred_at": "2026-09-11T09:00:00Z",
  "notes": "Crate 4 of 9."
}
```

`quantity_delta` is signed and may not be zero. `reason` is **required** (3–128
characters) — an unexplained adjustment is the one thing a stock audit can never
reconstruct afterwards.

A negative delta consumes batches in FIFO order and is rejected with
`insufficient_stock` if it would go below zero. A positive delta opens a new
batch marked as adjustment-sourced, so it is never mistaken for a supplier
receipt. Either way the adjustment **appends**; it never edits the past.

---

## Stock IN

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/stock-in` | `inventory.view` |
| POST | `/stock-in` | `inventory.stock-in` |

```json
{
  "product_id": 14,
  "quantity": 200,
  "supplier_id": 2,
  "batch_number": "B-2026-0412",
  "reference": "PO-8841",
  "unit_cost": 1.85,
  "received_at": "2026-09-10T11:30:00Z",
  "expires_at": "2027-09-10",
  "notes": "Two pallets, one short-shipped."
}
```

`201 Created` with the movement, its batch, and the new balance. One transaction
creates the batch, the movement and the ledger line, and increases
`quantity_on_hand`; if any part fails, none of it happened.

`batch_number` is optional and generated if omitted; supplied, it must be unique
within the business. `received_at` may not be in the future and is what orders
the FIFO queue — so back-dating a receipt correctly places it *behind* batches
already received.

`unit_cost` is reference information only. It is recorded on the batch and shown
in reports, and has no effect on quantities, on FIFO order, or on any balance.
This is not an inventory valuation system.

---

## Stock OUT

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/stock-out` | `inventory.view` |
| POST | `/stock-out` | `inventory.stock-out` |
| GET | `/stock-out/preview` | `inventory.stock-out` |

```json
{
  "product_id": 14,
  "quantity": 70,
  "reference": "SO-2026-0091",
  "reason": "Workshop issue",
  "occurred_at": "2026-09-11T14:02:51Z",
  "notes": null
}
```

**There is no batch selector.** Which batches are consumed is decided by the
backend, oldest received first, under a row lock. Availability is *not* validated
at request time — it is checked inside the transaction, because a check made
during validation would already be stale by the time the write happens.

`201 Created` reports what was actually consumed:

```json
{
  "message": "Stock out recorded.",
  "data": {
    "id": 5120,
    "type": { "value": "stock_out", "label": "Stock out" },
    "direction": "out",
    "quantity": 70,
    "signed_quantity": -70,
    "balance_after": 34,
    "reference": "SO-2026-0091",
    "allocations": [
      {
        "batch_id": 77,
        "batch_number": "B-2026-0412",
        "batch_received_at": "2026-08-02T09:00:00+00:00",
        "quantity": 52
      },
      {
        "batch_id": 81,
        "batch_number": "B-2026-0455",
        "batch_received_at": "2026-08-19T09:00:00+00:00",
        "quantity": 18
      }
    ]
  }
}
```

### `GET /stock-out/preview?product_id=14&quantity=70`

The same allocation calculated without writing anything, so the form can show
which batches will be hit before the user commits.

```json
{
  "data": {
    "available": 104,
    "sufficient": true,
    "allocations": [
      {
        "batch_id": 77,
        "batch_number": "B-2026-0412",
        "received_at": "2026-08-02T09:00:00+00:00",
        "supplier": "Harbour Metals Ltd",
        "quantity_remaining": 52,
        "quantity_taken": 52,
        "depletes_batch": true
      },
      {
        "batch_id": 81,
        "batch_number": "B-2026-0455",
        "received_at": "2026-08-19T09:00:00+00:00",
        "supplier": "Northgate Supply",
        "quantity_remaining": 140,
        "quantity_taken": 18,
        "depletes_batch": false
      }
    ]
  }
}
```

The preview is advisory. The authoritative allocation happens inside the write
transaction, and a concurrent withdrawal between preview and submit changes the
outcome. The preview response is never passed back as input to the write.

---

## Price catalogue

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/price-catalog` | `prices.view` |
| POST | `/price-catalog` | `prices.manage` |
| GET | `/price-catalog/products/{product}/history` | `prices.view` |
| GET | `/price-catalog/{price}` | `prices.view` |
| DELETE | `/price-catalog/{price}` | `prices.manage` |

A separate reference catalogue. The constraint is architectural, not incidental:

> Prices do not control quantity, do not affect FIFO order, and do not enter any
> balance or ledger calculation. Changing a price changes nothing about stock.

```json
{
  "product_id": 14,
  "reference_price": 4.2,
  "currency": "USD",
  "effective_from": "2026-09-01",
  "source": "Q4 supplier list",
  "notes": "Pallet rate excluded."
}
```

There is deliberately **no quantity field anywhere in this request**. An `image`
may be attached as `multipart/form-data` for a reference photo.

Each product has one current price row. Posting a new price supersedes the
current one and writes the previous values to the price history, so the record of
what was listed when survives. `DELETE` removes a price row and leaves every
quantity exactly as it was.

---

## Reports and CSV export

All report endpoints require `reports.view`. Export additionally requires
`reports.export` — being allowed to look at a report and being allowed to take
the whole dataset out of the platform are different acts.

| Path | Report |
| --- | --- |
| `GET /reports/inventory-summary` | Current stock by product, with category and supplier. Adds `meta.totals`. |
| `GET /reports/stock-in` | Receipts over a period. Adds `meta.totals`. |
| `GET /reports/stock-out` | Withdrawals over a period. Adds `meta.totals`. |
| `GET /reports/product-movement` | All movement types together, filterable by `type`. |
| `GET /reports/low-stock` | At or below minimum stock level. |
| `GET /reports/out-of-stock` | Zero on hand. |
| `GET /reports/suppliers` | Receipt volume and product count per supplier. |
| `GET /reports/ledger` | The full ledger as a report, with the same filters. |
| `GET /reports/price-history` | Reference price changes over a period. |

Every report takes the shared filters relevant to it, and every report exports
through the same streaming path — so adding a report means adding a query and a
row mapper, not a new export mechanism.

### `GET /reports/{report}/export`

`{report}` is one of the nine slugs above; anything else is `404`.

```
Content-Type: text/csv; charset=UTF-8
Cache-Control: no-store
Content-Disposition: attachment; filename="fastsold-inventory-summary-2026-09-11.csv"
```

Rows are chunked by id and streamed rather than buffered, so a large export does
not pull the table into memory. The frontend fetches this with the bearer token
attached and turns the response into a blob, which is why the export button shows
a spinner rather than navigating away.

---

## Notifications

All under `permission:notifications.view`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | Filters: `type`, `unread_only=1`, `per_page` (5–100, default 25). Adds `meta.unread_count`. |
| GET | `/notifications/unread-count` | `{ "data": { "unread_count": 3 } }` — drives the bell badge. |
| POST | `/notifications/read-all` | Returns `{ "marked": n, "unread_count": 0 }`. |
| POST | `/notifications/{notification}/read` | Returns the new `unread_count`. |

Notifications are generated by the backend when stock crosses a threshold (low
stock, out of stock), when a batch nears expiry, when a product is missing
reference data, and on significant account events.

Some notifications are business-wide and some are addressed to one user. Marking
a personal notification belonging to someone else returns `404`, even inside the
same business.

---

## Audit logs

Owner-only (`audit-logs.view`), and read-only at every layer.

| Method | Path |
| --- | --- |
| GET | `/audit-logs` |
| GET | `/audit-logs/filters` |

Filters: `search`, `action`, `category`, `user_id`, `date_from`, `date_to`,
`per_page` (5–200, default 30).

`GET /audit-logs/filters` returns the option lists for the filter bar — every
action with its label and category, the distinct categories, and the users who
actually appear in this tenant's log — so the UI never has to guess what exists.

Each entry records who acted (id **and** a denormalised name, so the trail
survives the user being deleted), what they acted on, the action, a human
description, the before/after values where relevant, and the IP and user agent.
There is no write endpoint: `POST /audit-logs` returns `405`.

---

## Users

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/users` | `users.view` |
| POST | `/users` | `users.manage` |
| GET | `/users/{user}` | `users.view` |
| PUT/PATCH | `/users/{user}` | `users.manage` |
| DELETE | `/users/{user}` | `users.manage` |
| GET | `/users/{user}/activity` | `users.view` |

```json
{
  "name": "Sam Reyes",
  "email": "sam@example.com",
  "password": "a-long-passphrase",
  "password_confirmation": "a-long-passphrase",
  "role": "staff",
  "job_title": "Warehouse lead",
  "phone": "+1 555 0188",
  "permissions": ["reports.export"],
  "must_change_password": true,
  "is_active": true
}
```

Passwords require at least 10 characters with mixed case and a digit. Email is
globally unique: a person signs in with one address and belongs to exactly one
business. `role` is validated against the roles the **actor** is allowed to
assign, so a Manager cannot mint an Owner. `permissions` holds per-user grants on
top of the role, and owner-only keys are rejected outright.

Guard rails enforced server-side, not in the UI: the last active Owner cannot be
demoted, deactivated or deleted; nobody may change their own role; and `{user}`
resolves only within the caller's business, so an id from another tenant is
`404`.

---

## Settings

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/settings/profile` | — (always your own) |
| PUT/PATCH | `/settings/profile` | — |
| PUT | `/settings/password` | — |
| GET | `/settings/business` | `settings.view` |
| PUT/PATCH | `/settings/business` | `settings.manage` |
| GET | `/settings/permissions` | `settings.view` |
| GET | `/settings/roles` | `roles.manage` |
| PUT | `/settings/roles/{role}` | `roles.manage` |

`PUT /settings/password` takes `current_password`, `password` and
`password_confirmation`, and revokes every other token on success.

`GET /settings/permissions` returns the permission catalogue grouped for display:

```json
{
  "data": [
    {
      "group": "Inventory",
      "permissions": [
        { "key": "inventory.view", "label": "View inventory and ledger", "owner_only": false },
        { "key": "inventory.adjust", "label": "Adjust inventory", "owner_only": false }
      ]
    }
  ]
}
```

`GET /settings/roles` returns all three roles with `key`, `label`,
`description`, `is_editable` and their current `permissions`, plus the same
`catalogue` — everything the role matrix screen needs in one request.

`PUT /settings/roles/{role}` replaces one role's permission set:

```json
{ "permissions": ["dashboard.view", "products.view", "inventory.view"] }
```

`{role}` must be `manager` or `staff`. `owner` is rejected with `422` — Owners
hold every permission by definition — and owner-only keys are rejected for the
other two. `permissions` must be present; an empty array is valid and strips the
role back to nothing.

---

## Rate limits

| Scope | Limit |
| --- | --- |
| Authenticated API | 180 requests/minute per user |
| Unauthenticated API | 40 requests/minute per IP |
| `POST /auth/login` | 10/minute per IP, plus 5 per 5 minutes per email+IP |
| `POST /auth/register` | 6/hour per IP |

Throttled responses carry `Retry-After` alongside the standard
`X-RateLimit-Limit` and `X-RateLimit-Remaining` headers.
