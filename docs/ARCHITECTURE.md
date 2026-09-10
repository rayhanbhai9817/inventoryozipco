# Architecture

Fast Sold LLC is a multi-tenant inventory management SaaS. This document records
the design and, where a choice was not obvious, the reasoning behind it.

```
┌──────────────────────────┐
│  Next.js frontend        │  App Router, React 19, TypeScript, Tailwind 4
│  (its own origin)        │  Renders UI. Holds no business rules.
└───────────┬──────────────┘
            │  HTTPS + Bearer token (Sanctum PAT)
            ▼
┌──────────────────────────┐
│  Laravel 12 REST API     │  /api/v1/*
│                          │  Auth · RBAC · tenant isolation · FIFO · ledger
└───────────┬──────────────┘
            │  PDO (pgsql)
            ▼
┌──────────────────────────┐
│  PostgreSQL              │  Supabase in production, via Hostinger env vars
└──────────────────────────┘
```

The frontend has no database access and no credentials. Every rule below is
enforced server-side; the UI mirrors permissions only to decide what to *render*.

---

## 1. Tenant isolation

A **business** is the tenant. Every tenant-owned table carries `business_id`.
Isolation is implemented in four independent layers, so a mistake in one does not
become a data leak.

### Layer 1 — the tenant is never taken from the client

`ResolveTenant` middleware reads the business from the **authenticated user's own
`business_id`** and nowhere else: not a header, not a query parameter, not a
subdomain. A client therefore has no mechanism by which to *ask* for another
tenant. The same middleware rejects deactivated users and suspended businesses, so
revoking access takes effect on the next request even while the token is still
valid.

### Layer 2 — a global query scope

`BusinessScope` is applied by the `BelongsToBusiness` trait to every tenant-owned
model. It constrains reads, relationship loads, aggregates and sub-queries alike,
so a controller that forgets `where('business_id', …)` still cannot see another
tenant's rows.

It **fails closed**: with no tenant resolved the scope applies `1 = 0` rather than
returning everything. Console commands, seeders and the registration flow opt out
explicitly through `TenantContext::unscoped()`, which is deliberately verbose so
it stands out in review.

> **Ordering note.** Route model binding runs inside the middleware pipeline and
> queries the model, so the tenant scope has to be active *before* it. Route-level
> middleware normally runs after the group's, which would make every
> `/products/{id}` request 404 for its own tenant. `bootstrap/app.php` therefore
> pins `Authenticate → ResolveTenant → SubstituteBindings` in the priority list.
> There is a regression test for this, because the failure mode is silent.

### Layer 3 — writes are stamped, not trusted

The same trait hooks `creating` and stamps `business_id` from the tenant context,
so a write cannot be mis-attributed even if a payload tries.

### Layer 4 — validation and policies

Form Requests use tenant-scoped `exists` rules
(`Rule::exists('products', 'id')->where('business_id', $businessId)`), so a
foreign id fails validation before any service code runs. Policies then check
ownership again via `ScopedToBusiness`.

A cross-tenant id resolves to **404, never 403** — a 403 would confirm that the
record exists somewhere on the platform.

---

## 2. Authentication and authorisation

### Authentication

Laravel Sanctum personal access tokens. The API is stateless: `statefulApi()` is
deliberately **not** enabled, because the frontend is served from its own origin
and cookie-based auth would add a CSRF surface this design does not need.

Hardening on the login endpoint:

- Route throttle (10/min) plus a per-`email+IP` limiter (5 attempts, 5-minute
  decay).
- One generic failure message whether the address is unknown or the password is
  wrong, with a dummy hash comparison on the unknown-address path so response
  time does not reveal which it was.
- `remember me` extends token life to 30 days; otherwise 12 hours.
- Signing in revokes previous tokens for the same device name.
- Changing a password revokes every *other* token.

### Authorisation — three roles, tunable permissions

