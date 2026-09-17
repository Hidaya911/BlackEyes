
"""Create and verify ledger tables: python -m scripts.create_vendor_tables."""

from sqlalchemy import inspect

from database import engine
from models import Base, InventoryItem, InventoryTransaction, VendorPayment, VendorPurchase


TABLES = [InventoryItem.__table__, VendorPurchase.__table__, VendorPayment.__table__, InventoryTransaction.__table__]


def create_tables():
    with engine.begin() as connection:
        Base.metadata.create_all(bind=connection, tables=TABLES)
        inspector = inspect(connection)
        for table in TABLES:
            columns = {column["name"] for column in inspector.get_columns(table.name)}
            missing = set(table.columns.keys()) - columns
            if missing:
                raise RuntimeError(f"Existing {table.name} needs a migration for: {sorted(missing)}")
            print(f"Verified {table.name}: {', '.join(sorted(columns))}")


if __name__ == "__main__":
    create_tables()
