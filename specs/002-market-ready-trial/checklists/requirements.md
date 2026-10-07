# Specification Quality Checklist: Market-Ready Trial Updates

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Validation iteration 1 — issues found and corrected

1. **Endpoint and field names leaked into requirements.** The source kit named
   `GET /api/billing`, `/api/auth/me`, and `organization_name`. First draft carried
   them into FR-008, FR-014, and FR-016. Rewritten as "obtained from the server",
   "every field the server requires, including the organization name", and "the
   server's account representation". The testable intent is preserved without
   binding the spec to an endpoint shape.

2. **Route paths leaked into acceptance scenarios.** `/onboarding`, `/dashboard`,
   and `/accept-invite` were replaced with the destinations they represent
   ("onboarding or the dashboard").

3. **Success criteria were partly technical.** An early SC referenced request
   timeout values; SC-005 now states a user-observable 15-second resolution
   guarantee under named failure conditions instead.

4. **"Works" was untestable in several places.** The kit's "create party works",
   "accept-invite flow works", and "at least one export works" became observable
   outcomes: the detail screen opens and shows the saved party (FR-018), access is
   gained with the invited role (FR-034), a file downloads containing the data
   shown (FR-038).

5. **Over-dispatch rule was stated as "remains correct"**, which asserts nothing
   testable. FR-023 now states the required behaviour directly: warn and require
   explicit confirmation.

### Validation iteration 2 — clarification resolved

**FR-011 (trial length) resolved by the user.** The repository grants trial length
from a deployment setting while the kit's prescribed copy states "14-day", and the
seed routine hardcodes 14 independently — so the copy could contradict the trial
actually granted, which Principle XI forbids. The user chose to **derive public
copy from the configured value**. FR-011 now requires that derivation, FR-011a
requires every other determiner of trial length (including seeding) to read the
same configured value, SC-004a makes the coupling verifiable, and the related edge
case was retargeted to what happens when the configured length changes after
organizations already exist.

All checklist items now pass. No markers remain.

### Deviations from template

- A **Context** section was added above the mandatory sections to record that this
  is a hardening feature over existing surfaces, and that several "minimum viable"
  items in the source kit already exist. Without it, the spec reads as greenfield
  construction and would be planned as such.
- An **Out of Scope** section was added to carry the kit's explicit exclusions.
- Requirement IDs are noted as scoped to feature 002, because feature 001 has an
  independent `FR-0nn` series that is referenced from source comments.
