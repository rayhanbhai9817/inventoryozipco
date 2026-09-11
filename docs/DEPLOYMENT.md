# Deployment

GitHub → Hostinger, with Supabase PostgreSQL as the production database.

```
 GitHub repository
        │  git pull / auto-deploy webhook
        ▼
 ┌─────────────────────────┐        ┌──────────────────────────┐
 │  Hostinger              │        │  Supabase                │
 │                         │        │                          │
 │  Next.js  (Node)        │        │  PostgreSQL              │
 │     │ HTTPS REST        │        │     ▲                    │
 │     ▼                   │        │     │ TLS, port 5432     │
 │  Laravel API  (PHP)  ───┼────────┼─────┘                    │
 └─────────────────────────┘        └──────────────────────────┘
```

**Supabase is used as PostgreSQL and nothing else.** Not its auth, not its
storage, not its row-level security, not its client library. There is no
`@supabase/supabase-js` in this project and the frontend has no database
credentials of any kind — it only knows the URL of the Laravel API. Swapping
Supabase for any other managed Postgres is a change to four environment
variables.

Read this before starting: [Security rules](#security-rules). They are short and
they are not negotiable.

---

## Contents

1. [Before you start](#before-you-start)
2. [Security rules](#security-rules)
3. [Step 1 — Push to GitHub](#step-1--push-to-github)
4. [Step 2 — Create the Supabase database](#step-2--create-the-supabase-database)
5. [Step 3 — Deploy the Laravel API to Hostinger](#step-3--deploy-the-laravel-api-to-hostinger)
6. [Step 4 — Run the migrations](#step-4--run-the-migrations)
7. [Step 5 — Deploy the Next.js frontend](#step-5--deploy-the-nextjs-frontend)
8. [Step 6 — Connect the two](#step-6--connect-the-two)
9. [Step 7 — Create the first account](#step-7--create-the-first-account)
10. [Environment variable reference](#environment-variable-reference)
11. [Redeploying](#redeploying)
12. [Operations](#operations)
13. [Troubleshooting](#troubleshooting)
14. [Go-live checklist](#go-live-checklist)

---

## Before you start

You need:

- The GitHub repository (this project).
- A Hostinger plan that can run **both** PHP 8.2+ and Node.js 20+. The Laravel
  API needs PHP with the `pdo_pgsql` extension; the Next.js frontend needs a Node
  runtime, because three routes are server-rendered on demand
  (`/products/[id]`, `/suppliers/[id]`, `/reports/[slug]`) — this is not a static
  export. A VPS plan runs both comfortably; on shared hosting, check that Node
  application hosting is included before you begin.
- A Supabase account (the free tier is enough to start).
- SSH access to the Hostinger server, or the hPanel terminal.
- Two hostnames decided in advance, e.g. `api.yourdomain.com` for the Laravel API
  and `app.yourdomain.com` (or the apex) for the frontend.

Hostinger and Supabase both change their control panels from time to time. The
panel labels below are a guide; the substance — which value goes where — is what
matters, and that does not change.

---

## Security rules

These apply at every step.

1. **Never commit a `.env` file.** `.gitignore` already blocks `.env` and
   `.env.*` while allowing `.env.example`. Do not work around it.
2. **`.env.example` files contain placeholders only.** Never paste a real value
   into one "temporarily".
3. **The database password exists in exactly two places:** the Supabase
   dashboard, and `backend/.env` on the Hostinger server. Not in the repository,
   not in a commit message, not in an issue, not in a chat message.
4. **Nothing prefixed `NEXT_PUBLIC_` is secret.** Those values are compiled into
   the JavaScript bundle and visible to anyone who opens the page. The frontend
   therefore has *no* database credentials — by design, not by oversight.
5. **`APP_KEY` is a secret.** It encrypts anything the framework encrypts.
   Generate it on the server; changing it later invalidates encrypted data.
6. **`APP_DEBUG=false` in production**, always. With it on, an unhandled
   exception returns the stack trace, the SQL, and fragments of configuration.
7. **`.env` on the server should be `chmod 600`** and owned by the deploy user.
8. **If a credential is ever exposed, rotate it.** Supabase can reset the
   database password; `php artisan key:generate` makes a new `APP_KEY`. Treat any
   value that reached a log, a screenshot or a commit as exposed.

---

## Step 1 — Push to GitHub

```bash
git add .
git commit -m "Fast Sold inventory platform"
git push -u origin main
```

Then confirm, in the GitHub web UI, that the repository contains **no** `.env`
file — only `backend/.env.example` and `frontend/.env.example`. If a `.env` was
ever committed, removing it in a later commit is not enough: the value is still
in the history, so rotate the credential as well.

---

## Step 2 — Create the Supabase database

1. In the Supabase dashboard, create a new project. Choose a region close to your
   Hostinger server — every API request becomes at least one database round trip,
   so this is the single biggest latency decision you will make.
2. Set a strong database password when prompted and store it in a password
   manager. Supabase shows it once.
3. Open the project's database connection settings. You will find more than one
   connection string; the difference matters:

| Connection | Typical port | Use it for |
| --- | --- | --- |
| **Direct connection** | 5432 | Migrations and one-off `artisan` commands. |
| **Session pooler** | 5432 | The application, on PHP. Laravel opens a connection per request and uses prepared statements, which session mode supports. |
| **Transaction pooler** | 6543 | *Not* this application. Transaction mode does not hold a session across statements, which breaks prepared statements and advisory locking patterns. |

Use the **session pooler** string for the running application. Copy the host,
port, database name and username exactly as the dashboard gives them — pooler
usernames are not simply `postgres`, they carry the project reference, and a
mismatch produces an authentication error that looks like a wrong password.

4. Nothing else needs configuring in Supabase. Do not create tables by hand, do
   not enable row-level security policies, do not use the SQL editor to insert
   data. The schema is owned by Laravel's migrations, and tenant isolation is
   enforced in the application — see [ARCHITECTURE.md](ARCHITECTURE.md). Two
   systems both claiming to own the schema is how data drifts.

---

## Step 3 — Deploy the Laravel API to Hostinger

### 3.1 Get the code onto the server

Either clone it:

```bash
cd ~/domains/api.yourdomain.com
git clone https://github.com/<owner>/<repo>.git .
```

…or use hPanel's Git deployment (Advanced → Git in most plans), which clones the
repository and can re-pull on a webhook when you push.

### 3.2 Install dependencies

```bash
cd backend
composer install --no-dev --optimize-autoloader
```

`--no-dev` matters: it leaves development tooling and the demo-data seeder's
dependencies out of the production install.

### 3.3 Create `.env` on the server

The `.env` file is created **on the server** and never enters the repository.

```bash
cp .env.example .env
chmod 600 .env
php artisan key:generate        # writes APP_KEY into .env
nano .env
```

Set these:

```ini
APP_NAME="Fast Sold LLC"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

# The frontend origin(s) allowed to call this API. Comma-separated.
FRONTEND_URL=https://app.yourdomain.com

# Supabase PostgreSQL — session pooler values from the dashboard
DB_CONNECTION=pgsql
DB_HOST=<from the Supabase dashboard>
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=<from the Supabase dashboard>
DB_PASSWORD=<your Supabase database password>
DB_SSLMODE=require

LOG_LEVEL=warning
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=file
SANCTUM_STATEFUL_DOMAINS=
```

`DB_SSLMODE=require` is mandatory. Without it the driver may negotiate an
unencrypted connection, putting the database password and every row on the wire
in clear text. `SANCTUM_STATEFUL_DOMAINS` stays empty: authentication is a bearer
token, not a session cookie, so there is no cross-site cookie to protect.

Configure `MAIL_*` when you want invitation and password-reset emails to actually
send; `MAIL_MAILER=log` writes them to the log file instead, which is fine until
you are ready.

### 3.4 Point the document root at `public/`

The web server must serve `backend/public`, not `backend`. Anything else exposes
`.env`, `storage/` and `vendor/` to the internet.

- **Shared hosting:** set the domain's document root to
  `domains/api.yourdomain.com/backend/public` in hPanel, or symlink
  `public_html` → `backend/public`.
- **VPS:** set `root /var/www/api/backend/public;` in the nginx server block.

Verify it before going further:

```bash
curl -I https://api.yourdomain.com/.env      # must be 403 or 404 — never 200
curl https://api.yourdomain.com/up           # the framework health check
```

If `/.env` returns its contents, stop, fix the document root, and rotate the
database password.

### 3.5 Permissions and caches

```bash
chmod -R 775 storage bootstrap/cache
php artisan storage:link          # product and reference images
php artisan config:cache
php artisan route:cache
php artisan event:cache
```

Re-run the cache commands after any change to `.env` or to configuration —
cached config ignores the file until you do.

### 3.6 Enable HTTPS

Issue a certificate for both hostnames (hPanel → SSL, or Let's Encrypt on a VPS)
and force HTTPS. The API carries bearer tokens in request headers; over plain
HTTP those are readable in transit.

---

## Step 4 — Run the migrations

This is the first moment anything touches the database.

```bash
cd backend
php artisan migrate --force
```

`--force` is required because `APP_ENV=production` makes Laravel ask for
confirmation, and there is no TTY in a deploy script.

Then seed the permission catalogue. This is reference data the application needs
— the permission keys and the three role definitions — and it is safe in
production:

```bash
php artisan db:seed --force
```

**Do not run `DemoDataSeeder` in production.** It refuses to run when
`APP_ENV=production`, and that guard is there because the alternative is fake
products in a real tenant's inventory.

Verify:

```bash
php artisan migrate:status           # every migration "Ran"
php artisan inventory:reconcile --dry-run   # "No discrepancies found."
```

---

## Step 5 — Deploy the Next.js frontend

### 5.1 Build

```bash
cd frontend
npm ci
cp .env.example .env.local
nano .env.local
```

```ini
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_APP_NAME="Fast Sold LLC"
NEXT_PUBLIC_DEMO_MODE=false
```

`NEXT_PUBLIC_DEMO_MODE=false` is the line that matters most here. Left at `true`,
the deployed app renders bundled demo data and never calls the API — a site that
looks perfect and is entirely fictional. Set it to `false`, and confirm after
deploying that the data you see is real.

These values are read at **build** time, so they must be set before `npm run
build`, and changing one means rebuilding.

```bash
npm run build
```

### 5.2 Run it

```bash
npm run start                 # serves on port 3000 by default
```

Keep it running across reboots and crashes with a process manager — PM2 or a
systemd unit on a VPS, or Hostinger's Node application manager if your plan
provides one:

```bash
pm2 start npm --name fastsold-web -- start
pm2 save
pm2 startup
```

Then reverse-proxy the hostname to it:

```nginx
server {
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Step 6 — Connect the two

The only link between the deployments is the API URL and the CORS allow-list, and
they have to agree exactly.

- `frontend/.env.local` → `NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1`
- `backend/.env` → `FRONTEND_URL=https://app.yourdomain.com`

`FRONTEND_URL` is the **origin** — scheme and host, no path and no trailing
slash. It accepts a comma-separated list if you run a staging frontend too:

```ini
FRONTEND_URL=https://app.yourdomain.com,https://staging.yourdomain.com
```

There is no wildcard fallback in `config/cors.php`. An unlisted origin is
refused rather than quietly allowed, so a CORS error after deploying almost
always means a typo here — `http` vs `https`, or a missing `www`.

After editing, `php artisan config:cache` again.

Check it end to end:

```bash
curl -i -X OPTIONS https://api.yourdomain.com/api/v1/auth/login \
  -H "Origin: https://app.yourdomain.com" \
  -H "Access-Control-Request-Method: POST"
# expect: access-control-allow-origin: https://app.yourdomain.com
```

---

## Step 7 — Create the first account

Open `https://app.yourdomain.com/register` and register. That flow creates the
business, its first Owner, and the three role definitions in one transaction, and
signs you in.

Every subsequent user is invited from **Settings → Users** by that Owner. There is
no second registration path into an existing business — self-registration creates
a new tenant, which is exactly what you do *not* want for a colleague.

Then verify the things that are cheap to check now and expensive to discover
later:

1. Create a product.
2. Record a stock IN with a supplier; confirm the quantity rises and a ledger line
   appears.
3. Record a stock OUT larger than you have; confirm it is refused with the real
   available figure.
4. Record a valid stock OUT spanning two batches; confirm the allocations consume
   the **oldest** batch first and the ledger shows one line per batch.
5. Export a report as CSV.
6. Check **Settings → Audit log** shows all of the above.

---

## Environment variable reference

### Backend (`backend/.env`, on the server, never committed)

| Variable | Production value | Notes |
| --- | --- | --- |
| `APP_ENV` | `production` | Disables the demo seeder and the strict-model development guards. |
| `APP_DEBUG` | `false` | Non-negotiable. |
| `APP_KEY` | generated | `php artisan key:generate`. Secret. |
| `APP_URL` | `https://api.yourdomain.com` | Used for absolute URLs, including image URLs. |
| `FRONTEND_URL` | `https://app.yourdomain.com` | CORS allow-list. Comma-separated for several. |
| `DB_CONNECTION` | `pgsql` | |
| `DB_HOST` | Supabase host | From the dashboard. |
| `DB_PORT` | `5432` | Session pooler or direct. Not 6543. |
| `DB_DATABASE` | `postgres` | Supabase's default database name. |
| `DB_USERNAME` | Supabase user | Copy exactly; pooler users include the project reference. |
| `DB_PASSWORD` | Supabase password | **Secret.** |
| `DB_SSLMODE` | `require` | Mandatory. |
| `SESSION_DRIVER` | `file` | The API is stateless; this is framework internals only. |
| `CACHE_STORE` | `database` | |
| `QUEUE_CONNECTION` | `database` | Needs a worker to process jobs — see Operations. |
| `SANCTUM_STATEFUL_DOMAINS` | *(empty)* | Token auth, no session cookies. |
| `LOG_LEVEL` | `warning` | `debug` in production fills the disk. |
| `MAIL_*` | your provider | `log` until configured. |

### Frontend (`frontend/.env.local`, build-time)

| Variable | Production value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com/api/v1` | Include `/api/v1`, no trailing slash. |
| `NEXT_PUBLIC_APP_NAME` | `Fast Sold LLC` | Display only. |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | **Must** be `false` in production. |

Everything here is public by definition. If you ever feel the need to add a
secret to this file, the feature belongs in the Laravel API instead.

---

## Redeploying

```bash
# Backend
cd backend
git pull origin main
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan event:cache
php artisan tenants:sync-roles        # only after adding a new permission

# Frontend
cd ../frontend
git pull origin main
npm ci
npm run build
pm2 restart fastsold-web
```

Notes that save an outage:

- **`tenants:sync-roles`** backfills a newly added permission onto existing
  tenants' role definitions. Without it, a new permission exists in code but no
  role holds it, and the feature looks broken for everyone.
- **Always re-run `config:cache`** after touching `.env`. Cached config does not
  re-read the file.
- **Migrations run before the new frontend goes live,** not after. The API
  tolerates an older frontend for a few seconds; a new frontend against an old
  schema produces 500s.
- **Take a database backup before a migration that drops or renames anything.**
  Supabase's automatic backups depend on your plan — check what yours actually
  retains before you need it.

---

## Operations

### Health checks

```bash
curl https://api.yourdomain.com/up                 # framework health
curl https://app.yourdomain.com                    # frontend responds
```

### Scheduled work

Low-stock and expiry notifications come from the scheduler. Add one cron entry
(hPanel → Cron Jobs, or `crontab -e`):

```cron
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

### Queue worker

`QUEUE_CONNECTION=database` means queued work waits for a worker. On a VPS:

```bash
pm2 start "php artisan queue:work --tries=3 --timeout=90" --name fastsold-queue
```

On shared hosting without long-running processes, a frequent cron running
`php artisan queue:work --stop-when-empty` is the usual substitute.

### Integrity check

```bash
php artisan inventory:reconcile --dry-run
```

Compares each product's cached `quantity_on_hand` against the sum of its batch
rows. It should always report no discrepancies; if it ever does not, that is a
bug worth investigating rather than quietly fixing. Run it weekly from cron and
have it mail you anything it finds.

### Logs

`backend/storage/logs/laravel.log`, rotated by `LOG_STACK`. Watch it live with
`php artisan pail` while debugging a deploy.

---

## Troubleshooting

**500 on every API request, empty response body.**
`APP_KEY` missing, or `storage/` not writable. Check
`storage/logs/laravel.log`; temporarily set `APP_DEBUG=true`, read the error,
then set it back to `false` immediately.

**`could not find driver` / `SQLSTATE[08006]`.**
The `pdo_pgsql` extension is not enabled for the PHP version the web server
uses. Confirm with `php -m | grep pgsql` — and note the CLI and the web server
may run different PHP versions.

**`SSL connection has been closed unexpectedly`, or a handshake failure.**
`DB_SSLMODE` is not `require`. Set it and re-run `config:cache`.

**Authentication failed for the database user.**
Almost always the pooler username, not the password: the pooler user is not
plain `postgres`. Re-copy it from the dashboard. Also confirm you are on port
5432, not 6543.

**CORS error in the browser console.**
`FRONTEND_URL` does not exactly match the browser's origin. Compare scheme, host
and `www`. Re-run `config:cache` after fixing. There is no wildcard fallback, and
that is deliberate.

**401 on every request immediately after signing in.**
The frontend is talking to a different API than the one that issued the token —
check `NEXT_PUBLIC_API_BASE_URL`. Remember it is baked in at build time, so a
change needs a rebuild, not a restart.

**The app shows products nobody created.**
`NEXT_PUBLIC_DEMO_MODE` is still `true`. Set it to `false` and rebuild.

**A new permission does not work for anyone.**
Run `php artisan tenants:sync-roles`.

**404 on a route that exists.**
Stale route cache after a pull: `php artisan route:clear && php artisan route:cache`.

**Images return 404.**
`php artisan storage:link` has not been run, or the symlink did not survive a
deploy that replaced the directory.

---

## Go-live checklist

Security:

- [ ] No `.env` file in the GitHub repository, and none in its history.
- [ ] `APP_DEBUG=false`, `APP_ENV=production`.
- [ ] `APP_KEY` generated on the server.
- [ ] `DB_SSLMODE=require`.
- [ ] `curl -I https://api.yourdomain.com/.env` returns 403 or 404.
- [ ] Document root is `backend/public`.
- [ ] `.env` is `chmod 600`.
- [ ] HTTPS enforced on both hostnames.
- [ ] Database password stored only in a password manager and the server `.env`.
- [ ] No database credentials anywhere in the frontend bundle (search the built
      JS for your database host — it must not appear).

Function:

- [ ] `php artisan migrate:status` shows every migration ran.
- [ ] `php artisan db:seed --force` has populated the permission catalogue.
- [ ] `DemoDataSeeder` has **not** been run in production.
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` and the app shows real data.
- [ ] `/up` returns healthy.
- [ ] Register, sign out, sign in again all work.
- [ ] Stock IN raises a quantity and writes a ledger line.
- [ ] An over-withdrawal is refused with the real available figure.
- [ ] A multi-batch withdrawal consumes the oldest batch first.
- [ ] A CSV export downloads.
- [ ] The audit log shows the above actions.
- [ ] `inventory:reconcile --dry-run` reports no discrepancies.

Operations:

- [ ] `schedule:run` cron entry installed.
- [ ] Queue worker running, or a cron substitute in place.
- [ ] Frontend managed by a process manager that restarts on boot.
- [ ] You know what your Supabase plan backs up, and how to restore it.
