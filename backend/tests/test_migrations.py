"""Run migrations on disposable databases, never the configured deployment DB."""
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from models import Base


class MigrationTests(unittest.TestCase):
    def config(self, output=None):
        return Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'), output_buffer=output)

    def test_upgrade_repeat_check_downgrade_and_reupgrade(self):
        with tempfile.TemporaryDirectory() as folder:
            url = 'sqlite:///' + str(Path(folder) / 'migration.db').replace('\\', '/')
            with patch.dict(os.environ, {'MIGRATION_DATABASE_URL': url}):
                config = self.config()
                command.upgrade(config, 'head')
                command.upgrade(config, 'head')
                command.check(config)
                engine = create_engine(url)
                self.assertEqual(set(inspect(engine).get_table_names()), set(Base.metadata.tables) | {'alembic_version'})
                with engine.begin() as connection:
                    connection.execute(text("INSERT INTO inventory_items (name, type, unit, quantity_on_hand, low_stock_threshold) VALUES ('Paper', 'paper', 'Sheet', 0, 0)"))
                with self.assertRaises(IntegrityError), engine.begin() as connection:
                    connection.execute(text("INSERT INTO inventory_items (name, type, unit, quantity_on_hand, low_stock_threshold) VALUES ('paper', 'paper', 'sheet', 0, 0)"))
                engine.dispose()
                command.downgrade(config, 'base')
                engine = create_engine(url)
                self.assertEqual(inspect(engine).get_table_names(), ['alembic_version'])
                engine.dispose()
                command.upgrade(config, 'head')

    def test_postgresql_sql_can_be_generated_offline(self):
        output = io.StringIO()
        with patch.dict(os.environ, {'MIGRATION_DATABASE_URL': 'postgresql://unused:unused@localhost/unused'}):
            command.upgrade(self.config(output), 'head', sql=True)
        sql = output.getvalue()
        self.assertIn('CREATE UNIQUE INDEX uq_inventory_identity', sql)
        self.assertIn('BOOLEAN DEFAULT true', sql)
        self.assertIn('NUMERIC(18, 6)', sql)
