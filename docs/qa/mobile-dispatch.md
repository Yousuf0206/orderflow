# Real-Device Dispatch Record — Template

**Copy this file to `docs/qa/records/<release-tag>.md` and fill it in.** One record per release
train, covering both platforms.

This gate exists because a viewport is not a phone. Playwright models width. It does not model a
thumb, an on-screen keyboard covering the submit button, an address bar that moves on scroll, or
sunlight. Constitution Principle XXVI requires a physical device, and is explicit that automated
phone-viewport checks satisfy Principle XXII and **must not be cited as satisfying this one**.

## What does not satisfy this gate

Listed because each has been offered as a substitute at some point:

- A Playwright run at a phone viewport, including `mobile-viewport.spec.ts`
- Chrome device mode, or any emulator or simulator
- A hosted browser or device-farm service
- A record from a previous release train
- "We tested it on a phone", with no device named

## Steps

Against the **deployed** application — not a local server. The point is the thing users reach.

1. Sign in on the device.
2. Open a purchase order that has a remaining balance.
3. Focus the quantity field so the on-screen keyboard appears.
4. **Without dismissing the keyboard**, find the submit control. Record whether it is reachable.
5. Complete the dispatch one-handed.
6. Confirm the Remaining figure updates to the expected value.
7. Record whether any pinch-zoom or sideways panning was needed at any point.

**Step 4 is the reason this gate exists.** Everything else here has an automated equivalent that
already runs; that clause of FR-008 has never been verified by anything.

---

## Record

Copy from here down.

```markdown
# Real-Device Dispatch — <release-tag>

| Field | Value |
| --- | --- |
| Release tag | |
| Deployed commit | |
| Date | |
| Tester | |

## Android

| Field | Value |
| --- | --- |
| Device model | |
| OS and version | |
| Browser and version | |
| Dispatch completed | yes / no |
| Submit reachable with keyboard open | yes / no |
| Zoom or pan needed | yes / no |
| Time from PO screen to updated Remaining | |
| Notes | |

## iPhone

| Field | Value |
| --- | --- |
| Device model | |
| iOS version | |
| Browser and version | |
| Dispatch completed | yes / no |
| Submit reachable with keyboard open | yes / no |
| Zoom or pan needed | yes / no |
| Time from PO screen to updated Remaining | |
| Notes | |

## Outcome

- [ ] Both platforms completed a dispatch
- [ ] Submit was reachable with the keyboard open on both
- [ ] No zoom or pan was needed on either

**This release may be described as supporting mobile dispatch:** yes / no
```

---

## Rules for filling it in

- **A record missing any required field does not satisfy the gate.** Incomplete is absent, not
  "mostly done".
- **One platform does not stand in for the other.** The keyboard and the address bar behave
  differently on iOS and Android, which is the whole reason both are required.
- **A failure is recorded as a failure.** Do not amend a record to make a release look ready; write
  a new record once the problem is fixed.
- **A missing record is a "no".** The gate asks whether a record exists for this release train;
  absence answers it.
- Until this record passes, the release **must not** be announced or described as supporting
  mobile dispatch (FR-012, Principle XXVI).
