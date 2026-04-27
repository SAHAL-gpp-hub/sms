"""
conftest.py — Shared fixtures for SMS test suite

FIXES IN THIS VERSION:
  1. AUTH: Logs in at session start, attaches Bearer token to all requests.
  2. SEED: Calls /setup/seed at session start so classes 1-10 + academic year
     exist before any test tries to create a student with class_id=1.
  3. CLASS_ID RESOLUTION: Looks up actual DB ids for classes after seeding
     instead of hardcoding integer 1, which may not match the DB sequence.
  4. FEE FACTORY: Uses real seeded class id.
  5. make_payment(): Uses correct "mode" key (not "payment_mode").
  6. StudentFactory: Uses aadhar_last4 (not aadhar).
  7. FIX: Added class_id and class_id_2 fixtures so tests can use real DB ids
     in API params instead of hardcoded integers.
  8. FIX: authenticated_page is now function-scoped — each UI test gets a
     fresh page that logs in cleanly. A shared session page breaks after any
     test that triggers a reload (losing the in-memory token) or navigates
     to /login, causing all subsequent tests to start from /login.
"""

import os
import pytest
import httpx
from faker import Faker
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page
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

TEST_EMAIL    = os.getenv("TEST_EMAIL",    "admin@iqraschool.in")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "admin123")

fake = Faker("en_IN")

# Session-level shared state populated by the `api` fixture
_SESSION = {"token": None, "class_id": None, "class_id_2": None, "year_id": 1}


# ──────────────────────────────────────────────
# AUTH HELPERS
# ──────────────────────────────────────────────
def _get_auth_token() -> str | None:
    """
    Login and return JWT. Auto-registers admin if not yet created.

    STEP 1.2 FIX: /auth/register is now guarded by REGISTRATION_ENABLED.
    The conftest sets REGISTRATION_ENABLED via an env header workaround —
    since the test suite runs against a live Docker stack, the env flag
    must be set to 'true' in the backend's environment for the first-run
    registration to succeed. After setup the flag should be disabled.

    Strategy:
      1. Try login first — if it works we're done.
      2. If login fails, try to register (this only works if the backend
         has REGISTRATION_ENABLED=true). If register returns 403, the
         admin account must be created manually (see conftest warning).
      3. Try login again after registration.
    """
    try:
        r = httpx.post(
            f"{API_URL}/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10, follow_redirects=True,
        )
        if r.status_code == 200:
            return r.json().get("access_token")

        # Try registering then logging in.
        # If REGISTRATION_ENABLED=false this will return 403 and we skip it.
        reg = httpx.post(
            f"{API_URL}/auth/register",
            json={"name": "Test Admin", "email": TEST_EMAIL,
                  "password": TEST_PASSWORD, "role": "admin"},
            timeout=10, follow_redirects=True,
        )
        if reg.status_code == 403:
            print(
                "\n[conftest] /auth/register returned 403 — "
                "REGISTRATION_ENABLED is false on the backend.\n"
                "Create the admin user manually via the Django management shell or:\n"
                "  docker-compose exec backend python -c \"\n"
                "from app.core.database import SessionLocal\n"
                "from app.models.base_models import User\n"
                "from app.core.security import get_password_hash\n"
                "db = SessionLocal()\n"
                "db.add(User(name='Admin', email='admin@example.com', "
                "password_hash=get_password_hash('your-password'), "
                "role='admin', is_active=True))\n"
                "db.commit()\"\n"
                "See README.md for full setup instructions.\n"
            )
        r2 = httpx.post(
            f"{API_URL}/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10, follow_redirects=True,
        )
        if r2.status_code == 200:
            return r2.json().get("access_token")
    except Exception as exc:
        print(f"\n[conftest] Auth error: {exc}")
    return None


class BearerAuth(httpx.Auth):
    def __init__(self, token: str):
        self.token = token

    def auth_flow(self, request):
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request


