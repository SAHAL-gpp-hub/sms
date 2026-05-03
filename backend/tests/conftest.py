# backend/tests/conftest.py
"""
Shared fixtures available to all test modules.
test_rbac.py has its own module-scoped DB setup since it needs
specific seed data. This conftest provides lightweight helpers
used across multiple test files.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    """
    Session-scoped TestClient. Individual test modules that need
    their own DB override should create their own client fixture
    with narrower scope (as test_rbac.py does).
    """
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_token(client):
    """
    Returns a valid admin JWT. Requires the DB to have an admin user
    with email admin@test.com / admin1234 (seeded by test_rbac.py setup).
    Use only in tests that run after test_rbac.py has seeded the DB,
    or seed explicitly in your own fixture.
    """
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "admin1234"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(autouse=True)
def disable_rate_limit():
    # Disable slowapi limiter during tests
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False
