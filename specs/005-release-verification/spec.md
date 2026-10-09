# Feature Specification: Release Verification

**Feature Branch**: `005-release-verification`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Completion backlog that creates difference" — P0 availability and
trust (signup/login recovery, export contract, real-device dispatch), P1 beat-Excel items
(filters, party share pack, team invite, landing), P2 completeness (PWA polish, overdue
visibility, local/CI ergonomics). Out of scope: native store apps, inventory/WMS, buyer portal,
Stripe paid launch, WhatsApp Business API.

## Scope Reconciliation

**Almost all of this backlog is already shipped.** Verified against the codebase on 2026-10-10,
much of it within the last several hours. What remains is not more product — it is the evidence
that the product works, which is the one thing that has repeatedly been assumed rather than
obtained.

**Already shipped — excluded from this feature:**

| Backlog item | Where it lives |
| --- | --- |
| P0.1 — fix the production 500 on signup | Root cause was migration `0002` deployed without being applied. Fixed by `0deacf8`: the schema is brought to head at startup under an advisory lock. **The deployed instance may still need that first boot or a manual `alembic upgrade head`** — a deploy action, not spec work |
| P0.1 — duplicate email vs true server failure | `Signup.tsx` already distinguishes 409 (inline on the email field, with focus) from 422 (per-field validation) from everything else (a general message) |
| P0.2 — every report declares columns | `reports.py` `REPORT_COLUMNS`, shipped in `67bab70` |
| P0.2 — empty org exports a header row | Same commit; `overdue-orders.csv` went from 2 bytes to 64. Covered by `test_report_columns.py` |
| P0.2 — numeric quantity columns, not text | Verified: the xlsx writes numeric cells, so `SUM` works. Covered by the export validation |
| P1.1 — status, party and search filters; overdue → filtered list | Shipped in `e48cd25` and `342f47b` |
| P1.2 — party CSV export and printable summary | Shipped in `a39a7ea` and `7de72c3` |
| P1.3 — invite, accept, copy-link fallback, honest UI, viewer role gates | Shipped in `ce6ecb9`, `3bbe340` and `b13f08c` |
| P1.4 — landing hero, crops, trial-only CTA, OG image | Shipped by `003`; re-captured in `4cd744d` after the 44px controls changed the hero |
| P2.1 — manifest, icons, add-to-home-screen, mobile nav | Shipped in `92a8f0d` and `b5cf1a8` |
| P2.2 — consistent badges | Shipped; `statusConsistency.test.tsx` compares surfaces rather than inspecting one |
| P2.3 — guard refusing a production database | Shipped in `f107ce5` and reinforced in `0deacf8` |

**Deferred by the backlog's own wording:** the owner email digest for overdue purchase orders
("optional ... later").

**Out of scope, per the backlog:** native store apps, full inventory/WMS, buyer portal, Stripe
paid launch, WhatsApp Business API.

**What is left, and what this feature is:** four pieces of verification. Three of them are named
by the backlog (post-deploy smoke, real-device dispatch, open an export in a spreadsheet); the
fourth is documentation so the first three can be run by someone who is not the person who built
them. Constitution v1.4.0 made two of these binding and records both as currently unmet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The deployed system is checked, not just the build (Priority: P1)

A deploy completes. Today the only evidence that it worked is that the build passed, which says
nothing about the running system: on 2026-10-09 the build was green, every test passed, and
production returned 500 on every authenticated request for hours because a migration had not been
applied. The failure was invisible until a person tried to sign up.

After this story, a deploy is followed by an automated check against the deployed system — sign
up, read back the account, create a party — and a failure is loud and attributable to that deploy.

**Why this priority**: it is the difference between finding an outage in seconds and finding it
when a customer does. It is also the only item here that detects a class of failure nobody is
looking for, rather than confirming something already believed to be true.

**Independent Test**: run the check against a deployed environment known to be healthy and see it
pass; point it at one with a deliberately stale schema and see it fail with a message naming what
broke.

