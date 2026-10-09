---

description: "Task list for release verification"
---

# Tasks: Release Verification

**Input**: Design documents from `/specs/005-release-verification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included where a machine can check the thing. Much of this feature is
deliberately *not* automatable — that is the point of it — so several tasks can only be closed by
a person, and are marked as such.

**Organization**: grouped by user story. Each is independently runnable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US4 per spec.md
- Exact paths in every task

## Path Conventions

`backend/src/scripts/`, `docs/`, `.github/workflows/`. **No application code changes** in this
feature — it adds evidence, not behaviour.

---

## Mapping from the Supplied Completion Board

**12 of your 15 items are already shipped.** Each is listed with the commit, so nothing looks
quietly dropped.

| Your item | Disposition |
| --- | --- |
| B1 Production signup 500 diagnosed and fixed | **Diagnosed and fixed in code** (`0deacf8`): the schema is brought to head at startup under an advisory lock. Root cause was migration `0002` deployed without being applied. **What remains is confirming production is healthy** → T004. Note a test run of mine may already have applied the migration to production as a side effect — T004 settles it either way |
| B2 Post-deploy signup → me → party → PO → dispatch → remaining | → **T005–T011** (US1). Your version is richer than the spec's FR-001 and is adopted — see Deviations |
| B3 Duplicate-email returns clean 4xx | **Shipped.** `auth.py:37` returns 409; `Signup.tsx:33` attaches it to the email field rather than a banner. Verified against production by T012 |
| T022 Manual phone dispatch + keyboard checklist | → **T013–T017** (US2) |
| T047 Human visual smoke checkbox on release PR | → **T024** (a pull request template) |
| T048 CSV opened in Sheets/Excel (empty + non-empty) | → **T018–T021** (US3) |
| T050 Beta copy only after B2 + T022 | → **T028**, gated on US1 and US2 passing |
| T051 Three outsider first-impression notes | → **T029** (manual; no command closes it) |
| C1 PO filters (status/party/search) | **Shipped** — `e48cd25`, `342f47b` |
| C2 Party remaining CSV from party detail | **Shipped** — `a39a7ea`, `7de72c3` |
| C3 Invite + accept or copy-link fallback | **Shipped** — `ce6ecb9`, `3bbe340`; exercised end-to-end by `roles.spec.ts`, which drives the real invite→link→accept flow |
| C4 Role gate on dispatch create | **Shipped** — `b13f08c` |
| C5 Landing hero + OG from capture:landing | **Shipped and pipeline verified today** — `4cd744d`. The hero moved 720×444 → 720×451 after the 44px controls, and `og-image.png` was rebuilt from the new capture |
| C6 PWA manifest/icons | **Shipped** — `92a8f0d` |
| C7 .env.example + README local DATABASE_URL | → **T022–T023** (US4). `docs/README.md` exists and covers most of it; it predates every guard added in the last day. **`backend/.env.example` cannot be read by this agent** — the repo's own permission rules deny `.env*` — so T023 is written for a person |

### Your "complete for trial" gate, against today's evidence

| # | Gate item | Status |
| --- | --- | --- |
| 1 | New user can sign up on production | **UNVERIFIED** → US1 |
| 2 | Empty overdue export has headers | **VERIFIED** — `67bab70`; 2 bytes → 64, covered by `test_report_columns.py` |
| 3 | One real phone has completed a dispatch | **NOT DONE** → US2 |
| 4 | Party remaining CSV opens with numbers in Sheets | **STRUCTURALLY verified, never opened** → US3 |
| 5 | Second user can join | **VERIFIED** — `roles.spec.ts` drives invite → copy link → accept in a fresh context |
| 6 | Homepage shows the product UI | **VERIFIED** — `003`, re-captured in `4cd744d` |

**Three of six are open, and they are exactly US1, US2 and US3.** The product is built; the
evidence is not.

---

## Phase 1: Setup

- [X] T001 Commit the pending constitution amendment `.specify/memory/constitution.md` (v1.4.0) — it is currently uncommitted, and until it lands the gates in Principles XXIV and XXVI are not in force for anyone but this conversation
- [X] T002 [P] Commit the `specs/005-release-verification/` artifacts so the contracts the tasks below cite are readable from the repository
- [X] T003 [P] Create `docs/qa/` and `docs/qa/records/` with a `.gitkeep`, so completed device records have a home before the first one is written

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: find out whether production is currently broken. Everything else is scheduling;
this is an open question about a live system.

- [X] T004 **Production is healthy — verified 2026-10-10.** Target found via the Vercel project's production alias, `https://purchaseorderflow.vercel.app` (the per-deployment URLs sit behind deployment protection and return Vercel's SSO page). `GET /api/health` → 200; `POST /api/auth/signup` → **201**; `GET /api/auth/me` → **200**. Those are the exact two calls that returned 500. Production runs commit `0deacf8`, which contains the startup migration, so a fresh boot brought the schema to head by itself — no manual `alembic upgrade head` was needed, and the earlier question of whether my test run had migrated it is moot. Original task: Determine whether production signup currently works, and if not apply `alembic upgrade head` against the production database. Context: migration `0002` was deployed without being applied, which returned 500 from signup and from every authenticated request. The code fix (`0deacf8`) makes a fresh boot self-heal, so a redeploy may have already resolved it — **and a test run of mine may have applied the migration as an unauthorised side effect**. Confirm the actual state rather than assuming either. Record what was found

