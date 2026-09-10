# Fast Sold LLC — Inventory Management SaaS

A multi-tenant inventory management platform for businesses: products, suppliers,
stock in, stock out, FIFO batch tracking, an immutable inventory ledger, reports,
notifications, audit logging and role-based access control.

```
Next.js frontend  ──REST──▶  Laravel API  ──▶  PostgreSQL
```

The frontend never talks to the database. All business logic — authentication,
authorisation, tenant isolation, FIFO consumption, ledger writes — lives in
Laravel.

---

## Repository layout

```
frontend/        Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
backend/         Laravel 12 REST API (PHP 8.2+)
docs/            Architecture, API reference, design system, deployment guide
```

| Document | What it covers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, tenant isolation, the FIFO engine, database schema, the decisions behind them |
| [docs/API.md](docs/API.md) | Every endpoint, its permission, request and response shapes |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Brand, colour, type, spacing, component inventory |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub → Hostinger → Supabase PostgreSQL, step by step |

---

## Getting started

### Prerequisites

- PHP 8.2+ with the `pdo_pgsql` extension
- Composer 2
- Node.js 20+
- A PostgreSQL database (only needed once you want real data — see below)

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Run the test suite — this needs no database server at all, because the tests run
against in-memory SQLite:

```bash
php artisan test
```

Start the API:

```bash
php artisan serve          # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                # http://localhost:3000
```

`.env.local` ships with `NEXT_PUBLIC_DEMO_MODE=true`, which renders every screen
from bundled demo data so the interface can be developed and reviewed before a
database exists. Set it to `false` to talk to the live Laravel API.

### Working with real data

Point `backend/.env` at a PostgreSQL database, then:

```bash
cd backend
php artisan migrate
php artisan db:seed                               # permission catalogue (safe in production)
php artisan db:seed --class=DemoDataSeeder        # optional demo tenant, local only
```

The demo seeder creates a fully consistent tenant — every quantity it writes goes
through the real inventory service, so batches, allocations and the ledger all
agree. It signs you in as:

| Email | Role |
| --- | --- |
| `owner@fastsold.test` | Owner |
| `manager@fastsold.test` | Manager |
| `staff@fastsold.test` | Staff |

Password for all three: `Demo-Password-42`. The seeder refuses to run in
production.

---

## The rules this system guarantees

These are enforced in the backend and covered by tests, not left to the UI:

1. **Inventory quantity can never go negative.** Availability is re-read inside
   the write transaction under a row lock, so two concurrent withdrawals cannot
   both spend the same stock.
2. **Stock out consumes the oldest batch first (FIFO).** The decision is made in
   `InventoryService` and recorded in `stock_movement_allocations`, so it is
   auditable after the fact, not just correct at the time.
3. **Every inventory change is transactional.** A failure anywhere leaves
   quantities, batches, movements and the ledger untouched.
4. **The ledger and audit log are append-only.** The models refuse updates and
   deletes; corrections are made by recording a compensating adjustment.
5. **Reference pricing never touches inventory.** Prices live in their own
   service and tables, and changing one cannot change a quantity.
6. **Tenant A can never reach Tenant B's data.** A global query scope confines
   every read, a model hook stamps every write, validation rejects foreign ids,
   and policies check ownership again.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how each of these is
implemented.

---

## Useful commands

```bash
# Backend
php artisan test                          # full suite, no database server needed
php artisan inventory:reconcile --dry-run # verify quantity caches against batch rows
php artisan tenants:sync-roles            # after deploying a new permission
./vendor/bin/pint                         # format PHP

# Frontend
npm run build                             # production build
npm run typecheck                         # TypeScript, no emit
npm run lint                              # ESLint
```

## Deployment

Deployment is GitHub → Hostinger, with Supabase PostgreSQL as the production
database, configured entirely through Hostinger's environment variables.
No credentials belong in this repository.

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) walks through it.
