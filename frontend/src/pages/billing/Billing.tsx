import { useQuery } from "@tanstack/react-query";

import { api } from "../../services/apiClient";

interface BillingInfo {
  plan_tier: string;
  trial_ends_at: string | null;
  is_read_only_locked: boolean;
  max_users: number;
  max_active_pos: number;
}

const PLANS = ["starter", "business", "pro"];

export default function Billing() {
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => api.get<BillingInfo>("/billing") });

  async function upgrade(plan: string) {
    try {
      const resp = await api.post<{ checkout_url: string }>("/billing/checkout-session", { plan_tier: plan });
      window.location.href = resp.checkout_url;
    } catch {
      alert("Stripe is not configured on this deployment yet. Set STRIPE_SECRET_KEY and price IDs on the backend.");
    }
  }

  async function openPortal() {
    try {
      const resp = await api.post<{ portal_url: string }>("/billing/portal-session");
      window.location.href = resp.portal_url;
    } catch {
      alert("No billing account on file yet — upgrade to a paid plan first.");
    }
  }

  if (isLoading || !data) return <p>Loading...</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {data.is_read_only_locked && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm p-3 rounded">
          Your trial has ended. The organization is in read-only mode — upgrade to resume creating and editing records.
        </div>
      )}
      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <p>Current plan: <span className="font-medium capitalize">{data.plan_tier}</span></p>
        {data.trial_ends_at && <p className="text-sm text-slate-500">Trial ends: {new Date(data.trial_ends_at).toLocaleDateString()}</p>}
        <p className="text-sm text-slate-500">Limits: {data.max_users} users, {data.max_active_pos} active POs</p>
        <button onClick={openPortal} className="border rounded px-3 py-2 text-sm">Manage billing</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div key={plan} className="bg-white rounded-lg shadow p-4 space-y-2">
            <h2 className="font-medium capitalize">{plan}</h2>
            <button onClick={() => upgrade(plan)} className="w-full bg-slate-900 text-white rounded py-2 text-sm">
              Choose {plan}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
