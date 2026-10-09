# Phase 0 Research: Release Verification

Decisions taken against the repository as it stands on 2026-10-10.

---

## R1 — Extend the existing checklist; do not start a second one

**Decision**: amend `docs/SMOKE_CHECKLIST.md` rather than add a parallel release document. Split it
into what is run **before** a deploy and what is run **after**, and remove the implication that the
Mobile section is satisfied by an automated test.

**Rationale**: the file already exists, already opens with "This is a release gate, not a
formality", and already names which automated test covers each item — the discipline is in place.
Two problems, both of which the v1.4.0 amendment names:

- It says "Run manually against any new deploy", but every item is written to be run against a
  local stack. Nothing distinguishes "the build works" from "the deployment works", which is
  exactly the distinction that failed on 2026-10-09.
- Its Mobile section reads: *"at 390px wide — no sideways scrolling, and the loop is completable
  (`tests/e2e/mobile-viewport.spec.ts` — this one is automated)"*. That is the habit the brief's
  test policy says to stop: a viewport test marked as settling mobile. Principle XXVI now forbids
  treating it that way.

A second checklist would leave the first one in place, still wrong, still being followed.

**Alternatives considered**: a new `docs/RELEASE.md` superseding it — rejected, two checklists
drift and the older one is the one people already know. Leaving the Mobile line and adding a note
elsewhere — rejected, the misleading line is the problem.

---

## R2 — The post-deploy check is a script first, automation second

**Decision**: `backend/src/scripts/smoke_deployed.py`, standard library only, taking the target as
a required argument. A GitHub Actions workflow triggered on `deployment_status` runs it
automatically when a production deployment succeeds, but the script is the artifact and works
without it.

**Rationale**: the check must be runnable by a person at the moment they need it — during an
incident, against a preview, from a laptop — and automation that only exists inside CI is not
available then. Standard library only means it runs without installing the backend package, which
matters when the thing being diagnosed may be the backend package.

Vercel creates GitHub Deployments and posts `deployment_status` events, so a workflow can key off
a successful production deployment and read the deployment URL from the event. That gives
automatic post-deploy verification without restructuring the deploy, which stays with Vercel's Git
integration.

Placed in `backend/src/scripts/` with `seed_landing_demo.py` and `evaluate_notifications.py` —
existing convention, and the repository has no root `scripts/` directory (CLAUDE.md forbids adding
working files at the root).

**Alternatives considered**: a Playwright spec — rejected, it would live in the frontend suite,
and a suite that can reach production is the thing Principle XXVII exists to prevent. A pytest
test marked `deployed` — rejected for the same reason: a marker is one `-m` flag away from running
in the wrong place.

---

## R3 — Spreadsheet acceptance is a release gate, not a PR note

**Decision**: the "open it in Google Sheets" check belongs in the post-deploy section of
`SMOKE_CHECKLIST.md`, once per release, not as a note on a pull request.

**Rationale**: the brief says "one Sheets open notes in PR". A PR note binds evidence to a change,
but the thing being verified is not a change — it is whether the export a user downloads from the
deployed product opens correctly. Most releases touch neither the export code nor the data shape,
and yet the format a spreadsheet produces can change under you. Tying it to releases means it is
checked when it matters and not performed theatrically on every unrelated PR.

**Alternatives considered**: both — rejected, a check performed twice in two places is a check
nobody owns.

---

## R4 — Keeping the deliberate exception from eroding the rule

**Decision**: the post-deploy check reaches production, and three things keep that from weakening
Principle XXVII:

1. It takes its target as a **required positional argument with no default.** It cannot be run by
   accident, and it cannot silently fall through to whatever `DATABASE_URL` or `.env` says.
2. It talks **only HTTP**, never a database connection. It has no credentials, no driver, and no
   way to read or write a table directly — it can do exactly what a signed-up user can do.
