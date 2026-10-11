"""Rehearse migration 0003 on a copy of production (constitution XXXI).

    python -m src.scripts.verify_0003 snapshot --db <copy-url> --out before.json
    alembic upgrade head        # against the same copy
    python -m src.scripts.verify_0003 compare  --db <copy-url> --before before.json

`snapshot` must run while the copy is still at revision 0002; `compare` after
it reaches 0003. Both only read. `compare` exits non-zero on any difference in
per-PO remaining, line count, or dispatch count, so a rehearsal cannot pass by
someone skimming output.

The URL is always passed explicitly and never read from backend/.env, and the
configured DATABASE_URL is refused unless it is local: this is a tool for a
*copy*, and the one database it should never be pointed at by accident is the
one a developer's .env most often names (constitution XXVII).
"""

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import create_engine, text

from src.core.config import settings

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db", "postgres"}


def _refuse_configured_remote(url: str) -> None:
    host = urlparse(url).hostname or ""
    if url == settings.database_url and host not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing: --db is the configured DATABASE_URL ({host!r}), which is not local. "
            "Restore a copy and point --db at that."
        )


def _num(value) -> str:
    # Exact decimal text, so 35 and 35.000 compare equal and nothing is rounded.
    return str(Decimal(value).normalize()) if value is not None else "0"


def snapshot(url: str) -> dict:
    with create_engine(url).connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT po.id, po.ordered_qty - COALESCE(
                    (SELECT SUM(d.qty) FROM dispatches d
                      WHERE d.purchase_order_id = po.id AND d.deleted_at IS NULL), 0)
                  FROM purchase_orders po
                """
            )
        ).all()
        dispatches = conn.execute(text("SELECT COUNT(*) FROM dispatches")).scalar()
    return {
        "purchase_orders": len(rows),
        "dispatches": dispatches,
        "remaining": {po_id: _num(rem) for po_id, rem in rows},
    }


def current(url: str) -> dict:
    with create_engine(url).connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT l.purchase_order_id, COUNT(*) OVER (PARTITION BY l.purchase_order_id),
                       l.ordered_qty - COALESCE(
                           (SELECT SUM(dl.qty) FROM dispatch_lines dl
                              JOIN dispatches d ON d.id = dl.dispatch_id
                             WHERE dl.purchase_order_line_id = l.id AND d.deleted_at IS NULL), 0)
                  FROM purchase_order_lines l
                """
            )
        ).all()
        pos = conn.execute(text("SELECT COUNT(*) FROM purchase_orders")).scalar()
        dispatches = conn.execute(text("SELECT COUNT(*) FROM dispatches")).scalar()
        dispatch_lines = conn.execute(text("SELECT COUNT(*) FROM dispatch_lines")).scalar()
    return {
        "purchase_orders": pos,
        "dispatches": dispatches,
        "dispatch_lines": dispatch_lines,
        "multi_line_pos": sorted({po_id for po_id, n, _ in rows if n != 1}),
        "remaining": {po_id: _num(rem) for po_id, _, rem in rows},
    }


def compare(before: dict, after: dict) -> list[str]:
    problems = []
    if before["purchase_orders"] != after["purchase_orders"]:
        problems.append(f"PO count {before['purchase_orders']} -> {after['purchase_orders']}")
    if before["dispatches"] != after["dispatches"]:
        problems.append(f"dispatch count {before['dispatches']} -> {after['dispatches']}")
    if after["dispatch_lines"] != after["dispatches"]:
        problems.append(f"{after['dispatches']} dispatches but {after['dispatch_lines']} dispatch lines")
    if after["multi_line_pos"]:
        problems.append(f"{len(after['multi_line_pos'])} POs do not have exactly one line")
    missing = set(before["remaining"]) - set(after["remaining"])
    if missing:
        problems.append(f"{len(missing)} POs have no line after migration")
    for po_id, rem in before["remaining"].items():
        if po_id in after["remaining"] and after["remaining"][po_id] != rem:
            problems.append(f"PO {po_id}: remaining {rem} -> {after['remaining'][po_id]}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    snap = sub.add_parser("snapshot")
    snap.add_argument("--db", required=True)
    snap.add_argument("--out", required=True, type=Path)
    cmp_ = sub.add_parser("compare")
    cmp_.add_argument("--db", required=True)
    cmp_.add_argument("--before", required=True, type=Path)
    args = parser.parse_args()

    _refuse_configured_remote(args.db)

    if args.cmd == "snapshot":
        data = snapshot(args.db)
        args.out.write_text(json.dumps(data, indent=2))
        print(f"snapshot: {data['purchase_orders']} POs, {data['dispatches']} dispatches -> {args.out}")
        return 0

    before = json.loads(args.before.read_text())
    after = current(args.db)
    problems = compare(before, after)
    print(
        f"before: {before['purchase_orders']} POs, {before['dispatches']} dispatches; "
        f"after: {after['purchase_orders']} POs, {after['dispatches']} dispatches, "
        f"{after['dispatch_lines']} dispatch lines"
    )
    if problems:
        print(f"FAIL: {len(problems)} difference(s)")
        for p in problems[:50]:
            print(f"  - {p}")
        return 1
    print("PASS: 0 differences")
    return 0


if __name__ == "__main__":
    sys.exit(main())
