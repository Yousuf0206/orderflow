"""Delivery-note scan to dispatch draft (spec 008).

The reading service is faked: no test calls the vendor (constitution XXVII).
The images are minimal JPEG/PNG byte strings -- the server only checks their
magic bytes and size; what they "say" comes from the fake reader.
"""

from datetime import date, timedelta

import pytest

from src.core.config import settings
from src.main import app
from src.services.scan_reader import ReaderError, get_reader
from tests.conftest import accept_invite, auth_headers, signup

TODAY = date.today()
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

LINES = [
    {"material": "Steel bar 12mm", "ordered_qty": 50, "unit": "tonne"},
    {"material": "Cement OPC-53", "ordered_qty": 200, "unit": "bag"},
    {"material": "Sand", "ordered_qty": 10, "unit": "truck"},
]

PRINTED_NOTE = {
    "readable": True,
    "document_date": TODAY.isoformat(),
    "document_date_confidence": "high",
    "vehicle_ref": "LES-1234",
    "vehicle_ref_confidence": "medium",
    "lines": [
        {"description": "OPC 53 Grade cement", "qty": "40", "qty_confidence": "high", "unit": "bags",
         "handwritten": False},
        {"description": "12mm steel bars", "qty": "5", "qty_confidence": "high", "unit": "MT",
         "handwritten": False},
        {"description": "Paint white 20L", "qty": "2", "qty_confidence": "high", "unit": "tin",
         "handwritten": False},
    ],
}


class FakeReader:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, 0

    def read(self, image, content_type):
        self.calls += 1
        if self.error:
            raise ReaderError(self.error)
        return self.result


@pytest.fixture()
def reader():
    fake = FakeReader(PRINTED_NOTE)
    app.dependency_overrides[get_reader] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_reader, None)


@pytest.fixture(autouse=True)
def scanning_on(monkeypatch):
    monkeypatch.setattr(settings, "scan_enabled", True)
    monkeypatch.setattr(settings, "anthropic_zero_retention_confirmed", True)
    monkeypatch.setattr(settings, "scan_model", "claude-sonnet-5-5")
    monkeypatch.setattr(settings, "scan_daily_limit_per_org", 50)


def _setup(client, email="scan@test.com", org="Scan Org"):
    headers = auth_headers(signup(client, email=email, org_name=org))
    party = client.post("/parties", json={"party_code": "S1", "party_name": "Scan Party"}, headers=headers).json()
    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-S1",
            "order_date": (TODAY - timedelta(days=30)).isoformat(),
            "due_date": (TODAY + timedelta(days=30)).isoformat(),
            "lines": LINES,
        },
        headers=headers,
    ).json()
    return headers, po


def _scan(client, headers, po, image=JPEG, name="note.jpg"):
    return client.post(
        f"/purchase-orders/{po['id']}/dispatches/parse-document",
        files={"image": (name, image, "image/jpeg")},
        headers=headers,
    )


def _po(client, headers, po):
    return client.get(f"/purchase-orders/{po['id']}", headers=headers).json()


def _dispatches(client, headers, po):
    return client.get(f"/purchase-orders/{po['id']}/dispatches", headers=headers).json()


def test_scan_returns_draft_and_changes_nothing(client, reader):
    headers, po = _setup(client)
    resp = _scan(client, headers, po)
    assert resp.status_code == 200, resp.text
    draft = resp.json()
    by_text = {line["raw_text"]: line for line in draft["lines"]}
    assert by_text["OPC 53 Grade cement"]["matched_line_id"] == po["lines"][1]["id"]
    assert by_text["12mm steel bars"]["matched_line_id"] == po["lines"][0]["id"]
    assert by_text["Paint white 20L"]["matched_line_id"] is None
    assert draft["vehicle_ref"] == {"value": "LES-1234", "confidence": "medium"}
    # Draft only: no dispatch, remaining untouched (constitution XXXVIII).
    assert _dispatches(client, headers, po) == []
    assert all(line["remaining_qty"] == line["ordered_qty"] for line in _po(client, headers, po)["lines"])


