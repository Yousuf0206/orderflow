# Contract: Account deletion

## GET /auth/account/deletion-preview

What deleting would do, for the confirmation screen.

```json
{
  "role_effect": "owner",
  "organizations_deleted": [{ "id": "uuid", "name": "Acme Steel", "member_count": 4 }],
  "organizations_left": [{ "id": "uuid", "name": "Other Co" }],
  "purge_after_days": 30
}
```

`role_effect`: `member` (only this login goes) or `owner` (at least one organization is deleted).

## DELETE /auth/account

```json
{ "confirm_organization_names": ["Acme Steel"] }
```

- Owner deletions MUST echo every organization name from the preview; mismatch → 422, nothing
  changes.
- 200 → `{ "deleted_at": "...", "purge_after": "..." }`. All of the caller's tokens, and for deleted
  organizations every member's tokens, are rejected from this moment (401 with a plain message).
- Idempotent for an already-deleted user: 401.

## Sign-in after deletion

`POST /auth/login` for a deleted user → 401, same message as wrong credentials.