**Acceptance Scenarios**:

1. **Given** a healthy deployment, **When** the check runs, **Then** it signs up, reads the
   account back, creates a party, and reports success with the environment and commit it checked.
2. **Given** a deployment whose schema is behind its code, **When** the check runs, **Then** it
   fails, names the failing step and the status code, and does not report success.
3. **Given** a deployment that is unreachable, **When** the check runs, **Then** it reports the
   deployment as unreachable, distinctly from reporting it as broken.
4. **Given** a check that has run, **When** anyone asks what it did, **Then** the account and
   organization it created are identifiable as check data and not mistaken for a real signup.
5. **Given** a check that fails, **When** a release is about to be announced, **Then** the
   announcement is blocked — a failed check is not advisory.

---

### User Story 2 — A dispatch is recorded on a real phone (Priority: P1)

A dispatch clerk uses a physical phone at a gate. Every claim the product makes about mobile use
rests on viewport tests, which model width and nothing else — not a thumb, not an on-screen
keyboard covering the submit button, not an address bar that moves on scroll, not sunlight.

After this story, at least one real dispatch has been recorded on a real device per release
train, with the device, OS, browser and outcome written down.

**Why this priority**: the constitution now forbids pitching a release on mobile dispatch without
it (Principle XXVI), so this gates the beta announcement. It is also the specific clause of
FR-008 — the submit control reachable with the keyboard open — that no automated check can reach.

**Independent Test**: hand someone a phone and a purchase order; they record a dispatch; the
record names the device.

**Acceptance Scenarios**:

1. **Given** a physical Android phone, **When** a dispatch is recorded on the deployed
   application, **Then** it completes without pinch-zoom or horizontal panning, and the result is
   recorded with device model, OS version and browser.
2. **Given** a physical iPhone in Safari, **When** the same is attempted, **Then** the same holds.
3. **Given** the quantity field focused with the on-screen keyboard open, **When** the user looks
   for the submit control, **Then** it is reachable without first dismissing the keyboard.
4. **Given** a device where any of the above fails, **When** the result is recorded, **Then** the
   failure is recorded as such and the release is not described as supporting mobile dispatch.
5. **Given** a new release train, **When** it is prepared, **Then** a prior train's record does
   not satisfy it.

---

### User Story 3 — An exported file is opened in a real spreadsheet (Priority: P2)

A trader opens an export in Excel or Google Sheets. Automated checks confirm the files are
well-formed tables with numeric cells; nobody has opened one and looked at it.

After this story, once per release, each export format is opened in a real spreadsheet and the
columns, numbers and dates are confirmed to render correctly.

**Why this priority**: the structural checks already catch the failures most likely to occur — a
file that opens as one column, or quantities stored as text so `SUM` returns zero. This covers
what they cannot: how it actually looks. Real but lower-yield than the two P1 stories.

**Independent Test**: download each format, open each in both spreadsheet applications, and record
what was seen.

**Acceptance Scenarios**:

1. **Given** a party export in spreadsheet-readable form, **When** opened in Excel and in Google
   Sheets, **Then** the seven columns appear as separate columns, quantities are right-aligned
   numbers that can be summed, and due dates read as dates.
2. **Given** an export from an organization with no matching rows, **When** opened, **Then** a
   header row is visible and the sheet is recognisably an empty report rather than a blank file.
3. **Given** a printable summary, **When** opened, **Then** it is legible and fits its page.
4. **Given** anything that renders wrongly, **When** found, **Then** it is recorded as a defect
   against the export rather than worked around by the person who found it.

---

### User Story 4 — A new contributor can run all of this safely (Priority: P3)

Someone who did not build this clones the repository. The dangerous default is that tests resolve
their database connection from a developer environment file, which on this project has pointed at
production — which is how production came to hold several hundred machine-generated organizations,
and how a test run once migrated it.