Roles are a closed enum (`Owner`, `Manager`, `Staff`) because they are the coarse
authorisation boundary. Fine-grained capability tuning happens through
permissions, not by inventing roles at runtime.

| Table | Purpose |
| --- | --- |
| `permissions` | Global catalogue, seeded from the `Permission` enum |
| `roles` | One row **per business per role**, so each tenant can tune its own Manager and Staff without affecting anyone else |
| `permission_role` | The editable matrix |
| `permission_user` | Per-user grants/revocations layered on top of the role |

Effective permissions = *role set* **+** explicit user grants **−** explicit user
revocations. `permission_user` stores only **deviations** from the role default,
so a later change to a role's matrix still reaches that user.

Two invariants hold regardless of stored data:

- An **Owner always holds every permission** inside their own business (resolved
  in code, not from the matrix).
- **Owner-only permissions** (`roles.manage`, `settings.manage`,
  `audit-logs.view`, `users.manage`) can never be reached by a non-owner. Even if
  a row is forced into `permission_role` directly in the database, the resolver
  filters it out. There is a test that does exactly that.

`UserPolicy` adds three safety rules so a business cannot lock itself out or
escalate privileges: nobody changes their own role or deactivates themselves; a
user may only assign roles at or below their own; and the last active Owner cannot
be demoted, deactivated or deleted.

Enforcement is two-layered on every route: `permission:<key>` middleware gates the
capability, then the controller calls a policy for the specific record. Both must
agree.

---

## 3. The inventory engine

`App\Services\Inventory\InventoryService` is the **single writer** of inventory
state. Nothing else — no controller, no command, no future feature — writes a
quantity.

### Quantities are integers

A deliberate choice. Quantities are whole numbers of the product's unit of
measure. This makes FIFO arithmetic exact, removes a class of rounding bugs that
can strand fractional remainders in a batch, and matches how resellers actually
count stock. A business needing fractional weight models it by choosing a smaller
unit (grams rather than kilograms).

### Stock in

Opens a new `stock_batches` row — the unit of FIFO consumption — increases the
product's quantity, writes a `stock_movements` row and appends one ledger entry.
`unit_cost` is captured for traceability of what was paid, and is **never** used
for inventory valuation anywhere in the application.

### Stock out — FIFO

1. Lock the product row (`FOR UPDATE` on PostgreSQL).
2. Compute availability by summing `quantity_remaining` across open batches —
   **not** by trusting the denormalised `products.quantity_on_hand` cache, so a
   drifted cache can never authorise a withdrawal the batches cannot satisfy.
3. Refuse with `InsufficientStockException` (422, carrying the real available
   quantity) if the request exceeds it.
4. Lock the candidate batches in FIFO order (`received_at`, then `id` as a
   deterministic tie-breaker) and consume oldest-first.
5. Write one `stock_movement_allocations` row and one ledger line per batch
   touched, each carrying the running balance.

All of it inside one transaction. A request that loses a race blocks on the lock,
then sees the updated quantity and fails cleanly rather than overselling.

### Adjustments

A signed delta. Positive opens a new batch dated now, so it sits at the *end* of
the FIFO queue. Negative consumes existing batches FIFO and is subject to the same
non-negative guarantee. A reason is mandatory — an unexplained adjustment is the
one thing a stock audit can never reconstruct afterwards.

### Defence in depth on the non-negative rule

| Layer | Mechanism |
| --- | --- |
| Application | Availability checked under a lock inside the transaction |
| Application | `writeQuantityOnHand()` refuses a negative value outright |
| Schema | `quantity_on_hand`, `quantity_received`, `quantity_remaining` are `UNSIGNED` |
| Schema (PostgreSQL) | `CHECK` constraints: remaining ≤ received, received > 0, movement quantity > 0, direction ∈ (−1, 1) |

SQLite cannot add constraints to an existing table, so the `CHECK` migration
applies on PostgreSQL and is skipped elsewhere; the test suite asserts the same
rules at the service layer.