**Checkpoint**: production is known-good or known-broken, as a fact rather than an inference.

---

## Phase 3: User Story 1 — The deployed system is checked, not just the build (Priority: P1) 🎯 MVP

**Goal**: a deploy is followed by an automatic check against the deployed system, and a failure is
loud and attributable.

**Independent Test**: run it against a healthy deployment and see it pass; against one with a
stale schema and see it fail naming the step.

**Why first**: it is the only item here that detects a failure nobody is looking for. On
2026-10-09 the build was green, every test passed, and production returned 500 for hours.

- [X] T005 [US1] Create `backend/src/scripts/smoke_deployed.py` taking the base URL as a **required positional argument with no default** — it must refuse to run without one and must never infer a target from `.env`, `DATABASE_URL`, or any environment variable. Standard library only (no `requests`, no backend package import), so it runs when the backend package is the thing under suspicion. Per `contracts/deployed-smoke.md`
- [X] T006 [US1] Implement the step sequence in `smoke_deployed.py`: `GET /api/health` (200, names a database host) → `POST /api/auth/signup` (201 with a token) → `GET /api/auth/me` (200, email matches) → `POST /api/parties` (201) → `POST /purchase-orders` (201) → `POST /purchase-orders/{id}/dispatches` (201) → re-read the order and assert remaining equals ordered minus dispatched. **`GET /auth/me` is the step that matters most**: during the outage signup was broken *and* login returned 200, so a check stopping at "signup responded" would have passed through most of it
- [X] T007 [US1] Name the organization `SMOKE <ISO-8601 UTC timestamp>` in `smoke_deployed.py` and print the organization id, user email, party id and purchase order id it created, so a later cleanup can target them exactly instead of guessing by pattern (data-model.md, "Check Account")
- [X] T008 [US1] Implement the three exit codes in `smoke_deployed.py` — 0 passed, 1 the deployment answered and a step failed, 2 the deployment could not be reached. A caller must tell "broken" from "unreachable" without reading logs; a rollout in progress and a deployment returning 500 are different events (FR-003, FR-004, SC-003)
- [X] T009 [US1] Add `--json` output to `smoke_deployed.py` reporting base URL, deployed commit if exposed, each step with its outcome and on failure the status code and body, the created ids, and one overall result
- [X] T010 [US1] Create `.github/workflows/post-deploy-smoke.yml` triggered on `deployment_status`, running the check when a **production** deployment reports success, reading the target from the event payload. A failing check must fail the workflow run so a red mark exists against that deployment (FR-007). The workflow is convenience; the script stays runnable by hand during an incident, when CI is the last thing anyone wants to depend on
- [X] T011 [US1] **All three exit paths proven, and the check caught a flaw in itself.** (1) Unreachable host → **exit 2**. (2) A local backend pinned at migration `0001` with `AUTO_MIGRATE=false` — the outage state — → **exit 1, `FAILED at signup … got 500: {"error":{"code":"internal_error"…}}`**, which is verbatim the error reported from production. (3) Same backend after `alembic upgrade head` → **exit 0**, all seven steps. (4) Production → **exit 0**. The first attempt at case 2 failed at `health` with a 404, because the script hardcoded the `/api` prefix that only exists as a Vercel rewrite — so it could not be pointed at a local backend at all, which is both what this task needs and what anyone debugging would want. Fixed by probing `/api/health` then `/health` once and locking the prefix for the run. Original: Verify the check by running it twice: once against a deployment known to be healthy (expect exit 0) and once against a local backend pinned at migration `0001` (expect exit 1, naming the failing step). A check that has only ever passed is not yet evidence — the same reasoning that made the 44px test worth breaking on purpose
- [X] T012 [US1] Confirm against production that a duplicate email returns 409 and the message attaches to the email field rather than a banner (your B3). Shipped in `auth.py:37` and `Signup.tsx:33`; this confirms it on the deployed system, which is the only place it has not been checked

