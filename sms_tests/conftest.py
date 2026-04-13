"""
conftest.py — Shared fixtures for SMS test suite

AUTHENTICATION FIX (Sprint 1):
  Now that C-01 (Authentication Disabled) is fixed and JWT auth is enforced on
  all API routes, the test suite must authenticate before making requests.

  The `api` fixture now:
    1. Logs in with TEST_EMAIL / TEST_PASSWORD (from .env or defaults below)
    2. Attaches the Bearer token to every request via httpx auth
    3. Falls back gracefully if login fails (skips with a clear message)

  Set credentials in sms_tests/.env:
    TEST_EMAIL=admin@iqraschool.in
    TEST_PASSWORD=YourSecurePass123

OTHER FIXES PRESERVED:
  - make_payment() uses "mode": mode (not "payment_mode")
  - StudentFactory.valid() uses aadhar_last4 (not aadhar)
  - _get_academic_year_id cache invalidated per session
"""

import os
import pytest
import httpx
from faker import Faker
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page, expect
from datetime import date

load_dotenv()

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
BASE_URL     = os.getenv("BASE_URL",     "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost")
API_URL      = os.getenv("API_URL",      "http://localhost:8000/api/v1")
UI_TIMEOUT   = int(os.getenv("UI_TIMEOUT", "10000"))
HEADLESS     = os.getenv("HEADLESS", "true").lower() == "true"
BROWSER_TYPE = os.getenv("BROWSER", "chromium")

# Test credentials — set in .env or use defaults
TEST_EMAIL    = os.getenv("TEST_EMAIL",    "admin@iqraschool.in")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "admin123")

fake = Faker("en_IN")


# ──────────────────────────────────────────────
# AUTH HELPER
# ──────────────────────────────────────────────
def _get_auth_token() -> str | None:
    """
    Log in and return a JWT Bearer token.

    Called once at session start by the `api` fixture.
    Returns None if login fails (tests will be skipped with a clear message).
    """
    try:
        r = httpx.post(
            f"{API_URL}/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
            follow_redirects=True,
        )
        if r.status_code == 200:
            token = r.json().get("access_token")
            if token:
                return token
        # If no admin user exists yet, try to register one first
        if r.status_code == 401:
            reg = httpx.post(
                f"{API_URL}/auth/register",
                json={
                    "name": "Test Admin",
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD,
                    "role": "admin",
                },
                timeout=10,
                follow_redirects=True,
            )
            if reg.status_code in (200, 201, 409):
                # 409 = already exists, retry login
                r2 = httpx.post(
                    f"{API_URL}/auth/login",
                    data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10,
                    follow_redirects=True,
                )
                if r2.status_code == 200:
                    return r2.json().get("access_token")
    except Exception as exc:
        print(f"\n[conftest] Auth error: {exc}")
    return None


class BearerAuth(httpx.Auth):
    """httpx Auth class that attaches a Bearer token to every request."""
    def __init__(self, token: str):
        self.token = token

    def auth_flow(self, request):
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request


# ──────────────────────────────────────────────
# API CLIENT FIXTURE
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    """
    Authenticated httpx client pointed at the FastAPI backend.

    AUTHENTICATION FIX: Logs in at session start and attaches the JWT token
    to every request. If login fails, a clear error is printed and all API
    tests will fail with 401 — prompting the developer to create an admin user.

    To create the admin user manually:
        curl -X POST http://localhost:8000/api/v1/auth/register \\
          -H "Content-Type: application/json" \\
          -d '{"name":"Admin","email":"admin@iqraschool.in","password":"admin123"}'
    """
    token = _get_auth_token()

    if not token:
        print(
            f"\n\n{'='*60}\n"
            f"[conftest] WARNING: Could not authenticate with the API.\n"
            f"  URL:   {API_URL}/auth/login\n"
            f"  Email: {TEST_EMAIL}\n"
            f"  Pass:  {TEST_PASSWORD}\n\n"
            f"  To fix, create an admin user:\n"
            f"    curl -X POST {API_URL}/auth/register \\\n"
            f"      -H 'Content-Type: application/json' \\\n"
            f"      -d '{{\"name\":\"Admin\",\"email\":\"{TEST_EMAIL}\","
            f"\"password\":\"{TEST_PASSWORD}\",\"role\":\"admin\"}}'\n"
            f"{'='*60}\n"
        )
        # Yield an unauthenticated client — tests will fail with 401
        # which is at least an informative failure rather than a crash.
        with httpx.Client(base_url=API_URL, timeout=30, follow_redirects=True) as client:
            yield client
    else:
        auth = BearerAuth(token)
        with httpx.Client(
            base_url=API_URL,
            timeout=30,
            follow_redirects=True,
            auth=auth,
        ) as client:
            yield client