### The quantity cache

`products.quantity_on_hand` is a denormalised sum, maintained only inside the same
transaction as the batch rows. It exists so that listing and dashboard queries can
filter and sort on an indexed column instead of aggregating batches. Because the
batch rows remain authoritative for every *decision*, the cache is a performance
detail rather than a correctness risk — and `php artisan inventory:reconcile`
verifies or repairs it.

---

## 4. The inventory ledger

`inventory_ledger_entries` is append-only:

- no `updated_at` column,
- the `Immutable` trait makes the model throw on update and delete,
- no route exposes a write.

One row per batch-level effect of every change, carrying `quantity_change`
(signed) and `balance_after`. Corrections are made by recording a compensating
adjustment, never by editing history. `audit_logs` works the same way.

---

## 5. Pricing is a reference catalogue

This is the separation the specification insists on, so it is structural rather
than conventional:

- `PriceCatalogService` reads and writes **only** `product_prices` and
  `product_price_history`. It imports no inventory model.
- The price endpoints accept no quantity field at all.
- A test asserts that setting a price leaves quantity, batches, movements and the
  ledger byte-identical.

Two tables with distinct jobs rather than duplicated data:

| Table | Job |
| --- | --- |
| `product_prices` | The single current reference price per product |
| `product_price_history` | Append-only record of every price that has been in effect, with `effective_from`/`effective_to` |

Recording a new price closes the open history window. That closing stamp is the
only field ever written to an existing history row.

---

## 6. Database schema

Tenant-owned tables (all carry `business_id`):

```
businesses ─┬─ users ──── permission_user ─── permissions
            │    └─ roles ─── permission_role ──┘
            ├─ categories ──┐
            ├─ suppliers ───┼─ supplier_product ─── products
            │               │                         │
            │               └─ stock_batches ─────────┤
            │                     │                   │
            │                     ├─ stock_movements ─┤
            │                     │      │            │
            │                     │      └─ stock_movement_allocations
            │                     └─ inventory_ledger_entries
            ├─ product_prices ─── product_price_history
            ├─ notifications ─── notification_reads
            └─ audit_logs
```

Notable indexing decisions:

- `stock_batches (business_id, product_id, received_at, id)` — the FIFO cursor.
- On PostgreSQL, a **partial** index with `WHERE quantity_remaining > 0`, because
  FIFO only ever scans batches that still hold stock.
- `products (business_id, quantity_on_hand)` — low-stock and out-of-stock
  dashboard queries.
- `inventory_ledger_entries (business_id, product_id, occurred_at, id)` — the
  product timeline, with `id` making the running-balance column read consistently.
- Per-tenant uniqueness: `(business_id, sku)`, `(business_id, slug)`,
  `(business_id, code)` — two businesses may each use "SKU-001".

Deletion policy: anything with history is **archived**, not deleted. Policies
refuse to delete a product with movements, a category with products, or a supplier
that has supplied a batch, so the ledger never points at a row that no longer
exists. Users are soft-deleted so audit attribution stays resolvable.

---

## 7. API conventions

Base path `/api/v1`. Layered per request: `auth:sanctum` → `tenant` →
`permission:<key>` → policy.

Errors always return JSON with a human `message` and, where useful, a
machine-readable `error` code. Validation keeps Laravel's `errors` shape so the
frontend maps it straight onto inline field errors. In production, unhandled
exceptions become a friendly 500 and the real exception goes to the log.

| Situation | Status | `error` |
| --- | --- | --- |
| No/expired token | 401 | `unauthenticated` |
| Lacks permission | 403 | `forbidden` |
| Unknown or cross-tenant record | 404 | `not_found` |
| Validation failure | 422 | `validation_failed` |
| Not enough stock | 422 | `insufficient_stock` (+ available quantity) |
| Write attempted on history | 409 | `immutable_record` |
| Rate limited | 429 | — |

