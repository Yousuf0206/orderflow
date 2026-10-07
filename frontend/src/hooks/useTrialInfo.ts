import { useQuery } from "@tanstack/react-query";

import { api } from "../services/apiClient";

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
export interface PublicPlan {
  tier: string;
  price: string;
  max_users: number;
  max_active_pos: number;
}

export interface PlansResponse {
  paid_plans_enabled: boolean;
  trial_length_days: number;
  plans: PublicPlan[];
}

/**
 * Public counterpart for anonymous visitors, who have no /billing to read.
 * Exists so the trial length stated on marketing pages comes from the same
 * setting signup grants, rather than being typed into the copy -- a number in
 * a string can't track a config change, and then the page promises a trial
 * length nobody gets.
 */
export function usePublicPlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<PlansResponse>("/plans"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrialInfo() {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingInfo>("/billing"),
    // No retry, matching the app-wide default (see main.tsx): retrying only
    // delays the moment the screen tells the user something, and a 403 here
    // is an answer -- not an owner -- that retrying would never change.
    retry: false,
  });
}