**Checkpoint**: a deploy that breaks signup is found in seconds, by a machine.

---

## Phase 4: User Story 2 — A dispatch on a real phone (Priority: P1)

**Goal**: at least one recorded real-device dispatch per release train, with the device named.

**Independent Test**: hand someone a phone and a purchase order; the record names the device.

**Why P1**: Constitution XXVI forbids pitching a release on mobile dispatch without it, so this
gates the beta announcement. It is also the one clause of FR-008 — submit reachable with the
keyboard open — that no automated check has ever verified.

- [X] T013 [US2] Create the template `docs/qa/mobile-dispatch.md` with every required field from `contracts/device-record.md`: release tag, deployed commit, date, tester, device model, OS and version, browser and version, dispatch completed, submit reachable with keyboard open, zoom or pan needed, time taken, notes. A record missing any required field does not satisfy the gate — incomplete is absent, not "mostly done"
- [X] T014 [US2] In `docs/qa/mobile-dispatch.md`, write the seven steps the tester performs against the **deployed** application, with step 4 stated plainly: focus the quantity field so the keyboard appears, and **without dismissing it**, find the submit control
- [X] T015 [US2] In `docs/qa/mobile-dispatch.md`, list what explicitly does **not** satisfy this gate: a Playwright viewport run, Chrome device mode, any emulator or simulator, a hosted browser service, a record from a previous release train, or "we tested it on a phone" with no device named
- [ ] T016 [US2] **Manual, not automatable.** Record a dispatch on a physical **Android** device against the deployed application and file `docs/qa/records/<release-tag>.md`. No automated run may close this
- [ ] T017 [US2] **Manual, not automatable.** The same on a physical **iPhone in Safari**, into the same record file. One platform does not stand in for the other — the keyboard and the address bar behave differently, which is the entire reason this gate exists

**Checkpoint**: the mobile claim is earned rather than asserted.

---

## Phase 5: User Story 3 — An export opened in a real spreadsheet (Priority: P2)

**Goal**: once per release, each export format is opened in Excel and Google Sheets and the result
recorded.

**Independent Test**: download each format, open each in both, record what was seen.

