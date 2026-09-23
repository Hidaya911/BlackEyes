"""Run once per schema release, outside request-serving application startup."""
from database import engine
from models import Base
from schemas import apply_schema_updates

if __name__ == '__main__':
    Base.metadata.create_all(bind=engine)
    apply_schema_updates(engine)
    engine.dispose()
    print('Database schema is up to date.')