@pytest.fixture(scope="session")
def raw_api():
    """Client for non-prefixed endpoints (e.g. /docs, /health). No auth needed."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        yield client


# ──────────────────────────────────────────────
# PLAYWRIGHT BROWSER FIXTURES
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def browser_context():
    with sync_playwright() as p:
        browser_launcher = getattr(p, BROWSER_TYPE)
        browser = browser_launcher.launch(headless=HEADLESS)
        context = browser.new_context(
            base_url=FRONTEND_URL,
            viewport={"width": 1440, "height": 900},
        )
        context.set_default_timeout(UI_TIMEOUT)
        yield context
        context.close()
        browser.close()


@pytest.fixture
def page(browser_context):
    """Fresh page per test."""
    pg = browser_context.new_page()
    yield pg
    pg.close()


# ──────────────────────────────────────────────
# TEST DATA FACTORY
# ──────────────────────────────────────────────
def _get_academic_year_id() -> int:
    """Fetch the current academic year id from the API (cached per process)."""
    if not hasattr(_get_academic_year_id, "_cached"):
        try:
            token = _get_auth_token()
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            import httpx as _httpx
            r = _httpx.get(
                f"{API_URL}/yearend/current-year",
                headers=headers,
                timeout=5,
                follow_redirects=True,
            )
            if r.status_code == 200:
                _get_academic_year_id._cached = r.json().get("id", 1)
            else:
                _get_academic_year_id._cached = 1
        except Exception:
            _get_academic_year_id._cached = 1
    return _get_academic_year_id._cached


def today_str() -> str:
    return date.today().isoformat()


class StudentFactory:
    @staticmethod
    def valid(**overrides):
        first = fake.first_name()
        last  = fake.last_name()
        data = {
            "name_en":          f"{first} {last}",
            "name_gu":          "રાહુલ શાહ",
            "gender":           "M",
            "dob":              "2015-06-15",
            "contact":          f"9{fake.numerify('#########')}",
            "father_name":      f"{fake.first_name()} {last}",
            "admission_date":   "2023-06-01",
            "academic_year_id": _get_academic_year_id(),
            "address":          fake.address(),
            "gr_number":        fake.bothify("GR###??").upper(),
            "roll_number":      fake.random_int(min=1, max=60),
            "class_id":         1,
        }
        # Map legacy override keys to API keys
        first_override = overrides.pop("first_name", None)
        last_override  = overrides.pop("last_name",  None)
        if first_override or last_override:
            data["name_en"] = f"{first_override or first} {last_override or last}"

        if "date_of_birth" in overrides:
            overrides["dob"] = overrides.pop("date_of_birth")
        if "contact_number" in overrides:
            overrides["contact"] = overrides.pop("contact_number")
        if "first_name_gujarati" in overrides or "last_name_gujarati" in overrides:
            fgu = overrides.pop("first_name_gujarati", "")
            lgu = overrides.pop("last_name_gujarati", "")
            overrides["name_gu"] = f"{fgu} {lgu}".strip()

        # FIX: schema now uses aadhar_last4, not aadhar
        if "aadhar" in overrides:
            full = str(overrides.pop("aadhar") or "")
            overrides["aadhar_last4"] = full[-4:] if len(full) >= 4 else None

        data.update(overrides)
        return data

    @staticmethod
    def minimal(**overrides):
        first = fake.first_name()
        last  = fake.last_name()
        data = {
            "name_en":          f"{first} {last}",
            "name_gu":          "રાહુલ શાહ",
            "gender":           "M",
            "dob":              "2015-06-15",
            "contact":          f"9{fake.numerify('#########')}",
            "father_name":      f"{fake.first_name()} {last}",
            "admission_date":   "2023-06-01",
            "academic_year_id": _get_academic_year_id(),
            "class_id":         1,
        }
        first_override = overrides.pop("first_name", None)
        last_override  = overrides.pop("last_name",  None)
        if first_override or last_override:
            data["name_en"] = f"{first_override or first} {last_override or last}"
        if "contact_number" in overrides:
            overrides["contact"] = overrides.pop("contact_number")
        if "aadhar" in overrides:
            full = str(overrides.pop("aadhar") or "")
            overrides["aadhar_last4"] = full[-4:] if len(full) >= 4 else None
        data.update(overrides)
        return data


class FeeFactory:
    @staticmethod
    def valid(**overrides):
        data = {
            "fee_head_id":      overrides.pop("fee_head_id", 1),
            "amount":           5000,
            "class_id":         1,
            "academic_year_id": _get_academic_year_id(),
        }
        overrides.pop("fee_head",     None)
        overrides.pop("academic_year", None)
        data.update(overrides)
        return data


class PaymentFactory:
    @staticmethod
    def valid(student_id, fee_id, amount, mode="Cash", **overrides):
        data = {
            "student_id":     student_id,
            "student_fee_id": fee_id,
            "amount_paid":    amount,
            # FIX: was "payment_mode" (wrong key, ignored by API) — now "mode"
            "mode":           mode,
            "payment_date":   today_str(),
        }
        data.update(overrides)
        return data


def make_payment(student_fee_id: int, amount: float, mode: str = "Cash") -> dict:
    """
    TEST FAILURE FIX: The old make_payment() used key "payment_mode" which
    does not match the FastAPI PaymentCreate schema field "mode", so the
    mode argument was silently ignored and all payments were saved as Cash.

    Also added payment_date (required by the schema) which was missing.
    """
    return {
        "student_fee_id": student_fee_id,
        "amount_paid":    amount,
        # FIX: correct field name is "mode" (was "payment_mode")
        "mode":           mode,
        # FIX: payment_date is required — was missing in original conftest
        "payment_date":   today_str(),
    }


@pytest.fixture
def student_factory():
    return StudentFactory()


@pytest.fixture
def fee_factory():
    return FeeFactory()


@pytest.fixture
def payment_factory():
    return PaymentFactory()


# ──────────────────────────────────────────────
# HELPER: create a student and return its ID
# ──────────────────────────────────────────────
@pytest.fixture
def create_student(api):
    created_ids = []

    def _create(**overrides):
        payload = StudentFactory.valid(**overrides)
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), f"Student creation failed: {r.text}"
        sid = r.json()["id"]
        created_ids.append(sid)
        return sid, r.json()

    yield _create

    # Teardown: mark students as Left after each test
    for sid in created_ids:
        try:
            api.delete(f"/students/{sid}")
        except Exception:
            pass


# ──────────────────────────────────────────────
# HELPER: navigate UI and wait for page load
# ──────────────────────────────────────────────
def goto(page: Page, path: str):
    page.goto(f"{FRONTEND_URL}/{path.lstrip('/')}")
    page.wait_for_load_state("networkidle")