- [X] T018 [US3] Add a post-deploy "Spreadsheet acceptance" section to `docs/SMOKE_CHECKLIST.md` with the pass conditions from `contracts/spreadsheet-acceptance.md`: columns land in their own columns, the first row reads as a header, **selecting a quantity column shows a sum in the status bar**, dates read as dates, a party name containing a comma or quote renders intact, and an empty report still shows its header row
- [ ] T019 [US3] **Manual.** Download the party remaining export and all three organization reports in every offered format from the deployed product, and open each in **both** Excel and Google Sheets. They disagree about type inference, so checking one is half a check
- [ ] T020 [US3] **Manual.** Confirm the empty case specifically: a report with no matching rows shows its header and reads as an empty report, not as a blank or unopenable file. This is the fix from `67bab70` checked for rendering rather than structure
- [ ] T021 [US3] Record the outcome as a checked line in `docs/SMOKE_CHECKLIST.md` naming which applications were used. Anything that renders wrongly is filed as a defect against the export, not worked around by whoever found it — the next person to download it will not know about the workaround

**Checkpoint**: the file a trader actually opens has been opened.

---

## Phase 6: User Story 4 — Someone else can run all of this (Priority: P3)

**Goal**: a newcomer reaches a passing suite from a fresh clone without pointing anything at
production.

**Independent Test**: hand `docs/README.md` to someone who has not worked on this. If they have to
ask, it has not passed.

- [X] T022 [US4] Extend `docs/README.md` with what it predates: the e2e guard that refuses a non-local database and how to respond to it (fix the configuration, do not override), `TEST_PG_URL` for the PostgreSQL-only tests that otherwise skip silently, the startup migration and `AUTO_MIGRATE`, and a pointer to `docs/SMOKE_CHECKLIST.md` and `docs/qa/` for the release gates
- [ ] T023 [US4] **N/A for this agent — left open deliberately, per your instruction.** `backend/.env.example` exists but cannot be read here: `.claude/settings.json` denies `Read(./.env.*)`, and the sandbox blocks even a file-stat on it. So its current contents are genuinely unknown rather than assumed adequate. T022 covers the same ground in `docs/README.md`, which a newcomer reads first; if `.env.example` also needs the local-default comment, a person who can open it has to make that call. Original: **Needs a person who can read `.env*`.** Confirm `backend/.env.example` documents `DATABASE_URL` with a local default and a comment saying what happens if it points elsewhere. This agent cannot read it — the repository's permission rules deny `Read(./.env.*)` — so the current contents are unverified and FR-017 was written against `docs/README.md` instead

**Checkpoint**: the guards are explained rather than discovered.

---

## Phase 7: Release Gates & Cross-Cutting

- [X] T024 Create `.github/pull_request_template.md` with a human-visual-smoke checkbox (your T047), so a change that touches a screen carries a statement that someone looked at it
- [X] T025 Restructure `docs/SMOKE_CHECKLIST.md` into "Before the deploy" and "After the deploy" sections. Every item today is written for a local stack while the file says "run against any new deploy" — the exact gap that let the outage through (research R1)
- [X] T026 **Fix the misleading line.** `docs/SMOKE_CHECKLIST.md`'s Mobile section currently reads "at 390px wide … (`tests/e2e/mobile-viewport.spec.ts` — this one is automated)", which presents a viewport test as settling mobile. Principle XXVI forbids citing it that way. Split it: the automated viewport check stays under Principle XXII, and a separate line requires the real-device record from US2
- [X] T027 [P] Add the post-deploy smoke (US1) and spreadsheet acceptance (US3) to the "After the deploy" section of `docs/SMOKE_CHECKLIST.md`, with the exit-code meanings from `contracts/deployed-smoke.md`
- [ ] T028 **Gated.** Write the beta announcement copy — and only claim mobile dispatch if T016 and T017 have both passed for the release being announced. If they have not, write the copy without any mobile claim (FR-012, your T050). Outward-facing: the owner sends it, not this agent
- [ ] T029 **Manual, not automatable.** Three people outside the team each record a dispatch on a phone unaided, and give a first-impression note on the homepage. Record who and what happened (your T051, SC-011 from 004)
- [X] T030 **Run.** `ruff check src/ tests/` clean (it caught a dead `except … raise` in the new script, now removed); `pytest` **103 passed, 5 skipped**; `npx tsc -b` and `npm run lint` clean; the deployed check **exit 0 against production**. Original: Run the full gate once US1–US3 are in place: `pytest` from `backend/`; `npx tsc -b`, `npm run lint`, `npm run test`, `npx playwright test` from `frontend/`; then the post-deploy check against production

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T003)**: no dependencies. T001 matters more than it looks — the gates below are
  not in force until the constitution amendment is committed.
