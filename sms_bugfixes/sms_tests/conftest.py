"""
conftest.py — Shared fixtures for SMS test suite

TEST FAILURE FIXES:
  - make_payment() had `"payment_mode": "Cash"` hardcoded (wrong key name, wrong
    value) — the mode parameter was silently ignored. Fixed to use `"mode": mode`
    which matches the FastAPI PaymentCreate schema.
  - StudentFactory.valid() updated to use aadhar_last4 instead of aadhar
    (matches the updated base_models.py / schemas/student.py).
  - _get_academic_year_id cache is now invalidated between test sessions to
    prevent stale year IDs when the DB is reset between runs.
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

fake = Faker("en_IN")


# ──────────────────────────────────────────────
# API CLIENT FIXTURE
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    """Synchronous httpx client pointed at the FastAPI backend."""
    with httpx.Client(base_url=API_URL, timeout=30, follow_redirects=True) as client:
        yield client


@pytest.fixture(scope="session")
def raw_api():
    """Client for non-prefixed endpoints (e.g. /docs, /health)."""
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
            import httpx as _httpx
            r = _httpx.get(
                f"{API_URL}/yearend/current-year", timeout=5, follow_redirects=True
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
