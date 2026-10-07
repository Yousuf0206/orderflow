import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../services/apiClient";

export interface BillingInfo {
  plan_tier: string;
  trial_ends_at: string | null;
  is_read_only_locked: boolean;
  max_users: number;
  max_active_pos: number;
  current_users: number;
  current_active_pos: number;
  trial_length_days: number;
  paid_plans_enabled: boolean;
  has_billing_account: boolean;
}

/**
 * The single read of plan, trial window, limits, and usage for signed-in
 * screens. Every limit a user sees has to be the limit the server enforces for
 * their organization, which only holds if one place fetches it -- a second
 * screen computing its own figures is how "5 users" ends up on screen while 3
 * is enforced.
 *
 * Owner-only on the server (403 otherwise), so callers that may render for
 * non-owners should handle that status rather than assume data.
 */
export function useTrialInfo() {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingInfo>("/billing"),
    // A 403 here is an answer, not a failure: this viewer isn't an owner.
    // Retrying it would delay the access-denied state for no benefit.
    retry: (failureCount, err) => !(err instanceof ApiError && err.status === 403) && failureCount < 1,
  });
}
