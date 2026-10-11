import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AccessDenied from "../../components/ui/AccessDenied";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input, Select } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { PermissionsUnconfirmed } from "../../components/ui/RoleNotice";
import { usePermissions } from "../../hooks/usePermissions";
import { api, ApiError, describeApiError } from "../../services/apiClient";

interface Party {
  id: string;
  party_name: string;
}

interface FormState {
  party_id: string;
  po_number: string;
  order_date: string;
  due_date: string;
  notes: string;
}

interface LineDraft {
  // Client-side key only; the server assigns line ids and line numbers.
  key: number;
  material: string;
  ordered_qty: string;
  unit: string;
}

type LineField = "material" | "ordered_qty" | "unit";

let nextLineKey = 1;
function blankLine(): LineDraft {
  return { key: nextLineKey++, material: "", ordered_qty: "", unit: "" };
}

/** Per-line 422 messages keyed `${index}.${field}`, from loc ["body", "lines", i, field]. */
function lineErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422) return {};
  const detail = (err.body as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail)) return {};
  const out: Record<string, string> = {};
  for (const item of detail as { msg?: string; loc?: unknown[] }[]) {
    const loc = item.loc ?? [];
    if (loc[1] === "lines" && typeof loc[2] === "number" && typeof loc[3] === "string" && item.msg) {
      out[`${loc[2]}.${loc[3]}`] = item.msg;
    }
  }
  return out;
}

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const {
    data: parties,
    isLoading: partiesLoading,
    isError: partiesFailed,
    error: partiesError,
    refetch: refetchParties,
  } = useQuery({ queryKey: ["parties", ""], queryFn: () => api.get<Party[]>("/parties") });
  const [form, setForm] = useState<FormState>({
    party_id: "",
    po_number: "",
    order_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [poNumberError, setPoNumberError] = useState<string | null>(null);
  const [errorsByLine, setErrorsByLine] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const poNumberRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(key: number, field: LineField, value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function removeLine(key: number) {
    // A purchase order always has at least one line (Principle XXVIII); the
    // button is disabled at one line, and this guard backs it up.
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
    setErrorsByLine({});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setPoNumberError(null);
    setErrorsByLine({});
    setSaving(true);
    try {
      const po = await api.post<{ id: string }>("/purchase-orders", {
        ...form,
        notes: form.notes || null,
        lines: lines.map((l) => ({
          material: l.material,
          ordered_qty: Number(l.ordered_qty),
          unit: l.unit,
        })),
      });
      navigate(`/purchase-orders/${po.id}`);
    } catch (err) {
      // Only a 409 is a duplicate PO number. This used to treat *every*
      // ApiError as one, so hitting the plan limit told the user their PO
      // number was taken -- a wrong reason they could never resolve.
      const perLine = lineErrors(err);
      if (err instanceof ApiError && err.status === 409) {
        setPoNumberError("That PO number is already in use.");
        poNumberRef.current?.focus();
      } else if (Object.keys(perLine).length > 0) {
        setErrorsByLine(perLine);
        setFormError("Some items need fixing — see the highlighted fields below.");
      } else {
        setFormError(describeApiError(err, "Could not save purchase order. Please try again."));
      }
    } finally {
      setSaving(false);
    }
  }

  // Reachable by typed URL even though the link is hidden. A form that
  // submits into a refusal is the defect, not a milder form of it.
  if (permissions.unknown) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="New Purchase Order" />
        <Card>
          <PermissionsUnconfirmed onRetry={permissions.retry} />
        </Card>
      </div>
    );
  }
  if (!permissions.canManageOrders) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="New Purchase Order" />
        <AccessDenied description="Creating purchase orders needs Manager access or above." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        title="New Purchase Order"
        description="Create a purchase order to start tracking dispatches and remaining balance."
      />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {formError}
            </p>
          )}

          {/* An empty dropdown has two very different causes, and silently
              showing one for the other is how a user concludes their parties
              vanished. Say which it is. */}
          {partiesFailed && (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {describeApiError(partiesError, "We couldn't load your parties, so the list below is empty.")}
              <button type="button" onClick={() => refetchParties()} className="font-medium underline">
                Try again
              </button>
            </p>
          )}

          {!partiesFailed && !partiesLoading && (parties ?? []).length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              You don't have any parties yet.{" "}
              <Link to="/parties/new" className="font-medium underline">
                Create one first
              </Link>{" "}
              — a purchase order is always raised against a party.
            </p>
          )}

          <FormField label="Party" required>
            <Select
              required
              value={form.party_id}
              onChange={(e) => update("party_id", e.target.value)}
              disabled={partiesLoading || partiesFailed}
            >
              <option value="">{partiesLoading ? "Loading parties..." : "Select a party..."}</option>
              {(parties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.party_name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="PO Number" required error={poNumberError ?? undefined}>
            <Input
              ref={poNumberRef}
              required
              value={form.po_number}
              onChange={(e) => update("po_number", e.target.value)}
            />
          </FormField>

          {/* One block per material on the paper PO. Each block stacks on a
              phone, so a long order never needs sideways scrolling. */}
          <fieldset className="space-y-3" data-testid="po-line-editor">
            <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Items</legend>
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                data-testid="po-line"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Item {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    aria-label={`Remove item ${index + 1}`}
                    title={lines.length === 1 ? "A purchase order needs at least one item" : undefined}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:hover:bg-red-500/10 dark:disabled:text-slate-600"
                  >
                    Remove
                  </button>
                </div>
                <FormField label="Material" required error={errorsByLine[`${index}.material`]}>
                  <Input
                    required
                    value={line.material}
                    onChange={(e) => updateLine(line.key, "material", e.target.value)}
                  />
                </FormField>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Ordered Qty" required error={errorsByLine[`${index}.ordered_qty`]}>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      required
                      value={line.ordered_qty}
                      onChange={(e) => updateLine(line.key, "ordered_qty", e.target.value)}
                    />
                  </FormField>
                  <FormField
                    label="Unit"
                    required
                    hint="e.g. kg, tons, pcs"
                    error={errorsByLine[`${index}.unit`]}
                  >
                    <Input
                      required
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, "unit", e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines((prev) => [...prev, blankLine()])}
              className="w-full sm:w-auto"
            >
              Add line
            </Button>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Order Date" required>
              <Input
                type="date"
                required
                value={form.order_date}
                onChange={(e) => update("order_date", e.target.value)}
              />
            </FormField>
            <FormField label="Due Date" required>
              <Input
                type="date"
                required
                min={form.order_date}
                value={form.due_date}
                onChange={(e) => update("due_date", e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </FormField>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Create Purchase Order"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
