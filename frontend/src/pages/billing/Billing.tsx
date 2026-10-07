import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
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
  const [notice, setNotice] = useState<string | null>(null);

  async function upgrade(plan: string) {
    setNotice(null);
    try {
      const resp = await api.post<{ checkout_url: string }>("/billing/checkout-session", { plan_tier: plan });
      window.location.href = resp.checkout_url;
    } catch {
      setNotice("Stripe is not configured on this deployment yet. Set STRIPE_SECRET_KEY and price IDs on the backend.");
    }
  }

  async function openPortal() {
    setNotice(null);
    try {
      const resp = await api.post<{ portal_url: string }>("/billing/portal-session");
      window.location.href = resp.portal_url;
    } catch {
      setNotice("No billing account on file yet — upgrade to a paid plan first.");
    }
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Billing" />
        <Skeleton className="h-28" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Billing" description="Manage your plan and payment details." />

      {notice && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {notice}
        </p>
      )}

      {data.is_read_only_locked && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          Your trial has ended. The organization is in read-only mode — upgrade to resume creating and editing records.
        </div>
      )}

      <Card className="space-y-2 p-5">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Current plan: <span className="font-medium capitalize text-slate-900 dark:text-white">{data.plan_tier}</span>
        </p>
        {data.trial_ends_at && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Trial ends: {new Date(data.trial_ends_at).toLocaleDateString()}
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Limits: {data.max_users} users, {data.max_active_pos} active POs
        </p>
        <Button variant="secondary" onClick={openPortal}>
          Manage billing
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan} className="space-y-3 p-5 text-center">
            <h2 className="font-medium capitalize text-slate-900 dark:text-white">{plan}</h2>
            <Button onClick={() => upgrade(plan)} className="w-full">
              Choose {plan}
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Upgrading is subject to our{" "}
        <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
