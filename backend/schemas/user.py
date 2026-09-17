"""Additions for existing user tables."""


def column_updates(dialect_name):
    return {"users": {"profile_image": "VARCHAR"}}