def test_matched_ids_only_ever_from_this_po(client, reader):
    headers, po = _setup(client)
    other = client.post(
        "/purchase-orders",
        json={
            "party_id": po["party_id"],
            "po_number": "PO-S2",
            "order_date": TODAY.isoformat(),
            "due_date": (TODAY + timedelta(days=5)).isoformat(),
            "lines": [{"material": "Paint white 20L", "ordered_qty": 10, "unit": "tin"}],
        },
        headers=headers,
    ).json()
    own_ids = {line["id"] for line in po["lines"]}
    draft = _scan(client, headers, po).json()
    matched = {line["matched_line_id"] for line in draft["lines"]} - {None}
    assert matched <= own_ids
    assert other["lines"][0]["id"] not in matched


def test_confirm_records_one_ordinary_dispatch_and_links_scan(client, reader):
    headers, po = _setup(client)
    draft = _scan(client, headers, po).json()
    body = {
        "dispatch_date": TODAY.isoformat(),
        "vehicle_ref": "LES-1234",
        "lines": [{"purchase_order_line_id": po["lines"][1]["id"], "qty": 40}],
        "source_scan_id": draft["scan_id"],
    }
    resp = client.post(f"/purchase-orders/{po['id']}/dispatches", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    assert _po(client, headers, po)["lines"][1]["remaining_qty"] == 160
    # Reusing the scan is refused and records nothing more.
    again = client.post(f"/purchase-orders/{po['id']}/dispatches", json=body, headers=headers)
    assert again.status_code == 409
    assert len(_dispatches(client, headers, po)) == 1


def test_another_users_scan_cannot_be_confirmed(client, reader):
    headers, po = _setup(client)
    draft = _scan(client, headers, po).json()
    invite = client.post("/org/members/invite", json={"email": "s2@test.com", "role": "staff"}, headers=headers)
    staff = auth_headers(accept_invite(client, invite.json()["id"]))
    resp = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "lines": [{"purchase_order_line_id": po["lines"][1]["id"], "qty": 1}],
            "source_scan_id": draft["scan_id"],
        },
        headers=staff,
    )
    assert resp.status_code == 409
    assert _dispatches(client, headers, po) == []


def test_viewer_cannot_scan(client, reader):
    headers, po = _setup(client)
    invite = client.post("/org/members/invite", json={"email": "v@test.com", "role": "viewer"}, headers=headers)
    viewer = auth_headers(accept_invite(client, invite.json()["id"]))
    assert _scan(client, viewer, po).status_code == 403
    assert reader.calls == 0


def test_other_organizations_po_is_not_found(client, reader):
    _, po = _setup(client)
    stranger = auth_headers(signup(client, email="x@other.com", org_name="Other"))
    assert _scan(client, stranger, po).status_code == 404
    assert reader.calls == 0


@pytest.mark.parametrize(
    ("error", "code"),
    [("unreadable", 422), ("reader_failed", 502), ("reader_timeout", 504)],
)
def test_reader_failures_give_no_draft(client, error, code):
    fake = FakeReader(error=error)
    app.dependency_overrides[get_reader] = lambda: fake
    try:
        headers, po = _setup(client)
        resp = _scan(client, headers, po)
        assert resp.status_code == code
        assert resp.json()["detail"] == error
        assert _dispatches(client, headers, po) == []
    finally:
        app.dependency_overrides.pop(get_reader, None)


def test_blank_note_is_unreadable(client):
    fake = FakeReader({"readable": True, "document_date": None, "vehicle_ref": None, "lines": []})
    app.dependency_overrides[get_reader] = lambda: fake
    try:
        headers, po = _setup(client)
        assert _scan(client, headers, po).status_code == 422
    finally:
        app.dependency_overrides.pop(get_reader, None)


def test_png_accepted_other_types_refused(client, reader):
    headers, po = _setup(client)
    assert _scan(client, headers, po, image=PNG, name="n.png").status_code == 200
    resp = _scan(client, headers, po, image=b"%PDF-1.7 not an image", name="n.jpg")
    assert resp.status_code == 415


def test_too_large(client, reader, monkeypatch):
    monkeypatch.setattr(settings, "scan_max_bytes", 32)
    headers, po = _setup(client)
    assert _scan(client, headers, po).status_code == 413
    assert reader.calls == 0