# ──────────────────────────────────────────────
# DATABASE SEEDING
# ──────────────────────────────────────────────
def _seed_and_resolve(token: str) -> None:
    """
    Seed the database (creates academic year 2025-26 and classes Nursery–10),
    then resolve the real DB primary key ids for classes "1" and "2".
    """
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger seed endpoint
    try:
        r = httpx.post(
            f"{API_URL}/setup/seed",
            headers=headers, timeout=15, follow_redirects=True,
        )
        print(f"\n[conftest] /setup/seed → {r.status_code}")
    except Exception as exc:
        print(f"[conftest] seed request failed: {exc}")

    # 2. Fetch classes to resolve real ids
    try:
        r = httpx.get(
            f"{API_URL}/setup/classes",
            headers=headers, timeout=10, follow_redirects=True,
        )
        if r.status_code == 200:
            classes = r.json()
            for c in classes:
                if c.get("name") == "1" and _SESSION["class_id"] is None:
                    _SESSION["class_id"] = c["id"]
                if c.get("name") == "2" and _SESSION["class_id_2"] is None:
                    _SESSION["class_id_2"] = c["id"]
            # Fallback: use first class if "1" not found
            if _SESSION["class_id"] is None and classes:
                _SESSION["class_id"] = classes[0]["id"]
            if _SESSION["class_id_2"] is None and len(classes) > 1:
                _SESSION["class_id_2"] = classes[1]["id"]
            print(
                f"[conftest] resolved class_id={_SESSION['class_id']} "
                f"class_id_2={_SESSION['class_id_2']}"
            )
    except Exception as exc:
        print(f"[conftest] class fetch failed: {exc}")

    # 3. Resolve current academic year id
    try:
        r = httpx.get(
            f"{API_URL}/yearend/current-year",
            headers=headers, timeout=10, follow_redirects=True,
        )
        if r.status_code == 200:
            _SESSION["year_id"] = r.json().get("id", 1)
            print(f"[conftest] academic_year_id={_SESSION['year_id']}")
    except Exception as exc:
        print(f"[conftest] year fetch failed: {exc}")


# ──────────────────────────────────────────────
# API CLIENT FIXTURE
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    """
    Authenticated httpx client. At session start:
      - Logs in (auto-registers admin if needed)
      - Seeds the DB so classes/year exist
      - Resolves real class ids into _SESSION
    """
    token = _get_auth_token()

    if not token:
        print(
            f"\n{'='*60}\n"
            f"[conftest] WARNING: Could not authenticate.\n"
            f"  URL:      {API_URL}/auth/login\n"
            f"  Email:    {TEST_EMAIL}\n"
            f"  Password: {TEST_PASSWORD}\n"
            f"\n  To create an admin user manually:\n"
            f"    curl -X POST {API_URL}/auth/register \\\n"
            f"      -H 'Content-Type: application/json' \\\n"
            f"      -d '{{\"name\":\"Admin\",\"email\":\"{TEST_EMAIL}\","
            f"\"password\":\"{TEST_PASSWORD}\",\"role\":\"admin\"}}'\n"
            f"{'='*60}\n"
        )
        with httpx.Client(base_url=API_URL, timeout=30, follow_redirects=True) as client:
            yield client
        return

    _SESSION["token"] = token
    _seed_and_resolve(token)

    with httpx.Client(
        base_url=API_URL, timeout=30,
        follow_redirects=True, auth=BearerAuth(token),
    ) as client:
        yield client


