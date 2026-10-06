# Phase 1 Data Model: OrderFlow MVP Core Platform

All tenant-owned entities carry `organization_id` and are subject to the shared
tenant-scoping query layer described in research.md. Entities marked "soft
delete" carry a nullable `deleted_at` timestamp and are excluded from default
queries, calculations, and reports when `deleted_at IS NOT NULL`.

## Organization

Tenant root. One row per customer company.

- `id` (PK)
- `name`
- `logo_url` (nullable)
- `currency` (ISO 4217 code, per-organization, no global default assumed)
- `timezone` (IANA timezone string, per-organization)
- `plan_tier` (`trial` | `starter` | `business` | `pro`)
- `trial_ends_at` (nullable timestamp; null once converted to paid)
- `is_suspended` (bool, set by Super Admin, FR-018)
- `created_at`, `updated_at`

**Relationships**: has many Users (via Membership), Parties, Purchase Orders
(through Parties), Subscription/Plan record, Notifications, Audit Log Entries.

## User

A person who can authenticate. May belong to one Organization (per Assumption:
single-organization membership for MVP) or be a platform-level Super Admin (no
`organization_id`).

- `id` (PK)
- `email` (unique)
- `password_hash`
- `is_super_admin` (bool)
- `created_at`, `updated_at`

## Membership

Join of User to Organization with a role. Kept separate from User so the
single-organization-per-user assumption can be relaxed later without a schema
rewrite.

- `id` (PK)
- `organization_id` (FK → Organization)
- `user_id` (FK → User)
- `role` (`owner` | `manager` | `staff` | `viewer`)
- `invited_at`, `accepted_at` (nullable until invite accepted)
- `created_at`, `updated_at`

**Validation**: a User has at most one Membership for MVP (enforced at the
service layer per the single-org assumption); an Organization must always retain
at least one `owner` Membership.

## Party

Customer/supplier record. **Soft delete.**

- `id` (PK)
- `organization_id` (FK → Organization)
- `party_code` (unique per organization)
- `party_name`
- `city` (nullable)
- `contact_person` (nullable)
- `phone` (nullable)
- `archived_at` (nullable — distinct from `deleted_at`; "archived" is a
  user-facing soft-hide, "deleted" is a stronger soft delete, both excluded from
  default active lists)
- `deleted_at` (nullable)
- `created_at`, `updated_at`

**Validation**: `party_code` unique within `organization_id` among non-deleted
rows.

## Purchase Order (PO)

**Soft delete.**

- `id` (PK)
- `organization_id` (FK → Organization)
- `party_id` (FK → Party)
- `po_number` (unique per organization, among non-deleted rows)
- `material`
- `ordered_qty` (decimal, > 0)
- `unit` (e.g., kg, ton, pcs)
- `order_date`
- `due_date`
- `notes` (nullable)
- `deleted_at` (nullable)
- `created_at`, `updated_at`

**Derived (never persisted — computed at read time, Principle II)**:
- `total_dispatched` = SUM(`dispatch.qty`) over non-deleted Dispatches for this PO
- `remaining_balance` = `ordered_qty` − `total_dispatched`
- `days_to_delivery` = `due_date` − current date (organization timezone)
- `status`:
  - `fully_dispatched` if `remaining_balance` <= 0
  - `overdue` if `remaining_balance` > 0 and `due_date` < today
  - `due_soon` if `remaining_balance` > 0 and `due_date` is within the next 3
    days (inclusive of today)
  - `on_track` otherwise

**Validation**: `ordered_qty` > 0; `po_number` unique within `organization_id`
among non-deleted rows; `due_date` >= `order_date` (reasonable default,
documented assumption, not stated explicitly by the user).

**State transitions**: `status` is a pure function of `remaining_balance` and
`due_date` as defined above — it is not a stored state machine field, so there
are no illegal-transition rules beyond the derivation itself.

## Dispatch

Belongs to exactly one Purchase Order. **Soft delete.**

- `id` (PK)
- `organization_id` (FK → Organization, denormalized for tenant-scoping
  consistency with other tables)
- `purchase_order_id` (FK → Purchase Order)
- `dispatch_date`
- `qty` (decimal, > 0)
- `vehicle_ref` (nullable)
- `remarks` (nullable)
- `deleted_at` (nullable)
- `created_at`, `updated_at`

**Validation**: `qty` > 0. A dispatch that would make the PO's
`remaining_balance` negative triggers a confirmable warning at the API/UI layer
(FR-009) rather than a hard database constraint, since the business process
explicitly allows a user to proceed past the warning if they choose (see spec
Edge Cases).

## Subscription / Plan

One active record per Organization.

- `id` (PK)
- `organization_id` (FK → Organization, unique)
- `plan_tier` (`trial` | `starter` | `business` | `pro`)
- `stripe_customer_id` (nullable until first checkout)
- `stripe_subscription_id` (nullable)
- `max_users` (int, derived from `plan_tier`)
- `max_active_pos` (int, derived from `plan_tier`)
- `trial_ends_at` (nullable)
- `is_read_only_locked` (bool — true once trial expires without upgrade, FR-021)
- `created_at`, `updated_at`

## Notification

- `id` (PK)
- `organization_id` (FK → Organization)
- `purchase_order_id` (FK → Purchase Order, nullable if not PO-specific)
- `type` (`due_soon` | `overdue`)
- `channel` (`in_app` | `email`)
- `recipient_user_id` (FK → User)
- `sent_at`
- `read_at` (nullable, in-app only)

## Audit Log Entry

Append-only; never updated or deleted.

- `id` (PK)
- `organization_id` (FK → Organization)
- `actor_user_id` (FK → User)
- `action` (`create` | `edit` | `delete`)
- `entity_type` (`party` | `purchase_order` | `dispatch`)
- `entity_id`
- `before_state` (nullable JSON snapshot)
- `after_state` (nullable JSON snapshot)
- `created_at`

**Access**: read access restricted to `owner` and `manager` roles (FR-016).
