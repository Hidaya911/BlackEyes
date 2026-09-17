"""Additions for existing order tables."""

from sqlalchemy import inspect, text


def column_updates(dialect_name):
    return {
        "orders": {
            "walk_in_customer_id": "INTEGER REFERENCES walk_in_customers(customer_id) ON DELETE RESTRICT",
            "created_by": "INTEGER REFERENCES users(user_id) ON DELETE RESTRICT",
            "customer_address": "VARCHAR(500)",
            "request_fingerprint": "VARCHAR(64)",
            "payment_method": "VARCHAR(30) NOT NULL DEFAULT 'whish_money'",
            "payment_timing": "VARCHAR(20) NOT NULL DEFAULT 'on_order'",
        },
    }


def apply_constraints(connection):
    # Production uses PostgreSQL. Fresh databases already use the nullable model.
    if connection.dialect.name == "postgresql" and inspect(connection).has_table("orders"):
        columns = {column["name"]: column for column in inspect(connection).get_columns("orders")}
        if not columns["customer_id"]["nullable"]:
            connection.execute(text("ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL"))
        constraints = {constraint["name"] for constraint in inspect(connection).get_check_constraints("orders")}
        if "ck_order_customer_identity" not in constraints:
            connection.execute(text(
                "ALTER TABLE orders ADD CONSTRAINT ck_order_customer_identity CHECK ("
                "(customer_id IS NOT NULL AND walk_in_customer_id IS NULL) OR "
                "(customer_id IS NULL AND walk_in_customer_id IS NOT NULL))"
            ))
