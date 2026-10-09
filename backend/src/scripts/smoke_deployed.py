"""Check a deployed OrderFlow, as an ordinary new user would experience it.

Why this exists: on 2026-10-09 migration 0002 was deployed without being
applied. The build was green and every test passed, while production returned
500 from signup and -- because the session lookup reads the same table -- from
every authenticated request. Login still returned 200 throughout, so users
signed in and then watched every screen fail. Nothing in the pipeline was
looking at the deployed system, only at the build.

Constitution Principle XXIV: a pass obtained locally, in CI, or against any
database other than the deployed one verifies the build, and the build is not
what users reach.

    python -m src.scripts.smoke_deployed https://your-deployment.example.com

The target is a required argument with no default, and this talks only HTTP --
no database driver, no credentials, no import of the backend package. Those
three properties are what keep it from weakening Principle XXVII (tests never
touch production): this reaches production on purpose and cannot do so by
accident, and no test suite can invoke it.

Exit codes are part of the contract:

    0  every step passed
    1  the deployment answered and a step failed -- it is broken
    2  the deployment could not be reached at all

A caller must be able to tell "broken" from "unreachable" without reading
logs. A rollout in progress and a deployment returning 500 are different
events, and treating them alike gets a good release rolled back.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta

# Long enough for a cold serverless function on a slow network, short enough
# that the whole run stays inside the 2-minute budget.
REQUEST_TIMEOUT_SECONDS = 25

# Nothing else in the product creates organizations with this prefix, so a
# check account is separable from a real signup at a glance and by a query.
ORG_PREFIX = "SMOKE"
EMAIL_DOMAIN = "orderflow-checks.example"


class Unreachable(Exception):
    """The deployment could not be reached. Distinct from it answering badly."""


class StepFailed(Exception):
    def __init__(self, step: str, detail: str):
        super().__init__(f"{step}: {detail}")
        self.step = step
        self.detail = detail


def _request(
    base: str, method: str, path: str, *, body: dict | None = None, token: str | None = None
) -> tuple[int, str]:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f"{base}{path}", data=data, method=method)
    request.add_header("content-type", "application/json")
    if token:
        request.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as exc:
        # The deployment answered; it just answered badly. That is a failure,
        # not an unreachable host.
        return exc.code, exc.read().decode()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise Unreachable(str(exc)) from exc


def _detect_prefix(base: str) -> str:
    """Find where the API lives: behind /api, or at the root.

    Deployed, vercel.json rewrites /api/* to the backend service. Run directly
    -- locally, or in a container -- the same routes sit at the root. Probing
    once costs a request and means the tool works against both without anyone
    remembering a flag, which matters when it is reached for during an
    incident.
    """
    # An Unreachable here propagates, which is right: if the host cannot be
    # reached there is no prefix to find, and the caller reports exit 2.
    for prefix in ("/api", ""):
        status, body = _request(base, "GET", f"{prefix}/health")
        if status == 200 and "database_host" in body:
            return prefix
    # Neither shape answered usefully. Report against the deployed shape, since
    # that is what a deployment should be serving.
    return "/api"


def _expect(status: int, expected: tuple[int, ...], step: str, body: str) -> dict:
    if status not in expected:
        raise StepFailed(step, f"expected {' or '.join(map(str, expected))}, got {status}: {body[:400]}")
    try:
        return json.loads(body) if body else {}
    except json.JSONDecodeError as exc:
        raise StepFailed(step, f"response was not JSON: {body[:200]}") from exc


def run(base: str) -> dict:
    """The core loop, as a new user walks it. Returns a result record."""
    base = base.rstrip("/")
    api = _detect_prefix(base)
    today = datetime.now(UTC).date()
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    steps: list[dict] = []
    created: dict[str, str] = {}

    def step(name: str, fn):
        try:
            value = fn()
        except StepFailed as exc:
            steps.append({"step": name, "ok": False, "detail": exc.detail})
            raise
        steps.append({"step": name, "ok": True})
        return value

    # 1. Reachable, and willing to say which database it is talking to.
    def health():
        status, body = _request(base, "GET", f"{api}/health")
        payload = _expect(status, (200,), "health", body)
        if not payload.get("database_host"):
            raise StepFailed("health", "response did not name a database host")
        return payload

    health_payload = step("health", health)

    # 2. Signup. The endpoint that broke, and the reason this check signs up
    #    rather than logging in to a standing account.
    def signup():
        status, body = _request(
            base,
            "POST",
            f"{api}/auth/signup",
            body={
                "organization_name": f"{ORG_PREFIX} {stamp}",
                "email": f"smoke-{stamp}@{EMAIL_DOMAIN}",
                "password": "password123",
            },
        )
        payload = _expect(status, (200, 201), "signup", body)
        if not payload.get("access_token"):
            raise StepFailed("signup", "no access token in response")
        return payload["access_token"]

    token = step("signup", signup)

    # 3. The step that matters most, and the easiest to leave out. During the
    #    outage signup was broken AND login returned 200; it was the
    #    authenticated read that failed. A check stopping at step 2 would have
    #    passed through most of the incident.
    def read_back():
        status, body = _request(base, "GET", f"{api}/auth/me", token=token)
        payload = _expect(status, (200,), "auth/me", body)
        expected_email = f"smoke-{stamp}@{EMAIL_DOMAIN}"
        if payload.get("user", {}).get("email") != expected_email:
            raise StepFailed("auth/me", f"returned a different user: {payload.get('user')}")
        created["organization_id"] = payload.get("organization", {}).get("id", "")
        created["user_email"] = expected_email
        return payload

    step("auth/me", read_back)

    # 4-6. A write path beyond signup, through to the figure the product is
    #      built to get right.
    def create_party():
        status, body = _request(
            base,
            "POST",
            f"{api}/parties",
            body={"party_code": f"SMK-{stamp}", "party_name": "Smoke Check Party"},
            token=token,
        )
        payload = _expect(status, (200, 201), "create party", body)
        created["party_id"] = payload["id"]
        return payload["id"]

    party_id = step("create party", create_party)

    def create_po():
        status, body = _request(
            base,
            "POST",
            f"{api}/purchase-orders",
            body={
                "party_id": party_id,
                "po_number": f"SMK-PO-{stamp}",
                "material": "Smoke Check Material",
                "ordered_qty": 100,
                "unit": "ton",
                "order_date": today.isoformat(),
                "due_date": (today + timedelta(days=30)).isoformat(),
            },
            token=token,
        )
        payload = _expect(status, (200, 201), "create purchase order", body)
        created["purchase_order_id"] = payload["id"]
        return payload["id"]

    po_id = step("create purchase order", create_po)

    def record_dispatch():
        status, body = _request(
            base,
            "POST",
            f"{api}/purchase-orders/{po_id}/dispatches",
            body={"dispatch_date": today.isoformat(), "qty": 40, "confirm": True},
            token=token,
        )
        _expect(status, (200, 201), "record dispatch", body)

    step("record dispatch", record_dispatch)

    # 7. The product's entire claim: remaining = ordered - dispatched, computed
    #    rather than stored.
    def check_remaining():
        status, body = _request(base, "GET", f"{api}/purchase-orders/{po_id}", token=token)
        payload = _expect(status, (200,), "remaining balance", body)
        remaining = payload.get("remaining_balance")
        if remaining != 60:
            raise StepFailed(
                "remaining balance",
                f"expected 60 after dispatching 40 of 100, got {remaining!r}",
            )
        return remaining

    step("remaining balance", check_remaining)

    return {
        "base_url": base,
        "database_host": health_payload.get("database_host"),
        "checked_at": datetime.now(UTC).isoformat(),
        "steps": steps,
        "created": created,
        "ok": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check a deployed OrderFlow the way a new user meets it.",
        epilog="The base URL is required. This tool never infers a target from the environment.",
    )
    # Positional and required on purpose: it cannot be run by accident, and it
    # cannot fall through to whatever a developer's .env happens to say.
    parser.add_argument("base_url", help="e.g. https://purchaseorderflow.vercel.app")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args()

    try:
        result = run(args.base_url)
    except Unreachable as exc:
        payload = {"base_url": args.base_url, "ok": False, "unreachable": True, "detail": str(exc)}
        print(json.dumps(payload) if args.json else f"UNREACHABLE: {args.base_url}\n  {exc}")
        return 2
    except StepFailed as exc:
        payload = {
            "base_url": args.base_url,
            "ok": False,
            "unreachable": False,
            "failed_step": exc.step,
            "detail": exc.detail,
        }
        if args.json:
            print(json.dumps(payload))
        else:
            print(f"FAILED at {exc.step}\n  {exc.detail}\n  against {args.base_url}")
        return 1

    if args.json:
        print(json.dumps(result))
    else:
        print(f"PASSED  {result['base_url']}")
        print(f"  database host: {result['database_host']}")
        for entry in result["steps"]:
            print(f"  ok  {entry['step']}")
        print("  created (for cleanup):")
        for key, value in result["created"].items():
            print(f"    {key}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
