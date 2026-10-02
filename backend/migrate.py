"""Run once per schema release, outside request-serving application startup."""
from pathlib import Path
from alembic import command
from alembic.config import Config

if __name__ == '__main__':
    command.upgrade(Config(str(Path(__file__).with_name('alembic.ini'))), 'head')
    print('Database schema is up to date.')
