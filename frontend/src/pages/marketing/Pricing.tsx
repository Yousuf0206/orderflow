import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageMeta } from "../../hooks/usePageMeta";
import { usePublicPlans } from "../../hooks/useTrialInfo";
import { isAuthenticated } from "../../services/auth";

const UNLIMITED_THRESHOLD = 1_000_000;

/** `PLAN_LIMITS` encodes "unlimited" as a sentinel rather than null. */
function formatLimit(n: number): string {
  return n >= UNLIMITED_THRESHOLD ? "Unlimited" : String(n);
}

const TRIAL_INCLUDES = [
  "Unlimited parties and purchase orders during the trial",
  "Partial dispatches with live remaining balances",
  "Reports and CSV, Excel, and PDF exports",
  "Your whole team, with roles and an audit trail",
];

export default function Pricing() {
  const loggedIn = isAuthenticated();
  const ctaTo = loggedIn ? "/billing" : "/signup";

  const { data } = usePublicPlans();

  // Rendered before the request resolves and if it fails, so the page always
  // says something true. The exact number is the only part that waits.
  const trialDays = data?.trial_length_days;
  const trialLength = trialDays ? `${trialDays}-day` : "free";

  usePageMeta(
    "Pricing",
    `OrderFlow is in free trial. Start a ${trialLength} trial with no credit card required — paid plans are coming soon.`,
  );

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

      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Free while we&rsquo;re in beta
        </h1>

        <Card className="mt-8 p-6 text-center sm:p-8">
          <p className="text-lg font-semibold text-slate-900">
            {trialDays ? `${trialDays}-day free trial` : "Free trial"}
            <span className="text-slate-400"> · </span>
            No credit card
            <span className="text-slate-400"> · </span>
            Paid plans coming soon
          </p>
          <p className="mt-3 text-sm text-slate-500">
            We&rsquo;re onboarding trading and material-dealer businesses one at a time while the
            product settles. There&rsquo;s nothing to buy yet, and nothing to cancel.
          </p>

          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
            {TRIAL_INCLUDES.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-600">
                <Check size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link to={ctaTo} className="mt-7 inline-block">
            <Button className="px-6 py-3 text-base">
              {loggedIn ? "Go to billing" : "Start your free trial"}
            </Button>
          </Link>
        </Card>

        {/* Only reachable once checkout has been verified end-to-end and paid
            plans are deliberately switched on. Until then the server sends no
            tiers at all, so there is nothing here to render and no way to
            start a purchase that would be refused. */}
        {data?.paid_plans_enabled && data.plans.length > 0 && (
          <div className="mt-10">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              Paid plans
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {data.plans.map((plan) => (
                <Card key={plan.tier} className="space-y-1 p-5 text-center">
                  <h3 className="font-semibold capitalize text-slate-900">{plan.tier}</h3>
                  <p className="text-xl font-bold text-slate-900">{plan.price}</p>
                  <p className="text-sm text-slate-500">{formatLimit(plan.max_users)} users</p>
                  <p className="text-sm text-slate-500">
                    {formatLimit(plan.max_active_pos)} active POs
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
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
