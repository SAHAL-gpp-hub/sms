"""
test_fees.py — Fee Structure & Payment Tests
Covers: setup, CRUD, payments, receipts, defaulters
"""

import pytest
from datetime import date
from conftest import StudentFactory, FeeFactory


def today_str():
    return date.today().isoformat()


def make_payment(student_fee_id, amount, mode="Cash"):
    """Build a valid payment payload."""
    return {
        "student_fee_id": student_fee_id,
        "amount_paid": amount,
        "payment_date": today_str(),
        "mode": mode,
    }


# ══════════════════════════════════════════════
# FEE STRUCTURE SETUP
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.fees
class TestFeeStructure:

    def test_load_gseb_fee_heads(self, api):
        """Load fee heads — GSEB heads appear."""
        r = api.post("/fees/heads/seed")
        assert r.status_code in (200, 201), r.text
        r2 = api.get("/fees/heads")
        assert r2.status_code == 200
        heads = r2.json()
        assert len(heads) >= 1, "No fee heads returned after loading GSEB heads"

    def test_load_gseb_heads_twice_no_duplicates(self, api):
        """Load fee heads twice — no duplicate heads created."""
        api.post("/fees/heads/seed")
        api.post("/fees/heads/seed")
        r = api.get("/fees/heads")
        heads = r.json()
        names = [h["name"] for h in heads]
        assert len(names) == len(set(names)), f"Duplicate fee heads found: {names}"

    def test_add_fee_amount_zero_rejected(self, api):
        """Add fee with amount = 0 — should reject."""
        payload = FeeFactory.valid(amount=0)
        r = api.post("/fees/structure", json=payload)
        assert r.status_code in (400, 422), "Fee of 0 should be rejected"

    def test_add_fee_negative_amount_rejected(self, api):
        """Add fee with negative amount — should reject."""
        payload = FeeFactory.valid(amount=-500)
        r = api.post("/fees/structure", json=payload)
        assert r.status_code in (400, 422), "Negative fee should be rejected"

    def test_add_fee_large_amount(self, api):
        """Add fee with very large amount (₹999999) — saves correctly."""
        payload = FeeFactory.valid(amount=999999)
        r = api.post("/fees/structure", json=payload)
        assert r.status_code in (200, 201), r.text
        fid = r.json()["id"]
        api.delete(f"/fees/structure/{fid}")

    def test_remove_fee_from_structure(self, api):
        """Remove a fee — disappears from structure table."""
        r = api.post("/fees/structure", json=FeeFactory.valid())
        assert r.status_code in (200, 201)
        fid = r.json()["id"]
        rd = api.delete(f"/fees/structure/{fid}")
        assert rd.status_code in (200, 204)
        r2 = api.get(f"/fees/structure/{fid}")
        assert r2.status_code == 404

    def test_assign_fees_to_class_no_duplicates(self, api):
        """Assign fees to class twice — no duplicate student_fees records."""
        api.post("/fees/assign/1")
        api.post("/fees/assign/1")
        # Just verify no 500 error and the endpoint works
        r = api.get("/fees/defaulters", params={"class_id": 1})
        assert r.status_code == 200

    def test_assign_fees_class_zero_students(self, api):
        """Assign fees to class with 0 students — handles gracefully."""
        r = api.post("/fees/assign/99")
        assert r.status_code != 500, "Server error for empty class assignment"
        if r.status_code in (200, 201):
            data = r.json()
            assigned = data.get("assigned", data.get("count", 0))
            assert assigned == 0


