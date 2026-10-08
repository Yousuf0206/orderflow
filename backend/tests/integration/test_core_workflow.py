from tests.conftest import auth_headers, signup


def test_create_po_record_dispatch_and_see_live_balance(client):
    tokens = signup(client, email="flow@test.com", org_name="FlowOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties",
        json={"party_code": "P1", "party_name": "Flow Party"},
        headers=headers,
    ).json()

    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-1",
            "material": "Steel",
            "ordered_qty": 100,
            "unit": "ton",
            "order_date": "2026-01-01",
            "due_date": "2026-01-01",
        },
        headers=headers,
    ).json()
    assert po["remaining_balance"] == 100
    assert po["status"] == "overdue"  # due_date in the past relative to "today" in tests

    r1 = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-02", "qty": 40},
        headers=headers,
    ).json()
    assert r1["dispatch"]["qty"] == 40

    po_after = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert po_after["total_dispatched"] == 40
    assert po_after["remaining_balance"] == 60

    # Over-dispatch triggers a warning instead of persisting
    warn = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-03", "qty": 1000},
        headers=headers,
    ).json()
    assert warn["dispatch"] is None
    assert "more than" in warn["warning"]
    assert "still remaining" in warn["warning"]
    # The warning is read by a trader, so it must not name request parameters.
    assert "confirm=true" not in warn["warning"]

    # Confirming past the warning proceeds
    confirmed = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-03", "qty": 60, "confirm": True},
        headers=headers,
    ).json()
    assert confirmed["dispatch"]["qty"] == 60

    po_final = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert po_final["remaining_balance"] == 0
    assert po_final["status"] == "fully_dispatched"

    dashboard = client.get("/dashboard", headers=headers).json()
    assert dashboard["total_remaining_balance"] == 0

    report = client.get("/reports/dispatch-history", headers=headers)
    assert report.status_code == 200
    assert len(report.json()) == 2

    export = client.get("/reports/dispatch-history/export?format=csv", headers=headers)
    assert export.status_code == 200
    assert "PO-1" in export.text

    pdf_export = client.get("/reports/dispatch-history/export?format=pdf", headers=headers)
    assert pdf_export.status_code == 200
    assert pdf_export.headers["content-type"] == "application/pdf"
    assert pdf_export.content.startswith(b"%PDF")

    empty_pdf = client.get("/reports/overdue-orders/export?format=pdf", headers=headers)
    assert empty_pdf.status_code == 200
    assert empty_pdf.content.startswith(b"%PDF")


def test_dispatch_exactly_equal_to_remaining_does_not_warn(client):
    """The over-dispatch boundary.

    Dispatching precisely what remains is full fulfilment, not an overshoot. An
    off-by-one in the comparison (>= instead of >) would make every final
    dispatch demand a confirmation it doesn't need.
    """
    tokens = signup(client, email="exact@test.com", org_name="ExactOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "EX", "party_name": "Exact Party"}, headers=headers
    ).json()

    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-EXACT",
            "material": "Cement",
            "ordered_qty": 100,
            "unit": "bag",
            "order_date": "2026-01-01",
            "due_date": "2027-01-01",
        },
        headers=headers,
    ).json()

    # 60 of 100, then exactly the remaining 40.
    client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-02", "qty": 60},
        headers=headers,
    )

    exact = client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-03", "qty": 40},
        headers=headers,
    ).json()

    assert exact["warning"] is None, "an exact-fit dispatch must not be treated as an overshoot"
    assert exact["dispatch"]["qty"] == 40

    final = client.get(f"/purchase-orders/{po['id']}", headers=headers).json()
    assert final["remaining_balance"] == 0
    assert final["status"] == "fully_dispatched"