3. It is **outside every suite.** Not collected by pytest, not a Playwright spec, not imported by
   anything that is. Running `pytest` or `npx playwright test` can never invoke it.

**Rationale**: Principle XXVII is about defaults and accidents, not about forbidding every tool
that can speak to production. The failure it describes — a suite resolving its connection from a
developer's `.env` and writing to live customer data — is prevented by the three properties above,
each of which is a structural barrier rather than a convention.

Worth being explicit, because the reasoning is easy to misapply: this does **not** license
relaxing the suite's guards, pointing tests at a deployed environment, or adding a "run against
staging" flag to the existing suites.

---

## R5 — The check signs up, and that means production gains an organization per deploy

**Decision**: the check performs a real signup each run, creating an organization named
`SMOKE <ISO-8601 UTC timestamp>`, and prints the organization id, user email, and party id it
created. No automatic cleanup.

**Rationale**: signup is the endpoint that broke, and a check that skips it does not check the
thing that failed. Reusing a pre-made account and only logging in would avoid the pollution, but
would have passed cleanly throughout the 2026-10-09 outage — login returned 200 the entire time.
The check has to sign up.

The cost is real and is stated rather than hidden: one organization per deploy, in a production
database that already holds several hundred machine-generated organizations from test suites.
The mitigation is precision — a prefix nothing else uses, a sortable timestamp, and the created
ids printed — so these are trivially separable from real signups and from the existing `E2E Co %`
and `Mob Co %` rows.

**Deliberately not decided here**: what to delete and when. That question is entangled with the
existing pollution and with an organization owned by a real user, and it needs a person's
decision rather than a default chosen inside a plan. This feature makes it easier to answer; it
does not answer it.

**Alternatives considered**: signing up then deleting — rejected, there is no delete-organization
endpoint and inventing one for a smoke check is a large, risky surface added for tidiness.
Checking against a preview deployment instead — rejected, a preview is not what users reach, which
is the whole point.

---

## R6 — The device record is a template plus dated records

**Decision**: `docs/qa/mobile-dispatch.md` is the template the brief asks for; completed records go
in `docs/qa/records/<release-tag>.md`, one per release train.

**Rationale**: a template and a record are different documents with different lifetimes. Keeping
completed runs in the template turns it into an append-only log where the instructions scroll off
the top, and the question "does *this* release have a record?" becomes a reading exercise. One
file per release tag makes the gate answerable by `ls`.

The record's required fields are fixed in `contracts/device-record.md` so "tested on a phone"
cannot pass for evidence — Principle XXVI's clause about not citing viewport tests has a sibling
problem, which is vague human claims.

**Alternatives considered**: a table in the existing checklist — rejected, the checklist is a
template re-used per release and a record must persist. An issue tracker — rejected, this project
does not use one, and evidence that lives outside the repository goes missing.

---

## R7 — `docs/README.md` carries the setup gap, and it is small

**Decision**: extend the existing `docs/README.md` rather than add a new setup document. Add: the
guards that refuse a non-local database, `TEST_PG_URL` for the PostgreSQL-only tests, the startup
migration and `AUTO_MIGRATE`, and a pointer to where the release gates live.

**Rationale**: `docs/README.md` already covers prerequisites, backend and frontend setup, Docker,
CI, and a frank "what's simplified" section. US4 is nearly satisfied by it. What it predates is
everything added in the last day: the e2e production-database guard, the startup migration, the
PostgreSQL-only tests that skip silently without `TEST_PG_URL`, and the fact that a test run that
reaches production is now a constitutional violation rather than bad luck.

**One thing this plan cannot verify**: `backend/.env.example` could not be read — the repository's
permission rules deny reading `.env*`. The documentation requirement (FR-017) is therefore written
in terms of what `docs/README.md` must say. If `.env.example` needs a matching change, a person
who can read it has to make that call.

**Alternatives considered**: a new `CONTRIBUTING.md` — rejected, it would duplicate most of
`docs/README.md` and split the answer to one question across two files.
