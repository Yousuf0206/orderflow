import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../services/apiClient";
import { isAuthenticated } from "../../services/auth";

interface Plan {
  tier: string;
  price: string;
  max_users: number;
  max_active_pos: number;
}

const UNLIMITED_THRESHOLD = 1_000_000;

function formatLimit(n: number): string {
  return n >= UNLIMITED_THRESHOLD ? "Unlimited" : String(n);
}

export default function Pricing() {
  const loggedIn = isAuthenticated();
  const ctaTo = loggedIn ? "/billing" : "/signup";
  const ctaLabel = loggedIn ? "Go to billing" : "Start trial";

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/plans"),
  });

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          OrderFlow
        </Link>
        <Link to={ctaTo}>
          <Button>{loggedIn ? "Go to billing" : "Start free trial"}</Button>
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-8 text-center text-2xl font-bold text-slate-900 sm:text-3xl">Simple, usage-based pricing</h1>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {isLoading || !plans
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)
            : plans.map((plan) => (
                <Card key={plan.tier} className="space-y-2 p-6 text-center">
                  <h2 className="text-xl font-semibold capitalize text-slate-900">{plan.tier}</h2>
                  <p className="text-2xl font-bold text-slate-900">{plan.price}</p>
                  <p className="text-sm text-slate-500">{formatLimit(plan.max_users)} users</p>
                  <p className="text-sm text-slate-500">{formatLimit(plan.max_active_pos)} active POs</p>
                  <Link to={ctaTo} className="block pt-2">
                    <Button className="w-full">{ctaLabel}</Button>
                  </Link>
                </Card>
              ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Every plan starts with a free 14-day trial — no credit card required.
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          By starting a trial, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-slate-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-slate-600">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
