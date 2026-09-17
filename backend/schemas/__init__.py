"""Database schema updates applied during application startup."""

from .updates import apply_schema_updates

__all__ = ["apply_schema_updates"]
