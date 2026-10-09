import { useQuery } from "@tanstack/react-query";

import { getMe } from "../services/auth";

/**
 * What the signed-in user may do, in one place.
 *
 * The server decides independently on every request -- these flags only decide
 * what to render. Hiding is never the enforcement (Constitution Principle V);
 * it exists so a user is not offered an action that will be refused.
 *
 * The table below mirrors specs/004-trader-difference-kit/contracts/permissions.md
 * and the `require_role` calls in the backend. Role names were previously
 * compared inline wherever a decision was needed, which meant the next role
 * change would be found by whichever screen was forgotten.
 */
export type Role = "owner" | "manager" | "staff" | "viewer";

export interface Capabilities {
  canRecordDispatch: boolean;
  canEditDispatch: boolean;
  canManageOrders: boolean;
  canManageParties: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
}

const NONE: Capabilities = {
  canRecordDispatch: false,
  canEditDispatch: false,
  canManageOrders: false,
  canManageParties: false,
  canManageTeam: false,
  canManageBilling: false,
};

export function capabilitiesFor(role: string | null | undefined): Capabilities {
  switch (role) {
    case "owner":
      return {
        canRecordDispatch: true,
        canEditDispatch: true,
        canManageOrders: true,
        canManageParties: true,
        canManageTeam: true,
        canManageBilling: true,
      };
    case "manager":
      return {
        canRecordDispatch: true,
        canEditDispatch: true,
        canManageOrders: true,
        canManageParties: true,
        // Listing members is Owner or Manager, but inviting and role changes
        // are Owner only, so a Manager gets the Team nav item without the
        // write controls on it.
        canManageTeam: false,
        canManageBilling: false,
      };
    case "staff":
      // Staff may record a dispatch but not amend one. The backend draws the
      // same line (dispatches.py: create allows staff, edit/delete does not),
      // so a Staff user sees the form and no edit controls on history rows.
      return { ...NONE, canRecordDispatch: true };
    case "viewer":
      return NONE;
    default:
      return NONE;
  }
}

export interface PermissionsState extends Capabilities {
  role: string | null;
  /**
   * True while the role is genuinely unknown -- not yet loaded, or the request
   * for it failed.
   *
   * This is a third state, not a default. Collapsing it to "allowed" shows a
   * Viewer a form that will be refused; collapsing it to "denied" tells an
   * Owner they lack access they have. Screens render "we couldn't confirm your
   * permissions" with a retry instead of guessing.
   */
  unknown: boolean;
  /** True only while the first load is in flight -- a transient unknown. */
  isLoading: boolean;
  /** True when the role could not be fetched at all. */
  isError: boolean;
  retry: () => void;
  canManageTeamMembers: boolean;
}

export function usePermissions(): PermissionsState {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
  });

  const role = data?.role ?? null;
  // A Super Admin legitimately has no membership and so no role. That is a
  // known answer, not a failure to find out -- they work through /admin, and
  // telling them their permissions are unconfirmed would be false.
  const roleIsKnown = data !== undefined && (role !== null || data.is_super_admin);
  const unknown = isLoading || isError || !roleIsKnown;
  const caps = unknown ? NONE : capabilitiesFor(role);

  return {
    ...caps,
    role,
    unknown,
    isLoading,
    isError,
    retry: () => void refetch(),
    // Members list is visible to Manager as well as Owner; write actions on it
    // are Owner only (`canManageTeam`).
    canManageTeamMembers: !unknown && (role === "owner" || role === "manager"),
  };
}