After this story, the setup path is written down, the safe default is the documented one, and the
guards that already exist are explained rather than discovered.

**Why this priority**: the guards are already in place, so this is documentation of an
already-safe state rather than the safety itself. Valuable, not urgent.

**Independent Test**: follow the written steps on a machine with no prior setup and reach a passing
test suite without ever pointing anything at production.

**Acceptance Scenarios**:

1. **Given** the repository and the written steps, **When** a newcomer follows them, **Then** they
   reach a passing backend and frontend suite against a local database.
2. **Given** those steps, **When** they read about the database setting, **Then** they are told
   what it must be locally, what happens if it points elsewhere, and why the guards exist.
3. **Given** a newcomer who points the suite at a remote database, **When** they run it, **Then**
   it refuses by default and the message explains the override rather than hiding it.
4. **Given** the documented commands, **When** a release checklist is needed, **Then** the
   verification steps from User Stories 1 to 3 are findable in one place.

### Edge Cases

- The post-deploy check runs while a deploy is still rolling out, and reaches a mix of old and new
  instances.
- The post-deploy check is run twice concurrently, by a pipeline and by a person.
- Check accounts accumulate in whichever environment is checked, and must not grow without bound
  or be mistaken for real organizations.
- A deployment is reachable but returns a maintenance or edge-level error, which must not read as
  an application failure.
- A real-device test is attempted on a device too old to run the application at all — a
  compatibility finding, not a dispatch-path failure.
- A spreadsheet application changes how it renders a format between releases.
- A release train contains no change to the dispatch path; the real-device record is still
  required, because the claim is about the release, not the diff.

## Requirements *(mandatory)*

### Functional Requirements

**Post-deploy verification (US1)**

- **FR-001**: A verification check MUST exercise, against a deployed environment: creating an
  account, reading that account back as the signed-in user, and creating a party.
- **FR-002**: The check MUST be runnable on demand against a named environment, and MUST report
  which environment and which deployed commit it checked.
- **FR-003**: A failure MUST name the step that failed and the status returned, and MUST NOT be
  reported as a pass.
- **FR-004**: An unreachable environment MUST be reported distinctly from a broken one.
- **FR-005**: Data the check creates MUST be identifiable as check data by its organization name,
  and the check MUST NOT create business records beyond those needed for the steps in FR-001.
- **FR-006**: The check MUST NOT require or accept long-lived production credentials beyond what a
  normal signup needs; it MUST act as an ordinary new user.
- **FR-007**: A failed check MUST block the release announcement it belongs to.

**Real-device verification (US2)**

- **FR-008**: Recording a dispatch MUST be verified on at least one physical Android device and
  one physical iPhone per release train.
- **FR-009**: Each verification MUST record device model, operating system version, browser, the
  deployed commit, and whether the dispatch completed.
- **FR-010**: The verification MUST confirm the submit control is reachable with the on-screen
  keyboard open over a focused field, and that no pinch-zoom or horizontal panning is needed.
- **FR-011**: A record from a previous release train MUST NOT satisfy the current one.
- **FR-012**: Until a release train has a passing record, that release MUST NOT be announced or
  described as supporting mobile dispatch.

**Spreadsheet acceptance (US3)**

- **FR-013**: Once per release, each offered export format MUST be opened in Excel and in Google
  Sheets, and the result recorded.
- **FR-014**: The check MUST confirm columns are separate, quantities are numeric and summable,
  and dates read as dates.
- **FR-015**: An export from an organization with no matching rows MUST be confirmed to show a
  header row.

**Contributor setup (US4)**

- **FR-016**: Written setup steps MUST take a newcomer from a fresh clone to a passing backend and
  frontend test suite against a local database.
- **FR-017**: The documentation MUST state what the database setting must be for local work, what
  the guards do when it is not local, and how to override deliberately.
- **FR-018**: The release verification steps from US1 to US3 MUST be documented in one place that
  a person preparing a release can follow.
