# Backend setup and deployment

## Invoice OCR on Vercel

Invoice recognition now runs in the browser using Tesseract.js. Upload, review,
vendor matching, and recording purchases keep the same flow. The image stays in
the browser; recognized text and word positions go to the authenticated
`/api/admin/vendor-invoices/parse-text` endpoint for the existing invoice parser.
Parsing does not save purchases; the administrator still reviews and saves them.

Deploy the frontend and backend together. `npm ci` installs the locked OCR runtime
and English model; `npm run build` copies their files into the frontend's static
`/ocr/` directory automatically. No Tesseract server installation, paid service,
API key, or database migration is needed for this flow. The first scan downloads
the recognition files; allow up to two minutes on slower devices/connections.
JPEG, PNG, and WebP limits remain 8 MB and 16 megapixels. English recognition is
the same language default as the previous server flow.

The original image-upload API remains available for older clients on servers
with native Tesseract installed. Current frontend clients use browser OCR only.
For custom security headers, allow same-origin workers and WebAssembly execution.

Install `requirements.txt`, copy `.env.example` to `.env`, and set `DATABASE_URL` and
`RESET_TOKEN_SECRET`. Generate the secret with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep it in your
deployment secret store; there is no fallback. Rotating it invalidates outstanding
password-reset links. The API refuses to start with a missing or weak secret.

## Production settings

```dotenv
APP_ENV=production
RESET_TOKEN_SECRET=<generated secret, never commit this>
FRONTEND_URL=https://print.example.com
CORS_ORIGINS=https://print.example.com
COOKIE_SECURE=true
```

Use the real frontend origin, without a trailing slash or path. `CORS_ORIGINS` is a
comma-separated allowlist; an empty value disables cross-origin access for a
same-origin deployment. Wildcards are rejected. Production (including Vercel)
requires HTTPS origins and Secure cookies. Cookies are host-only, HttpOnly,
SameSite=Lax, and scoped to `/`; logout uses the same attributes.

The frontend uses relative `/api` requests. Serve it and the API through the same
HTTPS origin/reverse proxy, as the Vite development proxy does locally. Merely
adding a CORS origin does not configure a separately hosted frontend to send
credentials. Cross-site cookie deployments are not supported by these defaults;
they require deliberate credential and CSRF changes. Terminate TLS at your trusted
proxy and redirect HTTP to HTTPS there. Set SMTP settings for reset emails.

These changes harden configuration, not every authorization path: legacy endpoints
using `access.require_admin(admin_id, db)` still validate a supplied administrator
ID rather than the caller's session. Audit and migrate those endpoints before
exposing the application publicly. Frontend role checks are only navigation guards.

## Database migrations

Application startup never creates or alters tables. New, empty databases:

```sh
cd backend
python -m alembic upgrade head
```

`python migrate.py` runs the same command. Run migrations once per release before
starting API workers. `MIGRATION_DATABASE_URL` can select a direct PostgreSQL
connection with schema privileges, separate from the runtime/pooler URL.
Revision `0001` is a frozen schema snapshot; it does not import changing ORM models
or execute the legacy schema updater.

### Adopting an existing database

Do not run the initial create-table revision on an existing schema. First back up
the database and rehearse on a restored copy. Compare that schema against revision
`0001`, including column types, nullability, foreign keys, checks, unique indexes,
and the vendor-order data backfill. Older installations may need the legacy
`schemas.apply_schema_updates` routines and explicit reconciliation SQL; those
routines alone do not prove equivalence and are no longer called automatically.

Only once the schema and backfill have been verified equivalent:

```sh
python -m alembic stamp 0001
python -m alembic check
python -m alembic upgrade head
```

`stamp` records a version without changing tables or data. Resolve any differences
reported by `check`; it does not detect every constraint or data discrepancy.
Never stamp an unverified schema. Existing-database adoption has not been applied
by this change.

For subsequent changes, edit models, run
`python -m alembic revision --autogenerate -m "Describe the change"`, review the
generated operations and data transformations, and test upgrade/downgrade on a
disposable database. See the [Alembic autogeneration limitations](https://alembic.sqlalchemy.org/en/latest/autogenerate.html).
Downgrading the baseline drops application tables, so use it only on disposable
databases. Restore backups for a production rollback that requires preserving data.

## Tests

Install `requirements-dev.txt` in addition to runtime requirements. PowerShell:

```powershell
$env:DATABASE_URL = 'sqlite://'
$env:APP_ENV = 'test'
$env:RESET_TOKEN_SECRET = python -c 'import secrets; print(secrets.token_urlsafe(48))'
python -m unittest discover -s tests -v
```

Tests use isolated SQLite databases. Migration tests verify upgrades, repeated
upgrades, schema comparison, downgrade/re-upgrade, inventory uniqueness, and
PostgreSQL SQL generation. They do not execute against a live PostgreSQL server.

From `frontend`, run `npm ci`, `npm test`, `npm run build`, and `npm run lint`.
Frontend tests exercise actual login/reset forms and HTTP request handling, plus
role routing and logout with workspace components mocked to isolate navigation.
