import os
import logging
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError, TimeoutError as PoolTimeoutError
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv(Path(__file__).resolve().with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Configure it in backend/.env.")

# Cloud databases may close idle connections while they are still in the pool.
# Check each checkout and replace old connections before a request uses them.
connect_args = {}
database_url = make_url(DATABASE_URL)
pool_options = {"pool_pre_ping": True, "pool_recycle": 300}
if database_url.get_backend_name() == "postgresql":
    connect_args.update(
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=10,
        keepalives_interval=5,
        keepalives_count=3,
    )
    if (database_url.host or "").endswith(".pooler.supabase.com"):
        # Supavisor owns the pool. Session mode reserves a server connection for
        # every idle local connection and can exhaust the small database limit.
        database_url = database_url.set(port=6543)
        pool_options = {"poolclass": NullPool}

engine = create_engine(
    database_url,
    **pool_options,
    connect_args=connect_args,
)
logger = logging.getLogger(__name__)

# Create a session factory for database transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your ORM models to inherit from
Base = declarative_base()

# Dependency injection for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    except (OperationalError, PoolTimeoutError) as error:
        db.rollback()
        logger.warning("Database connection unavailable during an API request (%s).", type(error).__name__)
        # Never replay writes: a disconnect during commit can leave its outcome unknown.
        raise HTTPException(
            status_code=503,
            detail="The database connection was interrupted. Refresh to check whether your changes were saved before trying again.",
        ) from error
    finally:
        db.close()
