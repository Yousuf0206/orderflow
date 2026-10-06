<!--
Sync Impact Report
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: n/a (first concrete set, replacing placeholder slots)
Added sections:
  - Core Principles (8 principles: Multi-tenancy First, Remaining Balance is
    Sacred, Partial Dispatches are Core, Simplicity over Features,
    Role-Based Access, Audit Everything Important, No Hard Deletes of
    Business Data, Mobile + Desktop Equality)
  - Constraints
  - Governance
Removed sections: generic [SECTION_3_NAME] slot (no project-specific
  workflow/review content supplied yet; omitted rather than left as a
  placeholder)
Deferred items / TODOs:
  - TODO(RATIFICATION_DATE): original adoption date not supplied by user;
    using today's date as a placeholder ratification date pending
    confirmation.
Templates requiring follow-up: none reference principle counts/names
  directly at this time; re-check .specify/templates/plan-template.md and
  .specify/templates/spec-template.md during next /speckit-plan run for
  alignment with the principles below.
-->

# OrderFlow Constitution

OrderFlow is a multi-tenant SaaS for traders and dealers to track Purchase
Orders, partial dispatches, and remaining balances in real time.

## Core Principles

### I. Multi-tenancy First
Every piece of business data MUST be isolated by `organization_id`. No
cross-tenant data leakage is acceptable under any circumstance. All queries,
background jobs, exports, and integrations MUST scope by organization at the
data-access layer, not only in the UI.

### II. Remaining Balance is Sacred
Remaining Balance = Ordered Qty − SUM(Dispatches). This calculation MUST
always be accurate and computed in real time; it MUST NEVER be stored as a
static/cached value that can drift from the underlying dispatch records.

### III. Partial Dispatches are Core
A single Purchase Order MUST support unlimited partial dispatches. The
system MUST NOT force full delivery only; partial fulfillment over time is a
first-class workflow, not an edge case.

### IV. Simplicity over Features
Clear, fast workflows are preferred over complex enterprise features. A user
MUST be able to create a PO and record a dispatch in under 60 seconds.
Any proposed feature that meaningfully slows this core workflow MUST be
justified or redesigned.

### V. Role-Based Access
Every action MUST respect the user's role: Owner / Manager / Staff /
Viewer. Staff MAY add dispatches but MUST NOT manage billing or users.
Authorization checks MUST be enforced server-side, not only hidden in the
UI.

### VI. Audit Everything Important
Creating, editing, or deleting Parties, Purchase Orders, and Dispatches
MUST be logged with enough detail (who, what, when, before/after state) to
reconstruct history for support and compliance purposes.

### VII. No Hard Deletes of Business Data
Parties, Purchase Orders, and Dispatches MUST use soft deletes
(`deleted_at`) rather than hard deletes. Soft-deleted records MUST be
excluded from normal views and calculations (including Remaining Balance)
while remaining available for audit and recovery.

### VIII. Mobile + Desktop Equality
Core workflows (creating a PO, recording a dispatch, viewing remaining
balance) MUST work well on both desktop and mobile viewports. A workflow
that only works on desktop is not considered complete.

## Constraints

- Primary market: SME traders (steel, cement, hardware, building materials).
- Initial focus: responsive web application. Native mobile apps are a later
  phase, not part of the MVP.
- Design with offline-friendly thinking in mind, though an online-first
  implementation is acceptable for MVP.
- Currency and timezone MUST be configurable per organization; neither may
  be hard-coded globally.

## Governance

This constitution supersedes other informal practices for OrderFlow.
Amendments require: (1) a documented rationale, (2) an explicit version
bump following semantic versioning (MAJOR for incompatible principle
removals/redefinitions, MINOR for new principles or materially expanded
guidance, PATCH for clarifications/wording), and (3) a note on any
migration impact to existing specs, plans, or code.

All feature specs and plans produced via Spec Kit commands (`/speckit-specify`,
`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`) MUST be checked
against these principles; any deviation MUST be called out explicitly and
justified rather than silently ignored. Complexity that conflicts with
Principle IV (Simplicity over Features) must be justified in the plan.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-10-06
