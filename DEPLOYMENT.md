# Vercel deployment

Import this repository as one project, keeping Root Directory at the repository
root. `vercel.json` defines the Vite frontend and FastAPI backend as Vercel
Services (beta). `/api/*` routes to FastAPI; all other requests reach Vite.

Set these environment variables in Vercel, never in frontend `VITE_*` variables:

- `DATABASE_URL`: Supabase PostgreSQL connection URL.
- `SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side storage credential.
- `SUPABASE_PRODUCT_BUCKET`: product-images (or the existing bucket name).
- `COOKIE_SECURE`: true.
- `RESET_TOKEN_SECRET`: a securely generated random secret.
- `FRONTEND_URL`: the deployed HTTPS origin, without a trailing slash.
- Password-reset email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

Python dependencies are pinned to the local application's installed versions.
Do not deploy the local virtual environment. Python 3.12 is selected for Vercel.

After deployment, verify `/api/products`, sign-in, role pricing, and checkout.
Environment variable changes require a new deployment. Keep preview databases
separate from production when testing writes.

## Remaining production considerations

The existing application allows artwork payloads larger than the Vercel Function
request limit. Large uploads need direct object-storage uploads before they can
be supported on this deployment. Existing database latency and startup schema
updates must run separately from production requests. Before deploying a schema
change, run `python migrate.py` from `backend/` using the target database's
environment variables. Vercel startup skips schema inspection and migration.
Warm PostgreSQL instances reuse a pool of at most three client connections.
The backend function uses Singapore (`sin1`) to match the configured Supabase
pooler region (`ap-southeast-1`). Update this if the database region changes.

References: https://vercel.com/docs/services and
https://vercel.com/docs/functions/limitations
