import uuid

import httpx
import pytest

from conftest import API_URL, TEST_PASSWORD, make_payment


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@iqraschool.in"


def _login(email: str, password: str = TEST_PASSWORD) -> httpx.Client:
    r = httpx.post(
        f"{API_URL}/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
        follow_redirects=True,
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return httpx.Client(
        base_url=API_URL,
        timeout=30,
        follow_redirects=True,
        headers={"Authorization": f"Bearer {token}"},
    )


def _create_user(api, role: str) -> dict:
    email = _unique_email(role)
    r = api.post(
        "/admin/users",
        json={
            "name": f"RBAC {role.title()}",
            "email": email,
            "password": TEST_PASSWORD,
            "role": role,
            "is_active": True,
        },
    )
    assert r.status_code in (200, 201), r.text
    user = r.json()
    user["password"] = TEST_PASSWORD
    return user


@pytest.mark.api
@pytest.mark.rbac
def test_teacher_cannot_record_payment(api):
    teacher = _create_user(api, "teacher")
    with _login(teacher["email"]) as teacher_client:
        r = teacher_client.post("/fees/payment", json=make_payment(1, 100))
    assert r.status_code == 403


@pytest.mark.api
@pytest.mark.rbac
def test_teacher_cannot_access_unassigned_class(api, class_id, class_id_2, year_id):
    teacher = _create_user(api, "teacher")
    r = api.post(
        f"/admin/teachers/{teacher['id']}/assign-class",
        json={"class_id": class_id, "academic_year_id": year_id},
    )
    assert r.status_code in (200, 201, 409), r.text

    with _login(teacher["email"]) as teacher_client:
        r = teacher_client.get("/marks/exams", params={"class_id": class_id_2})
    assert r.status_code == 403


@pytest.mark.api
@pytest.mark.rbac
def test_student_cannot_see_other_student_results(api, create_student):
    own_student_id, _ = create_student()
    other_student_id, _ = create_student()
    student_user = _create_user(api, "student")
    r = api.post(
        "/admin/portal/link-student",
        json={"user_id": student_user["id"], "student_id": own_student_id, "role": "student"},
    )
    assert r.status_code == 200, r.text

    with _login(student_user["email"]) as student_client:
        r = student_client.get(
            "/marks/results",
            params={"exam_id": 1, "student_id": other_student_id},
        )
    assert r.status_code == 403


@pytest.mark.api
@pytest.mark.rbac
def test_parent_cannot_see_unlinked_student_ledger(api, create_student):
    linked_student_id, _ = create_student()
    unlinked_student_id, _ = create_student()
    parent_user = _create_user(api, "parent")
    r = api.post(
        "/admin/portal/link-student",
        json={"user_id": parent_user["id"], "student_id": linked_student_id, "role": "parent"},
    )
    assert r.status_code == 200, r.text

    with _login(parent_user["email"]) as parent_client:
        r = parent_client.get(f"/fees/ledger/{unlinked_student_id}")
    assert r.status_code == 403
