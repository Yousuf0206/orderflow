# Contract: Post-Deploy Smoke Check

Covers FR-001 to FR-007 and Constitution Principle XXIV.

## Invocation

```
python -m src.scripts.smoke_deployed <base-url> [--json]
```

`<base-url>` is a **required positional argument with no default**. The check MUST refuse to run
without it and MUST NOT infer a target from the environment, a config file, or `.env`. This is not
ergonomics — it is the structural reason the check does not weaken Principle XXVII (research R4).

## What it does, in order

| Step | Request | Pass condition |
| --- | --- | --- |
| 1. Reachable | `GET /api/health` | 200, and the body names a database host |
| 2. Sign up | `POST /api/auth/signup` | 201 with an access token |
| 3. Read back | `GET /api/auth/me` | 200, and the email matches the one just created |
| 4. Write | `POST /api/parties` | 201 with an id |

Step 3 is the one that matters most and is easiest to leave out. During the 2026-10-09 outage
signup was broken *and* login returned 200; it was the authenticated read that failed. A check
that stops at "signup returned something" would have passed through most of that incident.

## What it must not do

- MUST NOT create purchase orders or dispatches — FR-005 limits it to what its steps need.
- MUST NOT open a database connection. HTTP only: no driver, no credentials, no direct reads.
- MUST NOT be collected by pytest, imported by a test, or invoked by any suite. Running `pytest`
  or `npx playwright test` must never be able to reach it.
- MUST NOT require privileged credentials. It acts as an ordinary new user, because that is whose
  experience is being verified (FR-006).

## What it creates

One organization named `SMOKE <ISO-8601 UTC timestamp>`, one user, one party. The check MUST print
the organization id, the user email and the party id, so a later cleanup can target them exactly
instead of guessing by pattern.

This adds one organization per deploy to production. That cost is accepted deliberately and is
recorded in research R5 rather than discovered later by whoever next counts the rows.

## Output

Human-readable by default; `--json` for a machine. Either way it MUST report:

- the base URL checked, and the deployed commit if the deployment exposes one
- each step with its outcome and, on failure, the status code and response body
- the ids it created
- a single overall result

**Exit codes** — these carry the FR-003 and FR-004 distinction, so they are part of the contract:

| Code | Meaning |
| --- | --- |
| 0 | All steps passed |
| 1 | The deployment answered and a step failed — it is broken |
| 2 | The deployment could not be reached at all — connection refused, DNS failure, timeout |

A caller MUST be able to tell "broken" from "unreachable" without reading logs (SC-003). An
unreachable deployment during a rollout is not the same event as a deployment returning 500, and
treating them alike is how a rollout gets rolled back for no reason.

## Timing

The whole check MUST report within 2 minutes (SC-002). Each request gets its own timeout; the
budget covers a cold function and a slow network, not slow work.

## Automation

A GitHub Actions workflow keyed on `deployment_status` runs the check when a **production**
deployment reports success, reading the target from the event payload. The workflow is a
convenience: the script is the artifact, and must stay runnable by a person during an incident,
when CI is exactly the thing nobody wants to depend on.

A failing check MUST fail the workflow run, so a red mark exists against that deployment
(FR-007).

## What a failure means

A failed post-deploy check blocks the announcement of that release (FR-007, Principle XXIII). It
is not advisory, and it is not a flake to re-run until green — a re-run is only legitimate after
the unreachable case (exit 2), where nothing was learned about the application.
