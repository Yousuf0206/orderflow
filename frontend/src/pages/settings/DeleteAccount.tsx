import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api, describeApiError } from "../../services/apiClient";
import { logout } from "../../services/auth";

interface DeletionPreview {
  role_effect: "member" | "owner";
  organizations_deleted: { id: string; name: string; member_count: number }[];
  organizations_left: { id: string; name: string }[];
  purge_after_days: number;
}

/**
 * Delete my account (spec 007 FR-012). Required by the App Store for any app
 * that offers sign-up, and on the web too so the two stay at parity.
 *
 * An owner closing an organization types its name: this is the step that
 * locks every member out, so it is never one tap.
 */
export default function DeleteAccount() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["deletion-preview"],
    queryFn: () => api.get<DeletionPreview>("/auth/account/deletion-preview"),
  });
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onDelete(preview: DeletionPreview) {
    setDeleting(true);
    setSubmitError(null);
    try {
      await api.delete("/auth/account", {
        confirm_organization_names: preview.organizations_deleted.map((o) => typed[o.id] ?? ""),
      });
      logout();
      navigate("/login", { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setSubmitError(describeApiError(err, "We couldn't delete your account. Nothing was changed."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Delete account" description="Permanently remove your OrderFlow account." />
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        data={data}
        refetch={refetch}
        errorFallback="We couldn't work out what deleting your account would affect, so nothing can be deleted yet."
        loading={<Skeleton className="h-48" />}
      >
        {(preview) => {
          const namesMatch = preview.organizations_deleted.every(
            (o) => (typed[o.id] ?? "").trim() === o.name.trim(),
          );
          return (
            <Card>
              <div className="space-y-4 p-5 text-sm text-slate-700 dark:text-slate-200">
                {submitError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    {submitError}
                  </p>
                )}

                <p>
                  You will be signed out straight away and won't be able to sign in again. Your data is kept for{" "}
                  <strong>{preview.purge_after_days} days</strong> in case this was a mistake, then permanently
                  deleted.
                </p>

                {preview.organizations_left.length > 0 && (
                  <p data-testid="orgs-left">
                    You'll be removed from{" "}
                    <strong>{preview.organizations_left.map((o) => o.name).join(", ")}</strong>. Its orders and
                    records stay with the rest of the team.
                  </p>
                )}

                {preview.organizations_deleted.length > 0 && (
                  <div
                    className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10"
                    data-testid="orgs-deleted"
                  >
                    <p className="font-medium text-red-800 dark:text-red-300">
                      You are the only owner, so these organizations will be deleted for everyone:
                    </p>
                    {preview.organizations_deleted.map((o) => (
                      <FormField
                        key={o.id}
                        label={`Type "${o.name}" to confirm — ${o.member_count} member${o.member_count === 1 ? "" : "s"} will lose access`}
                      >
                        <Input
                          value={typed[o.id] ?? ""}
                          onChange={(e) => setTyped((prev) => ({ ...prev, [o.id]: e.target.value }))}
                          autoComplete="off"
                        />
                      </FormField>
                    ))}
                  </div>
                )}

                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  I understand this can't be undone after {preview.purge_after_days} days.
                </label>

                <Button
                  variant="danger"
                  block
                  disabled={!acknowledged || !namesMatch || deleting}
                  onClick={() => onDelete(preview)}
                >
                  {deleting ? "Deleting..." : "Delete my account"}
                </Button>
              </div>
            </Card>
          );
        }}
      </QueryState>
    </div>
  );
}
