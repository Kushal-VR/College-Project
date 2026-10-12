import time
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.core.config import settings
from app.core.logging import logger

# Configure database engine
connect_args = {}
engine_kwargs: Dict[str, Any] = {"echo": False}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_kwargs["connect_args"] = connect_args
else:
    # PostgreSQL / Supabase pool configuration
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 300,
    })

try:
    engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
except Exception as e:
    logger.error(f"Failed to create database engine with URL {settings.DATABASE_URL}: {e}")
    # Fallback to local SQLite if remote PostgreSQL connection string failed parsing
    engine = create_engine("sqlite:///./attendance.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_connection() -> Dict[str, Any]:
    """Perform a ping on the database to check connectivity and calculate latency."""
    start_time = time.time()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        latency_ms = round((time.time() - start_time) * 1000, 2)
        db_type = "PostgreSQL (Supabase)" if "postgres" in settings.DATABASE_URL else "SQLite (Local Dev)"
        return {
            "status": "connected",
            "latency_ms": latency_ms,
            "database_type": db_type,
            "error": None,
        }
    except Exception as exc:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        logger.warning(f"Database health check failed: {exc}")
        return {
            "status": "disconnected",
            "latency_ms": latency_ms,
            "database_type": "unknown",
            "error": str(exc),
        }

def init_db():
    """Initialize database tables."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as exc:
        logger.error(f"Failed to initialize database tables: {exc}")
