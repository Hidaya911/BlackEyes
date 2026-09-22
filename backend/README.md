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

Isolated SQLite regression tests live in `tests/` and do not use the live database.

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

The counter uses a searchable image catalog with a customization modal for
quantity, specifications, and an optional unit-price override. Product images,
names, descriptions, and prices come from the admin Products screen. The existing
order summary, payment entry, artwork, and custom-service controls remain.

Catalog prices are calculated on the server. Wholesale accounts use the product's
wholesale price; normal accounts retain account-specific prices when configured,
otherwise retail prices apply. Staff/admin may enter an agreed unit price for
one line without modifying the product. An unset wholesale price requires an
explicit override; it never silently falls back to retail. Switching customers
clears catalog-item overrides and recalculates their prices; custom-service
prices remain. The server validates the total and stores the final line prices.
Custom service lines accept a name, quantity, and price in cents. Attach
artwork or supply a job brief. Cash/Whish payments may be full, partial, or unpaid;
the order stores received and remaining amounts. Review can confirm collection
of the remaining balance. Each received payment also enters the customer ledger.

## Wholesale buyer registration and prices

The homepage **Wholesale** section registers a buyer in `users` with the fixed
`wholesaler` role, business name, contact name, email, phone, address, and hashed
password. The public `/api/wholesale/register` endpoint rejects duplicate emails
and supplied role/status fields. Buyers can sign in to an account acknowledgment
screen; self-service wholesale ordering remains deferred. Staff/admin can place
counter orders for wholesale buyers using their wholesale catalog prices.

Admin and staff Customers views include wholesale badges, business names, and a
Wholesalers filter. Staff have a read-only directory; editing and deletion remain
admin-only. Normal and wholesale customers remain distinct roles.

Admin product creation and editing require retail and wholesale USD prices,
stored separately as integer cents. Startup adds `users.business_name` and
`products.wholesale_price`. Existing wholesale prices remain unset until edited;
existing retail prices are unchanged. Counter order pricing now supports the
wholesale tier and authorized per-order overrides.

## Production workflow

Both staff and admin open **Orders** to switch between **Production board** and
**Order review**. Incoming orders remain in the Awaiting review inbox until
reviewed. The board has Queued, In Prepress, Printing, Finishing, and Ready for
Pickup columns. Drag cards between stages or use the Move to menu (also usable
with touch and keyboard). Review remains accessible on every card.

Stage updates use the existing authenticated order PATCH endpoint and record
the operator in job status history. Artwork must be approved before production;
moving a card never confirms payment. The UI sends `expected_stage`, so a move
based on an outdated stage is rejected with HTTP 409 and the board refreshes.
Forward moves and corrections to earlier production stages are supported.

## Customer debt ledger

Admin and staff share **Customer ledger** in their sidebar. Search portal and
walk-in customers, filter outstanding/settled accounts, open chronological
statements with running balances, and export CSV statements. Record partial or
full payments against a selected order; unpaid credit remains outstanding.
Invoices and cumulative receipts are accessible from the statement.

`routers/customer_ledger.py` exposes authenticated `/api/press/customer-ledger`
balance, statement, and settlement endpoints. `services/customer_payments.py`
records installments while maintaining existing order payment summaries for
reports and receipts. Settlement requests lock the order, reject overpayment,
and use a unique request key so retries cannot record the payment twice.

Restart the backend to create `customer_payment_transactions`. Earlier verified
totals appear as **Previous verified payment**; their individual installments
cannot be reconstructed. New counter payments, ledger settlements, and order
review confirmations record amount, timestamp, operator, method, and reference.
Pending transfers do not reduce debt. API amounts use integer USD cents.

Only active, signed-in staff/admin sessions can use `/api/press/*`. Profile
settings update the signed-in operator; password changes revoke their sessions.

On backend restart, startup creates `walk_in_customers` and adds the order
contact/audit columns. For existing PostgreSQL databases, it also makes
`orders.customer_id` nullable so a walk-in contact does not require a user
account. Existing online customer links are retained. The PostgreSQL database
user must have the same schema-update permissions required by existing startup
migrations. Fresh local databases receive the updated model definitions.

## Admin customers, reporting, and material usage

### Customer customization and local payment

Customers attach artwork in the product customization modal and can edit it in
the first checkout step. Each item has design groups: one group may cover the
whole quantity, or multiple groups may split it (for example, two mugs using
one design each). Group quantities must total the ordered item quantity. Each
group needs a PDF/PNG/JPEG file or a design brief. The order permits up to 30
files, 10 MB each and 20 MB combined. Shared artwork is stored once per group.

Startup creates `order_item_designs` and adds nullable `design_files.design_id`
for existing databases. Old order-level artwork remains accessible. Customers,
staff, and admins see the item, design, quantity, brief, and associated files.
Files remain selected while browsing and reopening checkout; after a full page
refresh, saved basket entries explicitly require reattaching their local files.

New customer orders accept only cash payment at the press on collection.
Customer Whish checkout and transfer-reference submissions are disabled;
existing financial records and operator/vendor payment flows are retained.

### Invoices and receipts

Admin and staff share **Invoices & receipts**, also accessible from each order
card. A read-only `/api/press/orders/{id}/documents/{invoice|receipt}` endpoint
refreshes the order before previewing. Receipts require a positive verified
payment; pending transfers do not count as received funds. Partial receipts show
the amount received and the remaining balance.

The document preview uses the Blackeyes logo, isolated A4 print styles, and the
separate Print and Download PDF actions. Direct PDF downloads render locally
without browser-added dates, URLs, titles, or page counters. Print styles use
zero page margins with internal document padding to suppress browser decorations.
Invoice references use the order ID;
receipt references use the payment ID. Documents are current order/payment
summaries, not immutable issued-document records. The existing payment model
stores a cumulative amount, so receipts explicitly describe that total rather
than claiming to represent an individual installment. Printing does not change
payment or production status.

Customers supports portal accounts and saved walk-in contacts, with create/edit
and delete confirmation modals. Records with orders cannot be deleted; portal
accounts can instead be deactivated. These new admin APIs require an active
administrator session cookie.

Dashboard shows all-time order sales, verified collections, outstanding customer
and vendor balances, production stages, recent orders, and current stock alerts.
Reports filters orders by inclusive UTC dates and exports product/customer sales,
daily sales, and material usage to CSV. Collections represent current verified
payments against the selected orders, not a cash-receipts-by-payment-date report.
Vendor balances and stock alerts always represent the current position.

Restart the backend to create the new `product_materials` table. In Products,
use **Inventory & material usage** to link a catalog product to one or more
inventory items and specify the quantity consumed per unit sold. For A4 sheets,
link the A4 product to the purchased A4 inventory item with quantity **1**.
Matching names alone do not establish a link. Refresh stock to reload products
or materials added while the screen was open.

New online and counter orders deduct linked materials atomically when placed.
This implements the requested order-time behavior rather than the BRD's later
production/completion timing. Insufficient stock rejects the whole order;
submission retries do not deduct twice. Custom jobs/unlinked products do not
deduct inventory. Existing orders are not backfilled and changing a recipe only
affects subsequent orders. Material usage is audited in inventory transactions.
Alerts trigger at `quantity_on_hand <= low_stock_threshold`, refresh on admin
navigation/window focus and every 30 seconds, and remain visible across sections.

Run isolated regressions (no live database writes):

```powershell
cd backend
.\venv\Scripts\python.exe -B -m unittest discover -s tests -v
```
