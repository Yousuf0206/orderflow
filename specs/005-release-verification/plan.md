# Implementation Plan: Release Verification

**Branch**: `005-release-verification` (spec directory; the working git branch is `main`)
| **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-release-verification/spec.md`

## Summary

Four pieces of evidence, none of which is product: a check that runs against the deployed system
after a deploy, a recorded real-device dispatch per release train, a spreadsheet acceptance pass,
and documentation so someone other than the author can run all three.

Phase 0 found that two of the four already have a home in the repository, and the useful version
of this work is to extend what exists rather than add a parallel set of files. `docs/SMOKE_CHECKLIST.md`
is already a release gate with the right tone ("This is a release gate, not a formality"), and
`docs/README.md` already carries local setup. The gap is not that checklists are missing; it is
that the existing checklist is run before a deploy and against a local database, and that its
Mobile section cites an automated viewport test as if that settled the question — which is
precisely the two failures the constitution's v1.4.0 amendment names.

One decision shapes the rest: the post-deploy check signs up a real account on production every
time it runs. That is deliberate — a check that signs up anywhere else does not verify the thing
that broke — and it knowingly adds one organization per deploy to a production database that
already holds several hundred machine-generated ones. The plan makes those organizations precisely
identifiable so that the existing cleanup question becomes easier to answer rather than harder.

## Technical Context

**Language/Version**: Python 3.12 (check script, backend), TypeScript 5.6 (frontend, unchanged),
Markdown (checklists and records)

**Primary Dependencies**: no new runtime dependency. The check script uses the standard library
only, so it can run anywhere Python exists without installing the backend package.

**Storage**: none new. The check creates ordinary application records through the public API.

**Testing**: pytest (backend, now with a PostgreSQL service in CI), Vitest and Playwright
(frontend). The post-deploy check is itself a test, but of a deployment rather than of a build.

**Target Platform**: the deployed Vercel services; plus physical Android and iOS devices for the
part no machine can do.

**Project Type**: web application — `frontend/` + `backend/`, plus `docs/` for the human gates.

**Performance Goals**: the post-deploy check reports within 2 minutes (SC-002). Against the hosted
database a signup plus two writes is a few seconds; the budget is for a cold Vercel function and a
slow network, not for the work.

**Constraints**: the check must act as an ordinary new user with no privileged credentials
(FR-006); it must not create business records beyond what its steps need (FR-005); and nothing in
this feature may make a test run able to reach production other than this one deliberate check
(Principle XXVII).

**Scale/Scope**: 4 user stories, 19 functional requirements. One new script, one new workflow, one
new document, and edits to two existing documents. No application code changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` **v1.4.0**.

| Principle | Gate | Verdict |
| --- | --- | --- |
| XXIV — Verify the Deployed System | Signup and login exercised against the deployment before announcing | **This feature exists to satisfy it.** US1. Currently unmet; the constitution says so. |
| XXVI — A Phone Claim Needs a Phone | Real device per release train, recorded | **This feature exists to satisfy it.** US2. Currently unmet. |
| XXV — An Empty Export Still Says What It Is | Declared columns; empty report still a named table | **Met in code** (`67bab70`). US3 adds the human half — that it also *renders* as one. |
| XXVII — Tests Never Touch Production | No test run reaches production by default | **PASS, with one deliberate exception.** The post-deploy check reaches production on purpose; it is not part of any suite, is never run by `pytest` or `playwright`, and takes its target as an explicit argument with no default. R4 records how that separation is kept. |
| XIII — Smoke before every production deploy | Required | **PASS, extended.** The existing checklist stays; US1 adds the pass that happens *after* the deploy, against the deployment. |
| XXIII — Credibility Over Feature Count | Nothing announced that is not shown to work | **PASS.** FR-007 and FR-012 are the enforcement. |
| II / XXI — Remaining balance sacred | No stored or typed balance | **PASS.** No application code changes; the check only reads. |
| I — Multi-tenancy | Organization isolation | **PASS.** The check's account sees only its own organization, like any user. |
| XIV / IX — Paid work gated | No Stripe, no paid CTA | **PASS.** Untouched. |
| XII — No Silent Failures | Loaded / empty / error | **PASS.** FR-003 and FR-004 apply it to the check itself: a failure names its step, and unreachable is distinct from broken. |

