# Beta announcement — DRAFT

**Status: ready to send, with one claim deliberately absent.**

This copy makes **no claim about mobile or phone use**. That is not an oversight. Constitution
Principle XXVI requires a recorded dispatch on a physical device before a release may be described
as supporting mobile dispatch, and no such record exists yet (`docs/qa/records/` is empty). The
phone work is built and measured at four viewport widths, but measured width is not a thumb and
not an on-screen keyboard.

If you file an Android and an iPhone record from `docs/qa/mobile-dispatch.md` before sending,
use the alternative paragraph at the bottom. If you do not, send this as written — it is accurate
either way.

**What this release has been verified to do**, as of 2026-10-10 against
`https://purchaseorderflow.vercel.app`:

- Sign up, create a party, create a purchase order, record a partial dispatch, and see the
  remaining balance update — checked end to end against production, not just in tests
- Export a party's remaining balances, and the organization reports, in CSV, Excel and PDF
- Invite a second user and have them join
- Filter purchase orders by status, party, and PO number

---

## The email

> **Subject:** OrderFlow: partial dispatches, and the balance that follows them
>
> Hello,
>
> OrderFlow is open for you to try. It does one job: it tracks what you ordered, what has been
> dispatched so far, and what is still outstanding — per purchase order and per party — without
> anyone retyping a balance into a spreadsheet.
>
> What you can do today:
>
> - **Record partial dispatches against a purchase order.** The remaining balance is calculated
>   from the dispatches themselves, every time you look at it. It is never a number someone typed
>   and forgot to update.
> - **See where a party stands.** Open a party and you see their open orders and what is still
>   owed on each.
> - **Find the order you need.** Filter by status — overdue, due soon, on track, fully dispatched
>   — or by party, or by typing part of a PO number.
> - **Send a party their outstanding balances.** Export to CSV, Excel or PDF straight from the
>   party's page, with the figures calculated at the moment you export.
> - **Bring a colleague in.** Invite them by email with a role: owners and managers can manage
>   orders, staff can record dispatches, viewers can read.
>
> It is free while we are in trial, and there is nothing to buy. We do not ask for card details,
> there are no paid plans to choose between, and nothing in the product will try to sell you one.
> Trial organizations are limited to 3 users and 25 purchase orders. If you hit either and want
> more room, reply and we will sort it out.
>
> Two things worth knowing up front:
>
> - **Invitation emails depend on how your deployment is configured.** If no mail service is set
>   up, the app says so plainly and gives you a link to pass to your colleague yourself. It will
>   not tell you an email was sent when it was not.
> - **When a trial ends, the organization becomes read-only.** Your records stay visible and
>   exportable; creating and editing pause. Get in touch before that happens and we can extend it.
>
> Start here: https://purchaseorderflow.vercel.app
>
> If something is wrong, confusing, or slower than it should be, tell us. That is the most useful
> thing you can send us during a trial.

---

## If a real-device record exists for this release

Only if `docs/qa/records/<tag>.md` shows both an Android and an iPhone dispatch completed, with
submit reachable while the keyboard was open. Then add this bullet to the list above:

> - **Record a dispatch from your phone.** The dispatch form is built for one-handed use at a
>   gate or on a truck — large controls, a numeric keypad for quantities, and no sideways
>   scrolling.

And only then may the subject line or the pitch mention mobile.

---

## Claims deliberately not made, and why

| Not claimed | Why |
| --- | --- |
| Mobile or phone dispatch | No real-device record (Principle XXVI). Viewport tests satisfy XXII, not this |
| Add to home screen | The manifest and icons ship, but installation has never been tested on a physical device either. Same class of unverified claim |
| Any customer count, logo, testimonial or rating | None exist. Principle XVII forbids inventing them |
| Paid plans, pricing, or upgrading | Checkout is switched off at the server and unverified end to end (Principles IX and XIV) |
| Offline use | There is deliberately no offline cache — a cached remaining balance could be stale, which Principle II forbids |
| Email delivery as reliable | It depends on deployment configuration, so the copy says exactly that instead |

Each row is a thing it would be easy and tempting to say. The product is better served by a
shorter list of true sentences than by a longer list that a first real user discovers is wrong.