- **FR-019**: Documentation MUST NOT contain real credentials, and MUST NOT instruct a reader to
  point a test run at production.

### Key Entities

- **Verification Record**: the outcome of one check — what was checked, which environment, which
  deployed commit, when, by what or whom, and the result. Needed because the constitution now
  gates announcements on these existing; a check whose result is not written down cannot gate
  anything.
- **Release Train**: the unit a verification record is scoped to. A record satisfies the train it
  was taken against and no other.
- **Check Account**: the throwaway account and organization a post-deploy check creates,
  identifiable as such so it is never mistaken for a real signup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A deploy that breaks signup is detected by the post-deploy check rather than by a
  person, in every case where signup is broken.
- **SC-002**: The post-deploy check reports a result within 2 minutes of being started.
- **SC-003**: A check failure names the failing step, so a reader can tell a broken deployment from
  an unreachable one without opening logs.
- **SC-004**: Every release train carries at least one real-device dispatch record before
  announcement, with zero exceptions.
- **SC-005**: A dispatch can be recorded one-handed on a physical phone without zooming or panning,
  on both a current Android device and a current iPhone.
- **SC-006**: Every exported format opens correctly in both Excel and Google Sheets, checked once
  per release.
- **SC-007**: A newcomer reaches a passing test suite from a fresh clone in under 30 minutes,
  without pointing anything at production.
- **SC-008**: No test run, by anyone, reads from or writes to production — measured by production
  gaining zero machine-generated organizations per release cycle.

## Assumptions

- "Release train" means the set of commits announced together. This project does not formally
  version releases beyond tags, so a train is bounded by its tag.
- The post-deploy check acts as an ordinary new user over the public interface. It is not given
  administrative access, because a check that needs privileges a user does not have is not checking
  what a user experiences.
- Check accounts are created in whichever environment is checked, including production. That is
  deliberate — checking anywhere else does not verify the thing users reach — and is why FR-005
  requires them to be identifiable and minimal. A cleanup policy for them is not specified here;
  it depends on the unresolved question of what to do with the existing machine-generated
  organizations.
- "Each offered export format" means the formats the application actually offers at the time of
  the check, not a fixed list, so adding a format adds it to the acceptance.
- Real-device verification is performed by a person. No arrangement of emulators, device-mode
  windows or hosted browsers satisfies it, per Constitution Principle XXVI.
- The guards preventing tests from reaching production already exist and are assumed to stay. US4
  documents them; it does not reimplement them.
- `.env.example` exists but could not be read while writing this specification — the repository's
  own permission rules deny reading `.env*` files. FR-017 is therefore written as a requirement on
  what the documentation must say, not as a diff to a file whose contents are unverified.

## Constitution Alignment

Governed by `.specify/memory/constitution.md` **v1.4.0**.

- **XXIV (Verify the Deployed System, Not Only the Build)** — User Story 1 exists to satisfy it.
  The constitution records XXIV as currently unmet; this is the work that closes it.
- **XXVI (A Phone Claim Needs a Phone)** — User Story 2 exists to satisfy it, and is likewise
  recorded as currently unmet. FR-012 restates the announcement bar so it is testable here.
- **XXV (An Empty Export Still Says What It Is)** — already met in code; FR-015 keeps the
  spreadsheet acceptance honest about the empty case rather than only the populated one.
- **XXVII (Tests Never Touch Production)** — already met; US4 documents it, and SC-008 measures
  whether it stays true.
- **XIII (Smoke Test Before Every Production Deploy)** — unchanged and still required. US1 adds
  the half that was missing: the same path exercised *after* the deploy, against the deployment.
- **XXIII (Credibility Over Feature Count)** — FR-007 and FR-012 are its enforcement: nothing is
  announced that has not been shown to work.
- **XIV / IX (Paid work gated)** — untouched; nothing here concerns billing.
