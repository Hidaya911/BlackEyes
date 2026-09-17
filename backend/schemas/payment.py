"""Additions for existing payment tables."""


def column_updates(dialect_name):
    return {
        "payments": {
            "confirmed_by": "INTEGER REFERENCES users(user_id) ON DELETE RESTRICT",
            "confirmed_at": "TIMESTAMP WITH TIME ZONE" if dialect_name == "postgresql" else "DATETIME",
        },
    }
