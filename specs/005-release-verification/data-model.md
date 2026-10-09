# Data Model: Release Verification

This feature adds no table, no column, and no migration. Its "model" is three kinds of record,
two of which live in the repository as files and one of which lives in the application as
ordinary rows created by a check.

---

## Verification Record (file)

Evidence that a gate was run. The constitution now blocks announcements on these existing, so a
check whose result was not written down cannot satisfy anything.

| Field | Required | Meaning |
| --- | --- | --- |
| Gate | yes | Which gate: post-deploy smoke, real-device dispatch, or spreadsheet acceptance |
| Release train | yes | The tag the record satisfies. A record satisfies exactly one train |
| Deployed commit | yes | What was actually running when checked — not what was merged |
| When | yes | ISO-8601 date and time |
| Who or what | yes | A person's name, or the workflow run that produced it |
| Outcome | yes | Passed or failed. A partial result is a failure with detail |
| Detail | when failed | What failed, and what was seen |

**Invariant**: a record from one release train MUST NOT be read as satisfying another (FR-011).
Release trains are bounded by tags, so a record names its tag and nothing else.

**Where they live**: real-device records in `docs/qa/records/<release-tag>.md`; post-deploy smoke
results in the workflow run and, for a manual run, pasted into the release's record file;
spreadsheet acceptance as a checked line in `docs/SMOKE_CHECKLIST.md` for that release.

---

## Device Record (file)

A Verification Record for the real-device gate, with fields no automated run can supply. Fixed in
`contracts/device-record.md`.

| Field | Required | Why it is required |
| --- | --- | --- |
| Device model | yes | "A phone" is not evidence. A model is |
| OS and version | yes | Keyboard behaviour and viewport handling differ by version |
| Browser and version | yes | Safari's address-bar behaviour on scroll is the specific hazard |
| Deployed commit | yes | Ties the observation to what was running |
| Dispatch completed | yes | The outcome being claimed |
| Submit reachable with keyboard open | yes | FR-010 — the clause no viewport test can reach |
| Zoom or pan needed | yes | The other half of FR-010 |
| Notes or screenshot | no | Useful when something was awkward but passed |

**Invariant**: a record missing any required field does not satisfy the gate. Incomplete is not
"mostly done"; it is absent (FR-009).

**Platform coverage**: one Android and one iPhone per release train (FR-008). One does not stand
in for the other — the keyboard and the address bar behave differently, which is the point.

---

## Check Account (application rows)

What the post-deploy check creates on the deployment it checks. Ordinary rows, made through the
public API by an ordinary new user.

| Attribute | Value |
| --- | --- |
| Organization name | `SMOKE <ISO-8601 UTC timestamp>` — a prefix nothing else uses |
| User email | a unique address under a domain reserved for checks |
| Party | one, created to prove a write path beyond signup works |
| Purchase orders, dispatches | none — FR-005 forbids records the steps do not need |

**Why it is created at all**: the check signs up rather than logging in to a standing account,
because signup is what broke and login returned 200 throughout the outage (R5).

**Known cost, stated rather than hidden**: one organization per deploy, in a production database
that already holds several hundred machine-generated organizations. The naming makes them
separable; what to do about them stays an open decision for a person, not a default set here.

**Identifiability invariant**: the organization name MUST make a check account distinguishable
from a real signup at a glance and by a query, and the check MUST print the organization id, user
email and party id it created, so a later cleanup can target them exactly rather than by pattern
guessing.

---

## Not modelled, deliberately

- **No table for any of this.** Verification evidence that lives in a database the product owns
  would be evidence that disappears when that database is the thing under suspicion.
- **No cleanup schedule for check accounts.** R5 — entangled with a pre-existing decision that
  belongs to a person.
- **No new application entity.** This feature changes what is verified, not what the product does.