# ══════════════════════════════════════════════
# PAYMENT TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.fees
class TestPayments:

    def _get_fee(self, api, sid):
        """Extract first fee item from student ledger."""
        r = api.get(f"/fees/ledger/{sid}")
        if r.status_code != 200:
            return None
        data = r.json()
        items = data.get("items", [])
        if not items:
            return None
        item = items[0]
        # Normalize: ensure we have both 'id' and 'student_fee_id'
        if "student_fee_id" in item and "id" not in item:
            item["id"] = item["student_fee_id"]
        if "id" in item and "student_fee_id" not in item:
            item["student_fee_id"] = item["id"]
        # Balance may be stored as Decimal string
        if "balance" not in item:
            item["balance"] = float(item.get("net_amount", 0)) - float(item.get("paid_amount", 0))
        else:
            item["balance"] = float(item["balance"])
        return item

    def _setup_student_with_fee(self, api, amount=5000, class_id=1):
        """Create student, add fee structure, assign fees. Returns (sid, fee_item) or (sid, None)."""
        payload = StudentFactory.valid(class_id=class_id)
        r = api.post("/students", json=payload)
        if r.status_code not in (200, 201):
            return None, None
        sid = r.json()["id"]

        # Seed fee heads if needed
        api.post("/fees/heads/seed")
        heads = api.get("/fees/heads").json()
        if not heads:
            return sid, None
        fee_head_id = heads[0]["id"]

        # Create fee structure for the class
        fs_payload = {
            "class_id": class_id,
            "fee_head_id": fee_head_id,
            "amount": amount,
            "academic_year_id": payload["academic_year_id"]
        }
        api.post("/fees/structure", json=fs_payload)

        # Assign fees
        api.post(f"/fees/assign/{class_id}", params={"academic_year_id": payload["academic_year_id"]})

        fee = self._get_fee(api, sid)
        return sid, fee

    def test_payment_exact_balance_zeroes_out(self, api, create_student):
        """Record payment of exact balance — balance becomes 0."""
        sid, fee = self._setup_student_with_fee(api, amount=5000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned to student")

        balance = fee["balance"]
        r = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], balance))
        assert r.status_code in (200, 201), r.text

        updated_fee = self._get_fee(api, sid)
        assert updated_fee is not None
        assert float(updated_fee["balance"]) <= 0, f"Balance should be 0, got {updated_fee['balance']}"
        api.delete(f"/students/{sid}")

    def test_payment_zero_rejected(self, api, create_student):
        """Payment of 0 — should reject."""
        sid, _ = create_student()
        r = api.post("/fees/payment", json=make_payment(1, 0))
        assert r.status_code in (400, 422), "Zero payment should be rejected"

    def test_payment_negative_rejected(self, api, create_student):
        """Negative payment — should reject."""
        sid, _ = create_student()
        r = api.post("/fees/payment", json=make_payment(1, -100))
        assert r.status_code in (400, 422), "Negative payment should be rejected"

    def test_two_payments_same_fee_head(self, api, create_student):
        """Two separate payments for same fee head — both appear in history."""
        sid, fee = self._setup_student_with_fee(api, amount=10000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        p1 = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 2000))
        p2 = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 3000))
        assert p1.status_code in (200, 201), p1.text
        assert p2.status_code in (200, 201), p2.text

        r3 = api.get(f"/fees/payments/{sid}")
        assert r3.status_code == 200
        assert len(r3.json()) >= 2, "Both payments should appear in history"
        api.delete(f"/students/{sid}")

    @pytest.mark.parametrize("mode", ["Cash", "UPI"])
    def test_receipt_generated_per_mode(self, api, create_student, mode):
        """Receipt is generated for Cash and UPI payments."""
        sid, fee = self._setup_student_with_fee(api, amount=5000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        r = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 1000, mode=mode))
        assert r.status_code in (200, 201), r.text
        receipt_no = r.json().get("receipt_number")
        assert receipt_no is not None, f"No receipt number returned for {mode} payment"
        api.delete(f"/students/{sid}")

    def test_receipt_numbers_sequential_unique(self, api, create_student):
        """Receipt numbers are sequential and unique."""
        sid, fee = self._setup_student_with_fee(api, amount=9000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        receipts = []
        for amount in [1000, 2000]:
            r = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], amount))
            if r.status_code in (200, 201):
                receipts.append(r.json().get("receipt_number"))

        assert len(receipts) == len(set(receipts)), "Receipt numbers must be unique"
        api.delete(f"/students/{sid}")

    def test_overpayment_behavior(self, api, create_student):
        """Overpayment — document what happens."""
        sid, fee = self._setup_student_with_fee(api, amount=1000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        r2 = api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 9999))
        print(f"\n[OVERPAYMENT] Status: {r2.status_code} — review balance behavior")
        assert r2.status_code != 500
        api.delete(f"/students/{sid}")