Rate limiting is keyed on the authenticated user (180/min) so one tenant's traffic
cannot exhaust another's budget, falling back to IP (40/min) when unauthenticated.

CSV export is a **separate permission** from viewing a report: seeing a report and
being able to take the whole dataset out of the platform are different acts.
Exports stream via `lazyById`, so an export never buffers the full result set.

Full endpoint reference: [API.md](API.md).

---

## 8. Code organisation

### Backend

```
app/
  Enums/          Role, Permission, MovementType, NotificationType, AuditAction,
                  ProductUnit, StockStatus — closed sets, with behaviour on them
  Data/           Readonly input objects (StockInData, StockOutData, …) so
                  services have typed contracts, not arrays
  Models/
    Concerns/     BelongsToBusiness (tenancy), Immutable (append-only)
    Scopes/       BusinessScope
  Services/
    Inventory/    InventoryService — the only writer of inventory state
    Pricing/      PriceCatalogService — isolated from inventory by construction
    Audit/        AuditLogger, with a redaction list
    Notifications/NotificationService, with alert de-duplication
    Reports/      ReportService, DashboardService
    Tenancy/      BusinessRegistrationService, RoleProvisioner
  Policies/       Per-model authorisation
  Http/
    Middleware/   ResolveTenant, EnsurePermission
    Requests/     Validation, grouped by feature
    Resources/    Response shaping
    Controllers/Api/V1/
  Support/        TenantContext
```

Controllers stay thin: authorise, delegate to a service, shape a response.

> **On resources and strict models.** The app runs with
> `preventLazyLoading`, `preventAccessingMissingAttributes` and
> `preventSilentlyDiscardingAttributes` enabled outside production. That is why
> nested references use compact `*SummaryResource` classes whose fields match the
> column-limited eager loads exactly, and why store endpoints serialise a
> reloaded model — a freshly created model only carries the attributes that were
> written.

### Frontend

```
src/
  app/
    (marketing)/  Public landing page
    (auth)/       Sign in, register
    (app)/        Authenticated dashboard shell and every module
  components/
    ui/           Design-system primitives
    layout/       Shell, sidebar, topbar, mobile drawer
    marketing/    Landing-page sections
  lib/            API client, auth, formatting, utilities
  types/          Shared TypeScript types mirroring API resources
  mocks/          Demo data, clearly isolated from production paths
```

---

## 9. Testing

`php artisan test` runs against **in-memory SQLite** and needs no database
server — the project has no local database requirement at all.

The suite concentrates on the rules that matter rather than on coverage
percentage:

| Area | What is asserted |
| --- | --- |
| FIFO engine | Oldest batch first; allocations recorded; ledger balance descends correctly; exact-quantity withdrawal empties cleanly; adjustments both directions |
| Non-negative stock | Over-withdrawal refused with the real available quantity; the whole transaction rolls back; a drifted cache cannot authorise it |
| Tenant isolation | Queries, API index, detail routes, scoped bindings, validation, ledger; fail-closed with no tenant; suspended business and deactivated user blocked |
| RBAC | Role defaults; per-user grant and revoke; owner-only permissions unreachable even when forced into the database; self-demotion and last-owner protection |
| Pricing separation | Setting a price leaves every inventory table unchanged; history windows; a quantity field in the payload has no effect |
| Immutability | Ledger and audit rows reject update and delete; no write route exists |
| Auth | Registration provisions roles; account enumeration resistance; throttling; password change revokes other sessions |

Because SQLite has no row-level locking, the lock is skipped there (its
transactions serialise at the file level, which gives the same guarantee for these
tests) and taken for real on PostgreSQL.

---

## 10. Deliberately not built

POS, sales, customers, accounting, payroll, HR, storefront, payment gateway, CRM.
The scope is inventory management. Pricing exists only as reference data.
