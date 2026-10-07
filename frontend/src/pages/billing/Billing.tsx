import { useState } from "react";
import { Link } from "react-router-dom";

import AccessDenied from "../../components/ui/AccessDenied";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useTrialInfo, type BillingInfo } from "../../hooks/useTrialInfo";
import { api, ApiError, describeApiError } from "../../services/apiClient";

export default function Billing() {
  const { data, isLoading, isError, error, refetch } = useTrialInfo();

  // A 403 is an answer, not a failure: this viewer isn't an owner. Checked
  // before the generic error state so they get the real reason.
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Billing" />
        <AccessDenied description="Only organization owners can view billing." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Billing" description="Your plan and usage." />
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        data={data}
        refetch={refetch}
        errorFallback="We couldn't load your billing details. Your account is unaffected — this is a display problem."
        loading={
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-20" />
          </div>
        }
      >
        {(info) => <BillingDetails info={info} />}
      </QueryState>

      {/* Kept outside QueryState: these were previously attached to an
          "Upgrading is subject to..." note, and removing the upgrade path
          would have quietly taken the legal links off this page with it. */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Your use of OrderFlow is subject to our{" "}
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

/**
 * Only rendered when the server says a billing account exists and paid plans
 * are open. Unreachable during the trial-only beta, but kept honest rather
 * than stubbed, so enabling the flag doesn't surface a dead control.
 */
function ManageBillingButton() {
  const [failed, setFailed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function openPortal() {
    setFailed(null);
    setOpening(true);
    try {
      const resp = await api.post<{ portal_url: string }>("/billing/portal-session");
      window.location.href = resp.portal_url;
    } catch (err) {
      setFailed(describeApiError(err, "We couldn't open billing management just now."));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-2 pt-1">
      <Button variant="secondary" onClick={openPortal} disabled={opening}>
        {opening ? "Opening…" : "Manage billing"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {failed}
        </p>
      )}
    </div>
  );
}

function BillingDetails({ info }: { info: BillingInfo }) {
  const onTrial = info.plan_tier === "trial";

  return (
    <>
      {info.is_read_only_locked && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {/* Deliberately does not say "upgrade to resume": while paid plans
              are closed that is an instruction nobody can act on, and it
              would be the main thing an expired-trial user is told. */}
          <p className="font-medium">Your trial has ended.</p>
          <p className="mt-1">
            Your records are all still here and you can keep viewing and exporting them. Creating
            and editing is paused. Get in touch and we&rsquo;ll extend your trial — paid plans
            aren&rsquo;t open yet.
          </p>
        </div>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-700 dark:text-slate-200">Current plan</span>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-medium capitalize text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {info.plan_tier}
          </span>
          {onTrial && !info.paid_plans_enabled && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Paid plans coming soon
            </span>
          )}
        </div>

        {info.trial_ends_at && !info.is_read_only_locked && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Trial ends {new Date(info.trial_ends_at).toLocaleDateString()}
          </p>
        )}

        {/* Both figures come from the server for this organization, so what is
            shown here is what creates are actually refused at. */}
        <dl className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Users</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-white">
              {info.current_users} of {info.max_users}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Active POs</dt>
            <dd className="text-sm font-medium text-slate-900 dark:text-white">
              {info.current_active_pos} of {info.max_active_pos}
            </dd>
          </div>
        </dl>

        {/* Offered only when it could actually succeed. A trial organization
            has no payment account, so for the whole beta audience this is
            absent rather than present-and-failing. */}
        {info.paid_plans_enabled && info.has_billing_account && <ManageBillingButton />}
      </Card>

      {!info.paid_plans_enabled && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          OrderFlow is in free trial while we get the core workflow right. There&rsquo;s nothing to
          buy yet — we&rsquo;ll tell you well before that changes.
        </p>
      )}
    </>
  );
}
