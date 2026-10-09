import { describe, expect, it } from "vitest";

import { capabilitiesFor } from "../../src/hooks/usePermissions";

/**
 * The role-to-action table, asserted in one place.
 *
 * It mirrors specs/004-trader-difference-kit/contracts/permissions.md and the
 * `require_role` calls in the backend. If the two ever disagree the server
 * wins -- these flags only decide what to render -- but a disagreement means a
 * user is being shown a control that will be refused, which is the defect this
 * work removes.
 */
describe("capabilitiesFor", () => {
  it("gives an owner everything", () => {
    expect(capabilitiesFor("owner")).toEqual({
      canRecordDispatch: true,
      canEditDispatch: true,
      canManageOrders: true,
      canManageParties: true,
      canManageTeam: true,
      canManageBilling: true,
    });
  });

  it("gives a manager records and orders, but not team or billing", () => {
    expect(capabilitiesFor("manager")).toEqual({
      canRecordDispatch: true,
      canEditDispatch: true,
      canManageOrders: true,
      canManageParties: true,
      canManageTeam: false,
      canManageBilling: false,
    });
  });

  it("lets staff record a dispatch but not amend one", () => {
    const staff = capabilitiesFor("staff");
    expect(staff.canRecordDispatch).toBe(true);
    // The backend draws the same line: dispatches.py allows staff to create,
    // but edit and delete are owner/manager only.
    expect(staff.canEditDispatch).toBe(false);
    expect(staff.canManageOrders).toBe(false);
    expect(staff.canManageParties).toBe(false);
  });

  it("gives a viewer nothing beyond reading", () => {
    expect(Object.values(capabilitiesFor("viewer")).every((v) => v === false)).toBe(true);
  });

  it("treats an unknown or missing role as no capabilities, never as permissive", () => {
    for (const role of [null, undefined, "", "superuser", "admin"]) {
      const caps = capabilitiesFor(role as string | null | undefined);
      expect(Object.values(caps).every((v) => v === false)).toBe(true);
    }
  });

  it("never grants a capability the viewer role lacks to an unrecognised role", () => {
    // Guards against a future role string being added to the backend and
    // accidentally defaulting to the permissive branch here.
    expect(capabilitiesFor("accountant")).toEqual(capabilitiesFor("viewer"));
  });
});
