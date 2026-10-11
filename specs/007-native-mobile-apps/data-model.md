# Data Model: Native iOS and Android Apps

No business entity changes. Additions support account deletion (spec FR-012, constitution VII
v2.0.0 exception).

## users — changed

| Field | Type | Notes |
|-------|------|-------|
| deleted_at | timestamptz? | set when the user deletes their account |
| purge_after | timestamptz? | `deleted_at + 30 days` |
| tokens_valid_after | timestamptz? | access/refresh tokens issued before this are rejected |

A deleted user cannot sign in; their email may sign up again as a new user (a new row).

## memberships — changed

| Field | Type | Notes |
|-------|------|-------|
| deleted_at | timestamptz? | set for every membership of a deleting user |

## organizations — changed

| Field | Type | Notes |
|-------|------|-------|
| deleted_at | timestamptz? | set when its sole owner deletes their account |
| purge_after | timestamptz? | `deleted_at + 30 days` |

A soft-deleted organization is invisible: every member's request scoped to it is refused.

## account_purge_records — new

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| kind | str | `user` or `organization` |
| subject_id | uuid | id of the purged row (not personal data) |
| deleted_at | timestamptz | |
| purged_at | timestamptz | |

No names, emails, or business data (VII exception).

## Rules

- Delete (non-owner): user + memberships soft-deleted, `tokens_valid_after = now`.
- Delete (owner): as above; each organization where the user is the **only** active owner is
  soft-deleted and every member's `tokens_valid_after = now`; organizations with another active
  owner are left intact.
- Purge job (daily): for rows with `purge_after <= now`, hard-delete the user (and their memberships),
  or the organization with all its parties, POs, lines, dispatches, dispatch lines, notifications,
  subscriptions, memberships, and audit entries; write one `account_purge_records` row each.
- Nothing is purged before `purge_after`.