**One gate needs a judgement, and it is made here rather than deferred.** Principle XXVII says no
test run may reach production by default. The post-deploy check reaches production by design. The
distinction being relied on is that XXVII is about *defaults and accidents* — a suite that falls
through to production credentials because someone's `.env` pointed there — and this is a tool whose
entire purpose is to check one named deployment, which refuses to run without being told which.
R4 states the separation concretely so a future reader does not take this as licence to loosen the
suite's guards.

No violations requiring justification. Complexity Tracking is empty and omitted.

## Project Structure

### Documentation (this feature)

```text
specs/005-release-verification/
├── plan.md              # This file
├── spec.md              # 4 user stories, 19 FRs
├── research.md          # Phase 0 — decisions R1-R7
├── data-model.md        # Phase 1 — records, not tables
├── quickstart.md        # Phase 1 — how to run each gate
├── checklists/
│   └── requirements.md  # 16/16
└── contracts/
    ├── deployed-smoke.md        # What the post-deploy check does and reports
    ├── device-record.md         # What a real-device record must contain
    └── spreadsheet-acceptance.md # What "opens correctly" means
```

### Source Code (repository root)

```text
backend/
└── src/scripts/
    └── smoke_deployed.py        # NEW: signup -> me -> create party, against a named deployment

docs/
├── SMOKE_CHECKLIST.md           # EDIT: split pre-deploy from post-deploy; stop citing the
│                                #       viewport test as if it settled mobile
├── README.md                    # EDIT: the guards, TEST_PG_URL, startup migration, and
│                                #       where the release gates live
└── qa/
    ├── mobile-dispatch.md       # NEW: the real-device template (path from the brief)
    └── records/                 # NEW: completed records, one file per release train
        └── .gitkeep

.github/workflows/
└── post-deploy-smoke.yml        # NEW: runs the check when a production deployment succeeds
```

**Structure Decision**: two new documents and one new script, plus edits to the two documents that
already own this ground. The brief's `docs/qa/mobile-dispatch.md` path is honoured as a *template*,
with completed records kept beside it — a template and a record are different things, and keeping
them in one file is how a checklist quietly turns into a log nobody can read. `SMOKE_CHECKLIST.md`
is edited rather than duplicated: a second checklist is how two checklists drift.

## Deviations from the Supplied Execution Order

Your order was taken as input, not instruction. Four points differ:

1. **Steps 4, 5 and 6 are already done.** Filters and party export (step 4), the invite path with
   fallback (step 5), and the landing and OG image (step 6) all shipped earlier today. The order
   collapses to steps 1, 2, 3 and 7.
2. **Step 1's "deploy" is not in this feature.** The signup 500's root cause is found and fixed in
   `0deacf8`; what remains is applying it to production, which is an operational act, not spec
   work. US1 is the *check* that would have caught it, and will catch the next one.
3. **Step 2's "tests stay in CI" is already true**, and the Sheets open becomes a release gate
   rather than a PR note (R3). A PR note binds the evidence to a change; the thing being verified
   is a release.
4. **Step 3's file becomes a template plus records**, not a single checklist file, and the existing
   `SMOKE_CHECKLIST.md` is amended rather than left pointing at a Playwright test for mobile — the
   specific habit your test policy says to stop.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1. No gate changed verdict. Two notes:

- **XXVII survived the exception.** `contracts/deployed-smoke.md` requires the check to take its
  target URL as a required argument with no default, to refuse a target that is not explicitly
  named, and to live outside every test suite. The failure mode being guarded against is not "a
  tool can reach production" but "something reaches production without anyone choosing it".
- **XXVI gained a falsifiable record.** `contracts/device-record.md` fixes what a record must
  contain, so "we tested on a phone" cannot stand in for a device, an OS version and an outcome.
  A record missing any required field does not satisfy the gate.
