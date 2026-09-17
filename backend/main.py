"""FastAPI application setup and database startup."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
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
from schemas import apply_schema_updates

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
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


@app.on_event("startup")
def startup():
    """Create missing tables, then apply updates to existing tables."""
    Base.metadata.create_all(bind=engine)
    apply_schema_updates(engine)
