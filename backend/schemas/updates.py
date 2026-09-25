"""Apply domain schema additions in a single transaction."""

from sqlalchemy import inspect, text

from . import order, payment, user, product, vendor

SCHEMA_MODULES = (user, order, payment, product, vendor)


def apply_schema_updates(engine):
    with engine.begin() as connection:
        inspector = inspect(connection)
        for module in SCHEMA_MODULES:
            for table, additions in module.column_updates(engine.dialect.name).items():
                if not inspector.has_table(table):
                    continue
                columns = {column["name"] for column in inspector.get_columns(table)}
                for column, definition in additions.items():
                    if column not in columns:
                        # SQL identifiers and definitions come only from trusted modules.
                        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            if hasattr(module, "apply_constraints"):
                module.apply_constraints(connection)
