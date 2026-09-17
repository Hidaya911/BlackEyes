# Backend organization

- `models/`: SQLAlchemy table definitions, grouped by domain: users, sessions,
  vendors, products, inventory, purchases, payments, customer prices, orders,
  design files, and job status history.
- `models/__init__.py`: exports every model and registers all tables with the
  shared `database.Base`. Existing `from models import User` imports still work.
- `schemas/`: incremental database updates for existing tables, split into
  `user.py`, `order.py`, and `payment.py`.
- `schemas/updates.py`: runs registered schema updates in one transaction,
  skipping missing tables and columns that already exist. Register future
  domain update modules in `SCHEMA_MODULES`.
- `database.py`: database connection, shared model base, and session dependency.
- `main.py`: application setup, middleware, router registration, and database
  startup only. HTTP endpoints live in `routers/`.
- `routers/user.py`: signup, login, logout, and password reset endpoints.
- `routers/staff.py`: admin management of staff accounts.
- `routers/settings.py`: admin profile and password settings.
- `routers/product.py`: admin product management and product image uploads.
- `routers/vendor.py`: supplier contact management.
- `routers/system.py`: the root status endpoint.
- `routers/customer_portal.py`: customer profiles, catalog, ordering, payments,
  and artwork endpoints.
- `routers/order_management.py`: staff order review, production progress,
  artwork approval, and payment confirmation endpoints.
- `routers/vendor_ledger.py`: supplier purchases, stock movements, and payments.
- `routers/press_orders.py`: customer lookup, counter catalog, and walk-in order creation.
- `routers/press_profile.py`: session-authenticated staff/admin profile and password settings.
- `models/customer.py`: saved walk-in contacts without login credentials.
- `schemas/requests/press.py`: Pydantic validation for counter orders and operator settings.
- `services/press_orders.py`: pricing, customer snapshots, atomic order/payment creation,
  and duplicate-submission protection.
- `services/order_details.py`, `services/profiles.py`: shared response serialization.
- `utilities/`: shared upload validation and database commit handling.
- `access.py`, `sessions.py`: authorization and session handling.
- `scripts/create_admin.py`: manually creates initial admin and staff accounts.
- `scripts/create_vendor_tables.py`: manually creates and verifies ledger tables.

The top-level `schemas/` modules contain database updates; `schemas/requests/`
contains Pydantic request definitions for the new press workflow. New
tables are defined in `models/`; domains without existing-table updates do not
need an empty schema module. Startup still creates missing tables before
applying incremental updates.

Run commands from the `backend` directory with the existing `.env` configuration:

```powershell
venv\Scripts\python.exe -m uvicorn main:app --reload
# Manual administration commands (these write to the configured database):
venv\Scripts\python.exe -m scripts.create_admin
venv\Scripts\python.exe -m scripts.create_vendor_tables
```

From the project root, the equivalent development command is:

```powershell
backend\venv\Scripts\python.exe backend\run.py
```

Keep the backend terminal running alongside `npm run dev` in `frontend/`.
Run only one backend server. For Supabase shared-pooler URLs, `database.py`
uses transaction mode (port 6543) and `NullPool`, so idle development servers
do not reserve the database's limited session connections. Other PostgreSQL
hosts retain their configured port and normal SQLAlchemy pool.
Vite forwards `/api` to `127.0.0.1:8000`. The backend loads `backend/.env`
by absolute path, regardless of the terminal's working directory. After a
backend reload, wait for `Application startup complete` before submitting.

The SQLite backend checks, temporary test server, frontend browser tests, and
Playwright configuration were removed. None are needed to run the application.

Folder responsibilities:

- `routers/` handles HTTP requests and responses. The current domain modules
  also retain their validation and business logic to preserve existing behavior.
- `models/` defines database tables.
- `schemas/` holds database updates and a dedicated `requests/` subpackage for
  input models. Older request models remain alongside their routes.
- `scripts/` holds commands run manually rather than on each API request.
- `services/` holds business logic and shared serialization.
- `utilities/` holds small, reusable file and database helpers.
- `templates/` is for server-rendered HTML; this project uses a React frontend
  and does not need it.

FastAPI does not require a specific folder layout. Add folders when there is
code that belongs in them rather than creating empty layers.

## Counter orders and the staff workspace

Staff and admins can select **New walk-in order**, choose an existing customer
account/saved walk-in contact, or save a new contact with a name, phone, and
optional email/address. New contacts are saved with the order in one transaction;
they are not login accounts. Search by name, phone, or email on future visits.

Catalog prices are calculated on the server, including existing account-specific
prices. Custom service lines accept a name, quantity, and price in cents. Attach
artwork or supply a job brief. Cash/Whish payments may be full, partial, or unpaid;
the order stores received and remaining amounts. Review can confirm collection
of the remaining balance. This is not a separate installment transaction ledger.

Only active, signed-in staff/admin sessions can use `/api/press/*`. Profile
settings update the signed-in operator; password changes revoke their sessions.

On backend restart, startup creates `walk_in_customers` and adds the order
contact/audit columns. For existing PostgreSQL databases, it also makes
`orders.customer_id` nullable so a walk-in contact does not require a user
account. Existing online customer links are retained. The PostgreSQL database
user must have the same schema-update permissions required by existing startup
migrations. Fresh local databases receive the updated model definitions.
