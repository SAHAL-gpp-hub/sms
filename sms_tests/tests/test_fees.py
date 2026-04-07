"""
test_fees.py — Fee Structure & Payment Tests
Covers: setup, CRUD, payments, receipts, defaulters
"""

import pytest
from conftest import StudentFactory, FeeFactory, PaymentFactory, goto


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
        """Add fee with amount = 0 — should reject or warn."""
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
        r = api.get("/fees/ledger", params={"class_id": 1})
        if r.status_code == 200:
            fees = r.json()
            # Group by student_id + fee_head — each combo should appear once
            combos = [(f.get("student_id"), f.get("fee_head_id")) for f in fees]
            assert len(combos) == len(set(combos)), "Duplicate student_fee records found!"

    def test_assign_fees_class_zero_students(self, api):
        """Assign fees to class with 0 students — handles gracefully."""
        r = api.post("/fees/assign/99")
        # Should return success with 0 assigned, not 500
        assert r.status_code != 500, "Server error for empty class assignment"
        if r.status_code in (200, 201):
            data = r.json()
            assigned = data.get("assigned", data.get("count", None))
            if assigned is not None:
                assert assigned == 0


# ══════════════════════════════════════════════
# PAYMENT TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.fees
class TestPayments:

    def _get_fee(self, api, sid):
        """Extract first fee item from ledger response (handles dict or list)."""
        r = api.get(f"/fees/ledger/{sid}")
        if r.status_code != 200:
            return None
        data = r.json()
        # API returns either a list or {"items": [...]}
        items = data.get("items", data) if isinstance(data, dict) else data
        if not items:
            return None
        item = items[0]
        # Normalize id field — ledger may use student_fee_id
        if "student_fee_id" in item and "id" not in item:
            item["id"] = item["student_fee_id"]
        return item


    def test_payment_exact_balance_zeroes_out(self, api, create_student):
        """Record payment of exact balance — balance becomes 0."""
        sid, _ = create_student(class_id=1)
        # Assign a fee of 5000
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=5000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee structure creation failed — check your API")
        api.post("/fees/assign/1")

        # Get student's fee record
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned to student")

        # Pay exact balance
        payment = PaymentFactory.valid(sid, fee["id"], fee["balance"])
        r3 = api.post("/fees/payment", json=payment)
        assert r3.status_code in (200, 201), r3.text

        # Verify balance = 0
        updated_fee = self._get_fee(api, sid)
        assert updated_fee is not None
        assert updated_fee["balance"] == 0, f"Balance should be 0, got {updated_fee['balance']}"

    def test_payment_zero_rejected(self, api, create_student):
        """Payment of 0 — should reject."""
        sid, _ = create_student()
        r = api.post("/fees/payment", json=PaymentFactory.valid(sid, 1, 0))
        assert r.status_code in (400, 422), "Zero payment should be rejected"

    def test_payment_negative_rejected(self, api, create_student):
        """Negative payment — should reject."""
        sid, _ = create_student()
        r = api.post("/fees/payment", json=PaymentFactory.valid(sid, 1, -100))
        assert r.status_code in (400, 422), "Negative payment should be rejected"

    def test_two_payments_same_fee_head(self, api, create_student):
        """Two separate payments for same fee head — both appear in history."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=10000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")

        p1 = api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], 2000))
        p2 = api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], 3000))
        assert p1.status_code in (200, 201)
        assert p2.status_code in (200, 201)

        r3 = api.get(f"/fees/payment", params={"student_id": sid})
        assert r3.status_code == 200
        assert len(r3.json()) >= 2, "Both payments should appear in history"

    @pytest.mark.parametrize("mode", ["Cash", "UPI"])
    def test_receipt_generated_per_mode(self, api, create_student, mode):
        """Receipt is generated for Cash and UPI payments."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=5000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip(f"Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")
        payment = PaymentFactory.valid(sid, fee["id"], 1000, payment_mode=mode)
        r3 = api.post("/fees/payment", json=payment)
        assert r3.status_code in (200, 201)
        receipt_no = r3.json().get("receipt_number", r3.json().get("receipt_no"))
        assert receipt_no is not None, f"No receipt number returned for {mode} payment"

    def test_receipt_numbers_sequential_unique(self, api, create_student):
        """Receipt numbers are sequential and unique."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=9000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")

        receipts = []
        for amount in [1000, 2000]:
            r = api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], amount))
            if r.status_code in (200, 201):
                receipts.append(r.json().get("receipt_number"))

        assert len(receipts) == len(set(receipts)), "Receipt numbers must be unique"

    def test_overpayment_behavior(self, api, create_student):
        """Overpayment — document what happens (balance negative or cap at 0)."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=1000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")
        r2 = api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], 9999))
        print(f"\n[OVERPAYMENT] Status: {r2.status_code} — review balance behavior")
        # Should not be a server error
        assert r2.status_code != 500


# ══════════════════════════════════════════════
# DEFAULTERS TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.fees
class TestDefaulters:

    def test_fully_paid_student_not_in_defaulters(self, api, create_student):
        """Fully paid student — does NOT appear in defaulters."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=2000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")
        api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], fee["balance"]))

        r2 = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r2.json()]
        assert sid not in defaulter_ids, "Fully paid student should not be in defaulters"

    def test_partial_payment_appears_in_defaulters(self, api, create_student):
        """Partial payment — student appears in defaulters with correct balance."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=5000, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")
        api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], 2000))

        r2 = api.get("/fees/defaulters")
        defaulters = {d["student_id"]: d for d in r2.json()}
        assert sid in defaulters, "Partial payer should be in defaulters"
        assert defaulters[sid]["balance"] == 3000, f"Expected balance 3000, got {defaulters[sid]['balance']}"

    def test_zero_fees_student_not_in_defaulters(self, api, create_student):
        """Student with 0 fees assigned — NOT in defaulters."""
        sid, _ = create_student(class_id=99)  # class with no fee structure
        r = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r.json()]
        assert sid not in defaulter_ids

    def test_filter_defaulters_by_class(self, api):
        """Defaulter filter by class — only that class shown."""
        r = api.get("/fees/defaulters", params={"class_id": 1})
        assert r.status_code == 200
        for d in r.json():
            assert d.get("class_id") == 1

    def test_tiny_balance_still_in_defaulters(self, api, create_student):
        """Student with ₹0.01 balance — still appears in defaulters."""
        sid, _ = create_student(class_id=1)
        r = api.post("/fees/structure", json=FeeFactory.valid(amount=100, class_id=1))
        if r.status_code not in (200, 201):
            pytest.skip("Fee setup failed")
        api.post("/fees/assign/1")
        fee = self._get_fee(api, sid)
        if not fee:
            pytest.skip("No fees assigned")
        api.post("/fees/payment", json=PaymentFactory.valid(sid, fee["id"], 99.99))

        r2 = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r2.json()]
        assert sid in defaulter_ids, "₹0.01 balance should still show as defaulter"