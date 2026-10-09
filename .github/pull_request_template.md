## What this changes

<!-- One or two sentences. What is different afterwards, and for whom. -->

## Why

<!-- The problem, not the solution. If it fixes a defect, what was the user seeing? -->

---

## Verification

Tick what you actually did. An unticked box is information, not a failure — leaving one blank
is how the next person knows what is still unknown.

- [ ] Backend tests pass (`pytest`)
- [ ] Frontend typecheck, lint and unit tests pass
- [ ] **I opened the affected screens in a browser and looked at them**
- [ ] If it touches a screen at phone width, I checked it at 390px

### Schema

- [ ] This change contains **no migration**
- [ ] It contains a migration, and the schema reaches production ahead of the code

> Migrations apply at startup under an advisory lock (`src/core/migrate.py`), so a normal
> deploy self-heals. If this change bypasses that — a manual step, a data backfill, anything
> with an ordering requirement — say here who runs it and when. "It will be run manually" is
> not an answer unless someone is named.

### Claims

- [ ] This change makes no claim about mobile dispatch
- [ ] It does, and a real-device record exists for the release it ships in

> Constitution Principle XXVI: a viewport test satisfies XXII, not this. `docs/qa/mobile-dispatch.md`.

---

## Release gates

Only for a change being released, not for every PR — see `docs/SMOKE_CHECKLIST.md`.

- [ ] Pre-deploy checklist run
- [ ] Post-deploy smoke exits 0 against production
- [ ] Spreadsheet acceptance done, if exports changed
