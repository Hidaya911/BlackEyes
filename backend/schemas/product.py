"""Separate wholesale prices; existing retail prices remain unchanged."""


def column_updates(dialect_name):
    return {"products": {"wholesale_price": "INTEGER CHECK (wholesale_price >= 0)"}}