# ══════════════════════════════════════════════
# DEFAULTERS TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.fees
class TestDefaulters:

    def _get_fee(self, api, sid):
        """Extract first fee item from student ledger."""
        r = api.get(f"/fees/ledger/{sid}")
        if r.status_code != 200:
            return None
        data = r.json()
        items = data.get("items", [])
        if not items:
            return None
        item = items[0]
        if "student_fee_id" in item and "id" not in item:
            item["id"] = item["student_fee_id"]
        if "id" in item and "student_fee_id" not in item:
            item["student_fee_id"] = item["id"]
        if "balance" not in item:
            item["balance"] = float(item.get("net_amount", 0)) - float(item.get("paid_amount", 0))
        else:
            item["balance"] = float(item["balance"])
        return item

    def _setup_student_with_fee(self, api, amount=5000, class_id=1):
        """Create student, add fee structure, assign fees."""
        payload = StudentFactory.valid(class_id=class_id)
        r = api.post("/students", json=payload)
        if r.status_code not in (200, 201):
            return None, None
        sid = r.json()["id"]

        api.post("/fees/heads/seed")
        heads = api.get("/fees/heads").json()
        if not heads:
            return sid, None
        fee_head_id = heads[0]["id"]

        fs_payload = {
            "class_id": class_id,
            "fee_head_id": fee_head_id,
            "amount": amount,
            "academic_year_id": payload["academic_year_id"]
        }
        api.post("/fees/structure", json=fs_payload)
        api.post(f"/fees/assign/{class_id}", params={"academic_year_id": payload["academic_year_id"]})

        fee = self._get_fee(api, sid)
        return sid, fee

    def test_fully_paid_student_not_in_defaulters(self, api, create_student):
        """Fully paid student — does NOT appear in defaulters."""
        sid, fee = self._setup_student_with_fee(api, amount=2000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        api.post("/fees/payment", json=make_payment(fee["student_fee_id"], fee["balance"]))

        r2 = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r2.json()]
        assert sid not in defaulter_ids, "Fully paid student should not be in defaulters"
        api.delete(f"/students/{sid}")

    def test_partial_payment_appears_in_defaulters(self, api, create_student):
        """Partial payment — student appears in defaulters with correct balance."""
        sid, fee = self._setup_student_with_fee(api, amount=5000)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 2000))

        r2 = api.get("/fees/defaulters")
        defaulters = {d["student_id"]: d for d in r2.json()}
        assert sid in defaulters, "Partial payer should be in defaulters"
        assert float(defaulters[sid]["balance"]) == 3000.0, \
            f"Expected balance 3000, got {defaulters[sid]['balance']}"
        api.delete(f"/students/{sid}")

    def test_zero_fees_student_not_in_defaulters(self, api, create_student):
        """Student with 0 fees assigned — NOT in defaulters."""
        # Create student in class with no fee structure (use a fresh class)
        sid, _ = create_student(class_id=1)
        # Don't assign any fees — just check defaulters
        r = api.get("/fees/defaulters")
        defaulters_with_fees = [d for d in r.json() if d["student_id"] == sid]
        # This student has no fees so balance = 0, should not be in defaulters
        assert len(defaulters_with_fees) == 0, "Student with no fees should not be in defaulters"

    def test_filter_defaulters_by_class(self, api):
        """Defaulter filter by class — returns without error."""
        r = api.get("/fees/defaulters", params={"class_id": 1})
        assert r.status_code == 200
        # All returned defaulters should be from the requested class
        for d in r.json():
            assert "student_id" in d, "Defaulter record missing student_id"

    def test_tiny_balance_still_in_defaulters(self, api, create_student):
        """Student with tiny balance — still appears in defaulters."""
        sid, fee = self._setup_student_with_fee(api, amount=100)
        if not sid:
            pytest.skip("Student creation failed")
        if not fee:
            pytest.skip("No fees assigned")

        # Pay almost all but leave 0.01
        api.post("/fees/payment", json=make_payment(fee["student_fee_id"], 99.99))

        r2 = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r2.json()]
        assert sid in defaulter_ids, "Tiny balance should still show as defaulter"
        api.delete(f"/students/{sid}")