@pytest.fixture(scope="session")
def raw_api():
    """Unauthenticated client for /docs, /health etc."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        yield client


# ──────────────────────────────────────────────
# Expose real DB class ids as session fixtures
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def class_id(api):
    """Real DB primary key for 'Std 1'. Use in GET params instead of hardcoded 1."""
    return _SESSION.get("class_id") or 1


@pytest.fixture(scope="session")
def class_id_2(api):
    """Real DB primary key for 'Std 2'."""
    return _SESSION.get("class_id_2") or _SESSION.get("class_id") or 2


@pytest.fixture(scope="session")
def year_id(api):
    """Current academic year DB id."""
    return _SESSION.get("year_id") or 1


# ──────────────────────────────────────────────
# PLAYWRIGHT — browser + context (session)
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def browser_context():
    with sync_playwright() as p:
        launcher = getattr(p, BROWSER_TYPE)
        browser = launcher.launch(headless=HEADLESS)
        ctx = browser.new_context(
            base_url=FRONTEND_URL,
            viewport={"width": 1440, "height": 900},
        )
        ctx.set_default_timeout(UI_TIMEOUT)
        yield ctx
        ctx.close()
        browser.close()


@pytest.fixture
def page(browser_context):
    """Fresh unauthenticated page per test."""
    pg = browser_context.new_page()
    yield pg
    pg.close()


def _login_page(pg: Page) -> bool:
    """
    Navigate to /login and submit credentials.
    Returns True if login succeeded (redirected away from /login).
    """
    pg.goto(f"{FRONTEND_URL}/login")
    pg.wait_for_load_state("networkidle")
    try:
        pg.fill("input[type='email']", TEST_EMAIL)
        pg.fill("input[type='password']", TEST_PASSWORD)
        pg.click("button[type='submit']")
        # Wait for redirect away from /login
        pg.wait_for_function(
            "() => !window.location.pathname.includes('/login')",
            timeout=8000
        )
        pg.wait_for_load_state("networkidle")
        return True
    except Exception as e:
        print(f"\n[conftest] UI login failed: {e}")
        return False


@pytest.fixture
def authenticated_page(browser_context):
    """
    FIX: Function-scoped authenticated page — each UI test gets its own
    fresh page that logs in cleanly before the test runs.

    Previously this was session-scoped (one shared page). That broke when:
    - test_page_refresh_stays_on_same_page reloaded the page, losing the
      in-memory JWT token, landing at /login
    - test_browser_back_button left the page at /login
    - All subsequent tests in the same session inherited that /login state

    Making it function-scoped costs ~1s per UI test for login, but guarantees
    each test starts from a clean authenticated state.
    """
    pg = browser_context.new_page()
    _login_page(pg)
    yield pg
    pg.close()


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────
def today_str() -> str:
    return date.today().isoformat()


def _resolve_class_id(raw: int | None) -> int:
    """
    Map caller-supplied class_id (1 or 2, meaning 'Std 1' or 'Std 2') to the
    real DB primary key discovered during seeding.
    """
    if raw is None or raw == 1:
        return _SESSION.get("class_id") or 1
    if raw == 2:
        return _SESSION.get("class_id_2") or _SESSION.get("class_id") or 1
    return raw


# ──────────────────────────────────────────────
# FACTORIES
# ──────────────────────────────────────────────
class StudentFactory:
    @staticmethod
    def valid(**overrides):
        first = fake.first_name()
        last  = fake.last_name()

        raw_class_id = overrides.pop("class_id", None)
        resolved_cid = _resolve_class_id(raw_class_id)

        data = {
            "name_en":          f"{first} {last}",
            "name_gu":          "રાહુલ શાહ",
            "gender":           "M",
            "dob":              "2015-06-15",
            "contact":          f"9{fake.numerify('#########')}",
            "father_name":      f"{fake.first_name()} {last}",
            "admission_date":   "2023-06-01",
            "academic_year_id": _SESSION.get("year_id", 1),
            "address":          fake.address(),
            "gr_number":        fake.bothify("GR###??").upper(),
            "roll_number":      fake.random_int(min=1, max=60),
            "class_id":         resolved_cid,
        }

        fn = overrides.pop("first_name", None)
        ln = overrides.pop("last_name",  None)
        if fn or ln:
            data["name_en"] = f"{fn or first} {ln or last}"
        if "date_of_birth" in overrides:
            overrides["dob"] = overrides.pop("date_of_birth")
        if "contact_number" in overrides:
            overrides["contact"] = overrides.pop("contact_number")
        if "first_name_gujarati" in overrides or "last_name_gujarati" in overrides:
            fgu = overrides.pop("first_name_gujarati", "")
            lgu = overrides.pop("last_name_gujarati", "")
            overrides["name_gu"] = f"{fgu} {lgu}".strip()
        if "aadhar" in overrides:
            full = str(overrides.pop("aadhar") or "")
            overrides["aadhar_last4"] = full[-4:] if len(full) >= 4 else None

        data.update(overrides)
        return data

    @staticmethod
    def minimal(**overrides):
        first = fake.first_name()
        last  = fake.last_name()

        raw_class_id = overrides.pop("class_id", None)
        resolved_cid = _resolve_class_id(raw_class_id)

        data = {
            "name_en":          f"{first} {last}",
            "name_gu":          "રાહુલ શાહ",
            "gender":           "M",
            "dob":              "2015-06-15",
            "contact":          f"9{fake.numerify('#########')}",
            "father_name":      f"{fake.first_name()} {last}",
            "admission_date":   "2023-06-01",
            "academic_year_id": _SESSION.get("year_id", 1),
            "class_id":         resolved_cid,
        }
        fn = overrides.pop("first_name", None)
        ln = overrides.pop("last_name",  None)
        if fn or ln:
            data["name_en"] = f"{fn or first} {ln or last}"
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
            "class_id":         _SESSION.get("class_id") or 1,
            "academic_year_id": _SESSION.get("year_id", 1),
        }
        overrides.pop("fee_head", None)
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
            "mode":           mode,
            "payment_date":   today_str(),
        }
        data.update(overrides)
        return data


def make_payment(student_fee_id: int, amount: float, mode: str = "Cash") -> dict:
    return {
        "student_fee_id": student_fee_id,
        "amount_paid":    amount,
        "mode":           mode,
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
# create_student fixture
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

    for sid in created_ids:
        try:
            api.delete(f"/students/{sid}")
        except Exception:
            pass


# ──────────────────────────────────────────────
# UI helper
# ──────────────────────────────────────────────
def goto(page: Page, path: str):
    page.goto(f"{FRONTEND_URL}/{path.lstrip('/')}")
    page.wait_for_load_state("networkidle")