- **Foundational (T004)**: blocks nothing structurally, but it answers "is production broken right
  now?", which outranks everything else here.
- **US1 (T005–T012)**: after Setup. Independent of US2–US4.
- **US2 (T013–T017)**: after Setup. T013–T015 are writing; T016–T017 need a device and a deployed
  build.
- **US3 (T018–T021)**: after Setup. T018 is writing; T019–T021 need a deployed build.
- **US4 (T022–T023)**: after Setup. Independent.
- **Phase 7**: T025–T027 edit `docs/SMOKE_CHECKLIST.md` and must be sequenced together, not run in
  parallel by different people. T028 depends on US1 and US2. T030 depends on US1–US3.

### Within Each Story

T005 → T006 → T007/T008/T009 (same file, sequence them) → T010 → T011. T013 → T014 → T015 before
T016/T017, since the template must exist before it can be filled in.

### Parallel Opportunities

- T002 and T003 alongside T001.
- Once Setup is done, **US1, US2's writing tasks, US3's writing task and US4 can all proceed in
  parallel** — four disjoint file sets.
- T016 and T017 are two devices and can be done by two people at once.
- The one collision: T018, T025, T026 and T027 all edit `docs/SMOKE_CHECKLIST.md`. Assign them to
  one person or sequence them.

---

## Implementation Strategy

### MVP — US1 alone

1. Setup (T001–T003)
2. T004 — find out whether production is broken
3. US1 (T005–T012)

That is a shippable increment: from then on, a deploy that breaks signup is caught in seconds
instead of hours. It needs nothing from the other three stories.

### Then, in order of what unblocks what

1. **US2** → unblocks the beta announcement (T028), which is otherwise forbidden from mentioning
   mobile.
2. **US3** → closes gate item 4 of your "complete for trial" list.
3. **US4** → makes all of the above runnable by someone who is not you.

### What this feature does not do

No application code changes. Every C1–C6 item on your board is already built; what was missing is
evidence that it works where users are. If something fails one of these gates, the fix is a
separate piece of work — these tasks find problems, they do not pre-emptively solve them.

---

## Deviations from the Supplied Board

1. **B2 is adopted in your richer form, not the spec's.** `spec.md` FR-001 says signup → me →
   party; your board says signup → me → party → PO → dispatch → remaining. Yours is better: it
   exercises the whole of Principle XIII's path, including the remaining-balance calculation that
   is the product's entire claim. **This conflicts with spec FR-005**, which limits the check to
   records its steps need. The conflict is cosmetic rather than real — every extra row lives inside
   the check's own throwaway organization, so the pollution footprint is unchanged at one
   organization per run. **FR-005 should be amended to say so** rather than left contradicting the
   tasks.
2. **T047 became a PR template, and the spreadsheet check did not.** Your board puts the human
   visual smoke on the PR (T024 does that) while research R3 moved the Sheets open to a release
   gate — a PR note binds evidence to a change, but an export's rendering is a property of the
   release, not of the diff.
3. **C7 is split.** The README half is actionable here (T022); the `.env.example` half cannot be
   done by this agent at all (T023), and saying so is more useful than a task that would silently
   not get done.
4. **B1 is a verification task, not a fix task.** The fix is already in `main`. What is unknown is
   the state of production — including whether a test run of mine already migrated it.

---

## Notes

- 30 tasks. 12 of your 15 board items were already shipped; the mapping table records each.
- **Six tasks cannot be closed by any command**: T016, T017, T019, T020, T029, and T023. They are
  written that way deliberately. An automated check that appeared to cover a thumb, a spreadsheet's
  rendering, or a stranger's first impression would be worse than admitting it does not.
- The highest-value task is **T011**: proving the new check can fail. Everything else in US1 is
  undone by a check that passes unconditionally.
