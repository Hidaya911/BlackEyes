"""FastAPI application setup and database startup."""

from config import load_settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    customer_portal,
    order_management,
    product,
    press_orders,
    press_profile,
    settings,
    staff,
    system,
    user,
    vendor,
    vendor_ledger,
)
from routers import admin_customers, admin_inventory, admin_reports
from routers import order_documents
from routers import customer_ledger
from routers import wholesale
# from routers import search  # Semantic search temporarily disabled.
from routers import vendor_invoice_ocr
from routers import vendor_orders

settings_config = load_settings()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

for router in (
    vendor_orders.router,
    vendor_invoice_ocr.router,
    # search.router,
    wholesale.router,
    admin_customers.directory_router,
    customer_ledger.router,
    order_documents.router,
    admin_customers.router,
    admin_inventory.router,
    admin_reports.router,
    vendor_ledger.router,
    customer_portal.router,
    order_management.router,
    press_orders.router,
    press_profile.router,
    user.router,
    staff.router,
    settings.router,
    product.router,
    vendor.router,
    system.router,
):
    app.include_router(router)


# Schema changes are applied explicitly with `alembic upgrade head` before deployment.
