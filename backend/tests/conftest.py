import pytest
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_default_users

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    session = SessionLocal()
    seed_default_users(session)
    session.close()

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
