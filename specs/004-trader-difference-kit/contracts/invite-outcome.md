# Contract: Invitation Email Outcome

Covers FR-026 to FR-030.

## `send_email` returns an outcome

`backend/src/services/email.py` currently returns `None` on every path, including the one at line 21
that logs the message and sends nothing because `smtp_host` is unset. It MUST return one of:

| Outcome | When |
| --- | --- |
| `sent` | A mail service accepted the message. |
| `not_configured` | No mail service is configured. The message was logged and not sent. |
| `failed` | Sending was attempted and raised. |

`failed` MUST NOT propagate as an exception out of the invitation handler. An invitation whose email
failed is still a valid invitation (FR-029); turning it into a 500 would discard a usable pending
membership and a usable link.

## `POST /org/members/invite`

Unchanged: Owner only, role validated, user limit enforced, 409 if already a member, membership
created with `invited_at` set and `accepted_at` null, a 7-day single-use JWT link built from the
membership id.

### Response — new fields

| Field | Type | Meaning |
| --- | --- | --- |
| `email_outcome` | `sent` \| `not_configured` \| `failed` | What actually happened to the email. |
| `invitation_link` | string \| null | The acceptance URL. Present when `email_outcome` is not `sent`; may be omitted when the email was sent. |

`memberships.invitation_email_sent_at` is set **only** when the outcome is `sent`. Setting it
optimistically would recreate the dishonesty this story removes.

### On returning the link

The link is a signed, expiring, single-use token. It is returned only to an Owner — the person
already authorised to invite — over the same authenticated channel, and it is the only way FR-027
can be satisfied where no mail service exists.

Constraints on the frontend: the link MUST NOT be written to a log, placed in a URL, or included in
any analytics payload. It is rendered for copying and nothing else.

## `GET /org/members`

`MemberOut` gains `invitation_email_sent_at` (nullable) so the team list can distinguish a member
who was emailed from one who was not. `accepted` is unchanged.

## Resend / retrieve link

An Owner must be able to get a usable link for a pending member (FR-028). Either a resend endpoint
or a link-retrieval endpoint satisfies this; the implementation chooses one, and whichever it is
must mint a fresh token rather than reusing a stored one, because no token is stored
(`data-model.md`).

## Interface contract

| Situation | What the interface says |
| --- | --- |
| `sent` | The invitation was emailed, **naming the address** it went to (FR-026). |
| `not_configured` | No invitation email could be sent, with the link offered for copying (FR-026, FR-027). This is stated as a normal condition of this deployment, not as an error the owner caused. |
| `failed` | The invitation was created but the email did not go out, with the link offered. The member remains pending and usable (FR-029). |

The team list shows pending distinctly from active — it already does (`TeamMembers.tsx:174`) — and
offers resend or link retrieval for pending members.

Copying the link must require no technical knowledge: a visible control, not a URL the owner has to
select by hand.

## Accept-invite failures

An expired or already-used link produces a clear explanation — that the invitation has expired or
has already been accepted, and that the owner can send a new one — not a generic failure (FR-030).
`auth.py:155` currently returns "Invite is invalid or already used", which conflates the two cases;
distinguishing them is what this requirement asks for, because the remedies differ.
