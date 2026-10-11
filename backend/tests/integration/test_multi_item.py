"""Multi-item purchase orders through the API (spec 006, US1/US2/US4/US5).

One paper PO -> one OrderFlow PO with many lines; one truck -> one dispatch
across several lines; remaining per line, never summed across units.
"""

import csv
import io
from datetime import date, timedelta

from tests.conftest import auth_headers, signup

TODAY = date.today()

THREE_LINES = [
    {"material": "Steel bar 12mm", "ordered_qty": 50, "unit": "tonne"},
    {"material": "Cement OPC", "ordered_qty": 200, "unit": "bag"},
    {"material": "Sand", "ordered_qty": 10, "unit": "truck"},
]


def _setup(client, email="multi@test.com", org="Multi Org"):
    headers = auth_headers(signup(client, email=email, org_name=org))
    party = client.post(
        "/parties", json={"party_code": "M1", "party_name": "Multi Party"}, headers=headers
    ).json()
    return headers, party


def _create_po(client, headers, party, *, number="PO-M1", lines=None, due_offset=30):
    return client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": number,
            "order_date": (TODAY - timedelta(days=60)).isoformat(),
            "due_date": (TODAY + timedelta(days=due_offset)).isoformat(),
            "lines": lines if lines is not None else THREE_LINES,
        },
        headers=headers,
    )


def _dispatch(client, headers, po, quantities, confirm=False):
    """quantities: {line_index: qty}."""
    return client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "vehicle_ref": "LEA-1234",
            "lines": [
                {"purchase_order_line_id": po["lines"][i]["id"], "qty": q} for i, q in quantities.items()
            ],
            "confirm": confirm,
        },
        headers=headers,
    )


# --- create (US1) ----------------------------------------------------------


def test_create_three_line_po_keeps_order_and_starts_at_full_remaining(client):
    headers, party = _setup(client)
    resp = _create_po(client, headers, party)
    assert resp.status_code == 201, resp.text
    po = resp.json()
    assert po["item_count"] == 3
    assert po["material_summary"] == "Steel bar 12mm +2 more"
    assert [(l["line_no"], l["material"], l["unit"]) for l in po["lines"]] == [
        (1, "Steel bar 12mm", "tonne"),
        (2, "Cement OPC", "bag"),
        (3, "Sand", "truck"),
    ]
    assert all(l["dispatched_qty"] == 0 and l["remaining_qty"] == l["ordered_qty"] for l in po["lines"])


def test_po_with_zero_lines_is_rejected(client):
    headers, party = _setup(client)
    resp = _create_po(client, headers, party, lines=[])
    assert resp.status_code == 422
    assert client.get("/purchase-orders", headers=headers).json() == []


def test_line_errors_point_at_the_line_and_save_nothing(client):
    headers, party = _setup(client)
    bad = [THREE_LINES[0], {"material": "Cement", "ordered_qty": 0, "unit": "bag"}]
    resp = _create_po(client, headers, party, lines=bad)
    assert resp.status_code == 422
    locs = [e["loc"] for e in resp.json()["detail"]]
    assert ["body", "lines", 1, "ordered_qty"] in locs
    assert client.get("/purchase-orders", headers=headers).json() == []


def test_blank_material_or_unit_is_rejected(client):
    headers, party = _setup(client)
    resp = _create_po(client, headers, party, lines=[{"material": "  ", "ordered_qty": 5, "unit": "bag"}])
    assert resp.status_code == 422


def test_pre_006_single_material_body_is_refused_not_silently_dropped(client):
    headers, party = _setup(client)
    resp = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-OLD",
            "material": "Steel",
            "ordered_qty": 100,
            "unit": "ton",
            "order_date": TODAY.isoformat(),
            "due_date": TODAY.isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_same_material_in_two_units_stays_two_lines(client):
    headers, party = _setup(client)
    lines = [
        {"material": "Cement", "ordered_qty": 100, "unit": "bag"},
        {"material": "Cement", "ordered_qty": 5, "unit": "tonne"},
    ]
    po = _create_po(client, headers, party, lines=lines).json()
    assert po["remaining_by_unit"] == [
        {"unit": "bag", "remaining": 100},
        {"unit": "tonne", "remaining": 5},
    ]


# --- dispatch (US2) --------------------------------------------------------


