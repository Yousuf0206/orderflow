"""Purchase order list filters: party, PO-number search, status, and combinations.

Covers spec FR-012 to FR-018 and the agreement FR-017 requires between the
dashboard's Overdue figure and the list it opens.
"""

from datetime import date, timedelta

from tests.conftest import auth_headers, signup

TODAY = date.today()


def _party(client, headers, code, name):
    resp = client.post("/parties", json={"party_code": code, "party_name": name}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _po(client, headers, party_id, number, *, due_offset=30, ordered=100):
    resp = client.post(
        "/purchase-orders",
        json={
            "party_id": party_id,
            "po_number": number,
            "material": "TMT Steel Bars",
            "ordered_qty": ordered,
            "unit": "ton",
            "order_date": (TODAY - timedelta(days=40)).isoformat(),
            "due_date": (TODAY + timedelta(days=due_offset)).isoformat(),
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _seed(client, email, org):
    headers = auth_headers(signup(client, email=email, org_name=org))
    north = _party(client, headers, "P-101", "Northgate Steel")
    civic = _party(client, headers, "P-102", "Civic Cement")

    ids = {
        "north_on_track": _po(client, headers, north, "PO-2001", due_offset=30),
        "north_overdue": _po(client, headers, north, "PO-2002", due_offset=-5),
        "civic_on_track": _po(client, headers, civic, "PO-3001", due_offset=45),
        "civic_overdue": _po(client, headers, civic, "PO-3002", due_offset=-2),
        # Names chosen to exercise LIKE pattern characters.
        "wildcard": _po(client, headers, north, "PO_9001", due_offset=20),
        "percent": _po(client, headers, north, "PO-50%OFF", due_offset=20),
    }
    return headers, {"north": north, "civic": civic}, ids


def _numbers(resp):
    return sorted(row["po_number"] for row in resp.json())


def test_party_filter_returns_only_that_party(client):
    headers, parties, _ = _seed(client, "f1@test.com", "Filter Org 1")
    resp = client.get(f"/purchase-orders?party_id={parties['civic']}", headers=headers)
    assert resp.status_code == 200
    assert _numbers(resp) == ["PO-3001", "PO-3002"]


def test_search_is_partial_and_case_insensitive(client):
    headers, _, _ = _seed(client, "f2@test.com", "Filter Org 2")
    resp = client.get("/purchase-orders?q=po-20", headers=headers)
    assert _numbers(resp) == ["PO-2001", "PO-2002"]


def test_search_treats_underscore_as_literal_not_a_wildcard(client):
    """A PO numbering scheme with underscores is common.

    Unescaped, `PO_9` would match `PO-9` too, so a trader searching for one
    order would be shown another party's order as if it matched.
    """
    headers, _, _ = _seed(client, "f3@test.com", "Filter Org 3")
    resp = client.get("/purchase-orders?q=PO_9", headers=headers)
    assert _numbers(resp) == ["PO_9001"]


def test_search_treats_percent_as_literal_not_a_wildcard(client):
    headers, _, _ = _seed(client, "f4@test.com", "Filter Org 4")
    resp = client.get("/purchase-orders?q=50%25", headers=headers)
    assert _numbers(resp) == ["PO-50%OFF"]

    # A bare percent must not behave as "match everything".
    everything = client.get("/purchase-orders?q=%25", headers=headers)
    assert _numbers(everything) == ["PO-50%OFF"]


def test_blank_search_is_treated_as_absent(client):
    headers, _, _ = _seed(client, "f5@test.com", "Filter Org 5")
    all_orders = client.get("/purchase-orders", headers=headers)
    blank = client.get("/purchase-orders?q=%20%20", headers=headers)
    assert _numbers(blank) == _numbers(all_orders)


def test_unrecognised_status_returns_nothing_not_everything(client):
    """Ignoring an unknown status would make the filter lie: the user asked to
    narrow, and the list would come back wider than they asked for."""
    headers, _, _ = _seed(client, "f6@test.com", "Filter Org 6")
    resp = client.get("/purchase-orders?status=not_a_status", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_filters_combine_with_and(client):
    headers, parties, _ = _seed(client, "f7@test.com", "Filter Org 7")
    resp = client.get(
        f"/purchase-orders?party_id={parties['north']}&status=overdue", headers=headers
    )
    assert _numbers(resp) == ["PO-2002"]

    with_search = client.get(
        f"/purchase-orders?party_id={parties['north']}&q=PO-2001", headers=headers
    )
    assert _numbers(with_search) == ["PO-2001"]


def test_party_filter_cannot_reach_another_organizations_rows(client):
    _, parties_a, _ = _seed(client, "f8a@test.com", "Filter Org 8a")
    headers_b, _, _ = _seed(client, "f8b@test.com", "Filter Org 8b")

    # Organization B asking for organization A's party id gets nothing, not a
    # widened result set (Principle I).
    resp = client.get(f"/purchase-orders?party_id={parties_a['north']}", headers=headers_b)
    assert resp.status_code == 200
    assert resp.json() == []


def test_dashboard_overdue_count_equals_filtered_list_length(client):
    """FR-017. Both read one status definition, so this holds by construction;
    the test exists so a future second definition fails here rather than
    quietly disagreeing on screen."""
    headers, _, _ = _seed(client, "f9@test.com", "Filter Org 9")

    dashboard = client.get("/dashboard", headers=headers)
    assert dashboard.status_code == 200
    count = dashboard.json()["overdue_count"]

    listed = client.get("/purchase-orders?status=overdue", headers=headers)
    assert count == len(listed.json()) == 2
