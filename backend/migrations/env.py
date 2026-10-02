"""Alembic uses DATABASE_URL, or a dedicated direct MIGRATION_DATABASE_URL."""
import os
from alembic import context
from sqlalchemy import create_engine, pool
from models import Base

target_metadata = Base.metadata
url = os.environ.get('MIGRATION_DATABASE_URL') or os.environ['DATABASE_URL']

if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True,
                      dialect_opts={'paramstyle': 'named'}, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata,
                          compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