def test_one_truck_two_lines_updates_only_those_lines(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()

    resp = _dispatch(client, headers, po, {0: 20, 1: 100})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["warning"] is None
    assert [(l["material"], l["qty"]) for l in body["dispatch"]["lines"]] == [
        ("Steel bar 12mm", 20),
        ("Cement OPC", 100),
    ]

    after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert [l["remaining_qty"] for l in after["lines"]] == [30, 100, 10]

    history = client.get(f"/purchase-orders/{po['id']}/dispatches", headers=headers).json()
    assert len(history) == 1
    assert history[0]["vehicle_ref"] == "LEA-1234"
    assert len(history[0]["lines"]) == 2


def test_dispatch_one_line_only(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    assert _dispatch(client, headers, po, {2: 4}).status_code == 201
    after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert [l["remaining_qty"] for l in after["lines"]] == [50, 200, 6]


def test_dispatch_with_no_lines_is_rejected(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    assert _dispatch(client, headers, po, {}).status_code == 422


def test_zero_or_negative_line_qty_is_rejected(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    assert _dispatch(client, headers, po, {0: 0}).status_code == 422
    assert _dispatch(client, headers, po, {0: -1}).status_code == 422


def test_same_line_twice_in_one_dispatch_is_rejected(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    line_id = po["lines"][0]["id"]
    resp = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "lines": [
                {"purchase_order_line_id": line_id, "qty": 1},
                {"purchase_order_line_id": line_id, "qty": 2},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_line_from_another_po_is_rejected_and_nothing_saved(client):
    headers, party = _setup(client)
    po_a = _create_po(client, headers, party, number="PO-A").json()
    po_b = _create_po(client, headers, party, number="PO-B").json()
    resp = client.post(
        f"/purchase-orders/{po_a['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "lines": [{"purchase_order_line_id": po_b["lines"][0]["id"], "qty": 1}],
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert client.get(f"/purchase-orders/{po_a['id']}/dispatches", headers=headers).json() == []
    assert client.get(f"/purchase-orders/{po_b['id']}/dispatches", headers=headers).json() == []


def test_line_from_another_organization_is_422_not_404(client):
    headers_a, party_a = _setup(client, "a@test.com", "Org A")
    headers_b, party_b = _setup(client, "b@test.com", "Org B")
    po_a = _create_po(client, headers_a, party_a).json()
    po_b = _create_po(client, headers_b, party_b).json()
    resp = client.post(
        f"/purchase-orders/{po_a['id']}/dispatches",
        json={
            "dispatch_date": TODAY.isoformat(),
            "lines": [{"purchase_order_line_id": po_b["lines"][0]["id"], "qty": 1}],
        },
        headers=headers_a,
    )
    assert resp.status_code == 422


def test_over_dispatch_names_only_the_line_that_overflows(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()

    warn = _dispatch(client, headers, po, {0: 60, 1: 10}).json()
    assert warn["dispatch"] is None
    assert [o["material"] for o in warn["over_lines"]] == ["Steel bar 12mm"]
    assert warn["over_lines"][0]["remaining"] == 50
    assert warn["over_lines"][0]["requested"] == 60
    assert "Steel bar 12mm" in warn["warning"]
    assert "Cement" not in warn["warning"]
    assert "confirm" not in warn["warning"].lower().replace("confirm to record", "")

    # Nothing saved while unconfirmed.
    assert client.get(f"/purchase-orders/{po['id']}/dispatches", headers=headers).json() == []

    confirmed = _dispatch(client, headers, po, {0: 60, 1: 10}, confirm=True).json()
    assert confirmed["dispatch"] is not None
    after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert [l["remaining_qty"] for l in after["lines"]] == [-10, 190, 10]


def test_po_level_total_does_not_hide_one_line_overflowing(client):
    """Total requested (11) is far below total ordered, but sand has only 10."""
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    warn = _dispatch(client, headers, po, {2: 11}).json()
    assert warn["dispatch"] is None
    assert [o["material"] for o in warn["over_lines"]] == ["Sand"]


def test_exact_remaining_on_a_line_does_not_warn(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    resp = _dispatch(client, headers, po, {2: 10}).json()
    assert resp["warning"] is None
    after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert after["lines"][2]["remaining_qty"] == 0


def test_deleting_a_dispatch_restores_every_line_it_covered(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    d = _dispatch(client, headers, po, {0: 20, 1: 50}).json()["dispatch"]
    resp = client.delete(f"/purchase-orders/{po['id']}/dispatches/{d['id']}", headers=headers)
    assert resp.status_code == 204
    after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert [l["remaining_qty"] for l in after["lines"]] == [50, 200, 10]


# --- status, list, dashboard, party (US4) -----------------------------------


def test_status_stays_open_until_every_line_is_done(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party, due_offset=-1).json()
    assert po["status"] == "overdue"

    _dispatch(client, headers, po, {0: 50, 1: 200})
    mid = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert mid["status"] == "overdue", "sand is still open and the PO is past due"

    _dispatch(client, headers, po, {2: 10})
    done = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert done["status"] == "fully_dispatched"


def test_list_filter_uses_derived_status_and_shows_summary(client):
    headers, party = _setup(client)
    overdue = _create_po(client, headers, party, number="PO-LATE", due_offset=-1).json()
    _create_po(client, headers, party, number="PO-FINE", due_offset=60)
    _dispatch(client, headers, overdue, {0: 50, 1: 200})  # sand still open

    rows = client.get("/purchase-orders?status=overdue", headers=headers).json()
    assert [r["po_number"] for r in rows] == ["PO-LATE"]
    assert rows[0]["item_count"] == 3
    assert rows[0]["material_summary"] == "Steel bar 12mm +2 more"


def test_dashboard_never_sums_across_units(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    _dispatch(client, headers, po, {0: 20})

    dash = client.get("/dashboard", headers=headers).json()
    assert "total_remaining_balance" not in dash
    assert dash["remaining_by_unit"] == [
        {"unit": "bag", "remaining": 200},
        {"unit": "tonne", "remaining": 30},
        {"unit": "truck", "remaining": 10},
    ]
    assert dash["open_po_count"] == 1
    summary = dash["party_summary"][0]
    assert "remaining_balance" not in summary
    assert summary["open_po_count"] == 1
    assert len(summary["remaining_by_unit"]) == 3


def test_party_view_lists_lines_and_per_unit_totals(client):
    headers, party = _setup(client)
    _create_po(client, headers, party)
    view = client.get(f"/parties/{party['id']}", headers=headers).json()
    assert len(view["open_orders"][0]["lines"]) == 3
    assert {r["unit"] for r in view["remaining_by_unit"]} == {"bag", "tonne", "truck"}


# --- exports (US5) ----------------------------------------------------------


def _csv(resp):
    return list(csv.DictReader(io.StringIO(resp.content.decode("utf-8"))))


def test_remaining_export_has_one_row_per_open_line(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    _dispatch(client, headers, po, {2: 10})  # sand finished: not pending

    rows = _csv(client.get("/reports/remaining-lines/export?format=csv", headers=headers))
    assert [(r["po_number"], r["material"], r["unit"], r["remaining_qty"]) for r in rows] == [
        ("PO-M1", "Steel bar 12mm", "tonne", "50.0"),
        ("PO-M1", "Cement OPC", "bag", "200.0"),
    ]
    assert all(r["party_name"] == "Multi Party" for r in rows)


def test_party_export_has_one_row_per_open_line(client):
    headers, party = _setup(client)
    _create_po(client, headers, party)
    rows = _csv(client.get(f"/parties/{party['id']}/remaining/export", headers=headers))
    assert len(rows) == 3
    assert {r["po_number"] for r in rows} == {"PO-M1"}


def test_remaining_by_party_report_is_per_unit(client):
    headers, party = _setup(client)
    _create_po(client, headers, party)
    rows = client.get("/reports/remaining-by-party", headers=headers).json()
    assert sorted((r["unit"], r["remaining_qty"]) for r in rows) == [
        ("bag", 200),
        ("tonne", 50),
        ("truck", 10),
    ]


def test_dispatch_history_export_has_one_row_per_dispatch_line(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    _dispatch(client, headers, po, {0: 20, 1: 100})
    rows = _csv(client.get("/reports/dispatch-history/export?format=csv", headers=headers))
    assert [(r["material"], r["qty"]) for r in rows] == [("Steel bar 12mm", "20.0"), ("Cement OPC", "100.0")]


def test_empty_line_exports_still_have_headers(client):
    headers, _ = _setup(client)
    for report in ("remaining-lines", "overdue-orders", "dispatch-history", "remaining-by-party"):
        resp = client.get(f"/reports/{report}/export?format=csv", headers=headers)
        assert resp.status_code == 200
        lines = resp.content.decode("utf-8").splitlines()
        assert len(lines) == 1 and lines[0], f"{report} must download as a header row"


# --- plan limits (FR-012) and audit (FR-015) ---------------------------------


def test_many_lines_still_consume_one_po_slot(client):
    headers, party = _setup(client)
    many = [{"material": f"Item {i}", "ordered_qty": 1, "unit": "pc"} for i in range(50)]
    assert _create_po(client, headers, party, number="PO-BIG", lines=many).status_code == 201
    assert client.get("/billing", headers=headers).json()["current_active_pos"] == 1


def test_audit_entries_carry_the_lines(client):
    headers, party = _setup(client)
    po = _create_po(client, headers, party).json()
    d = _dispatch(client, headers, po, {0: 5, 1: 6}).json()["dispatch"]
    client.delete(f"/purchase-orders/{po['id']}/dispatches/{d['id']}", headers=headers)

    entries = client.get("/audit-log", headers=headers).json()
    po_create = next(e for e in entries if e["entity_type"] == "purchase_order" and e["action"] == "create")
    assert [l["material"] for l in po_create["after_state"]["lines"]] == [
        "Steel bar 12mm",
        "Cement OPC",
        "Sand",
    ]
    d_create = next(e for e in entries if e["entity_type"] == "dispatch" and e["action"] == "create")
    assert len(d_create["after_state"]["lines"]) == 2
    d_delete = next(e for e in entries if e["entity_type"] == "dispatch" and e["action"] == "delete")
    assert len(d_delete["before_state"]["lines"]) == 2