def test_daily_limit_counts_failures_and_stops_before_vendor(client, monkeypatch):
    monkeypatch.setattr(settings, "scan_daily_limit_per_org", 2)
    fake = FakeReader(error="unreadable")
    app.dependency_overrides[get_reader] = lambda: fake
    try:
        headers, po = _setup(client)
        assert _scan(client, headers, po).status_code == 422
        assert _scan(client, headers, po).status_code == 422
        resp = _scan(client, headers, po)
        assert resp.status_code == 429
        assert resp.json()["detail"] == "daily_scan_limit"
        assert fake.calls == 2
    finally:
        app.dependency_overrides.pop(get_reader, None)


def test_disabled(client, reader, monkeypatch):
    monkeypatch.setattr(settings, "scan_enabled", False)
    headers, po = _setup(client)
    assert _scan(client, headers, po).status_code == 503
    assert reader.calls == 0


def test_fully_dispatched_po_cannot_be_scanned(client, reader):
    headers, po = _setup(client)
    client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "lines": [{"purchase_order_line_id": line["id"], "qty": line["ordered_qty"]} for line in po["lines"]],
        },
        headers=headers,
    )
    assert _scan(client, headers, po).status_code == 409


# --- retention (T030, constitution XLI) --------------------------------------


def _db():
    from src.core.db import get_db

    return next(app.dependency_overrides[get_db]())


def test_images_expire_after_30_days(client, reader):
    from datetime import UTC, datetime

    from src.models.document_scan import DocumentScan, ScanImage
    from src.services.account_deletion import expire_scans

    headers, po = _setup(client)
    scan_id = _scan(client, headers, po).json()["scan_id"]
    db = _db()
    assert expire_scans(db, now=datetime.now(UTC) + timedelta(days=29)) == 0
    db.commit()
    assert db.get(ScanImage, scan_id) is not None

    assert expire_scans(db, now=datetime.now(UTC) + timedelta(days=31)) == 1
    db.commit()
    db.expire_all()
    assert db.get(ScanImage, scan_id) is None
    assert db.get(DocumentScan, scan_id).draft_json is None


def test_purged_organization_takes_its_scans(client, reader):
    from datetime import UTC, datetime

    from src.models.document_scan import DocumentScan, ScanImage
    from src.services.account_deletion import purge_due

    headers, po = _setup(client)
    scan_id = _scan(client, headers, po).json()["scan_id"]
    preview = client.get("/auth/account/deletion-preview", headers=headers).json()
    names = [org["name"] for org in preview["organizations_deleted"]]
    resp = client.request(
        "DELETE", "/auth/account", json={"confirm_organization_names": names}, headers=headers
    )
    assert resp.status_code in (200, 204), resp.text
    db = _db()
    purge_due(db, now=datetime.now(UTC) + timedelta(days=31))
    db.commit()
    db.expire_all()
    assert db.get(DocumentScan, scan_id) is None
    assert db.get(ScanImage, scan_id) is None


def test_metrics_compare_draft_with_saved_dispatch(client, reader):
    from src.services.scan_metrics import scan_metrics

    headers, po = _setup(client)
    draft = _scan(client, headers, po).json()
    client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "vehicle_ref": "LES-1234",
            # cement as read (40); steel corrected from 5 to 4
            "lines": [
                {"purchase_order_line_id": po["lines"][1]["id"], "qty": 40},
                {"purchase_order_line_id": po["lines"][0]["id"], "qty": 4},
            ],
            "source_scan_id": draft["scan_id"],
        },
        headers=headers,
    )
    metrics = scan_metrics(_db())
    assert metrics["scans_by_status"] == {"confirmed": 1}
    # date, vehicle, cement unchanged; steel edited -> 1 of 4
    assert metrics["share_of_fields_edited"] == 0.25
    assert metrics["median_scan_to_confirm_seconds"] is not None


# --- zero data retention guard (owner requirement, constitution XLI) ---------


def test_no_scanning_without_confirmed_zero_retention(client, reader, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_zero_retention_confirmed", False)
    headers, po = _setup(client)
    resp = _scan(client, headers, po)
    assert resp.status_code == 503
    assert reader.calls == 0  # the image never leaves our server
    assert client.get("/auth/me", headers=headers).json()["scan_enabled"] is False


@pytest.mark.parametrize("model", ["claude-fable-5-1", "claude-mythos-5"])
def test_models_that_require_retention_are_refused(client, reader, monkeypatch, model):
    monkeypatch.setattr(settings, "scan_model", model)
    headers, po = _setup(client)
    assert _scan(client, headers, po).status_code == 503
    assert reader.calls == 0
