# Contract: Real-Device Dispatch Record

Covers FR-008 to FR-012 and Constitution Principle XXVI.

## What satisfies the gate

One record per platform — at least one physical Android device and one physical iPhone — per
release train. A record is a file at `docs/qa/records/<release-tag>.md`, written from the template
at `docs/qa/mobile-dispatch.md`.

**What does not satisfy it**, stated explicitly because each has been offered as a substitute at
some point:

- A Playwright run at a phone viewport. It models width. It does not model a thumb, a keyboard
  that covers the screen, or an address bar that moves on scroll.
- Chrome device mode, or any emulator or simulator.
- A hosted browser service.
- A record from a previous release train (FR-011).
- "We tested it on a phone" with no device named.

Principle XXVI is explicit that automated phone-viewport checks satisfy Principle XXII and MUST
NOT be cited as satisfying this one.

## Required fields

A record missing any of these does not satisfy the gate. Incomplete is absent, not "mostly done".

| Field | Example | Why |
| --- | --- | --- |
| Release tag | `v0.3.0-difference` | What this record is evidence for |
| Deployed commit | `0deacf8` | Ties the observation to what was actually running |
| Date | `2026-10-10` | — |
| Tester | a name | Someone can be asked what they saw |
| Device model | `Samsung Galaxy A54` | "A phone" is not evidence |
| OS and version | `Android 14` | Keyboard and viewport behaviour differ by version |
| Browser and version | `Chrome 131` | Safari's scroll behaviour is the specific hazard |
| Dispatch completed | yes / no | The claim being made |
| Submit reachable with keyboard open | yes / no | FR-010 — the clause no viewport test can reach |
| Zoom or pan needed | yes / no | The other half of FR-010 |
| Time taken | `22s` | Cross-checks SC-002's budget on a real network |
| Notes | free text | Required when anything was awkward, even if it passed |

## The steps the tester performs

Against the **deployed** application, not a local server — the point is the thing users reach:

1. Sign in on the device.
2. Open a purchase order with a remaining balance.
3. Focus the quantity field so the on-screen keyboard appears.
4. **Without dismissing the keyboard**, find the submit control. Record whether it is reachable.
5. Complete the dispatch one-handed.
6. Confirm the Remaining figure updates.
7. Record whether any pinch-zoom or sideways panning was needed at any point.

Step 4 is the reason this gate exists. Everything else has an automated equivalent.

## Outcome handling

A failure is recorded as a failure (FR-004 of the spec's US2 scenarios) and the release is not
described as supporting mobile dispatch (FR-012). The record is not amended to make a release look
ready; a new record is written when the problem is fixed.

A release train with no record for a platform is **not** a pass by omission. The gate asks whether
a record exists, and absence is the answer "no".

## Scope of the claim it unlocks

A passing record permits describing that release as supporting mobile dispatch. It does not
permit claiming support for devices that were not tested, nor does it transfer to the next
release train.
