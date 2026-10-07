import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input, Select } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { api, ApiError, describeApiError } from "../../services/apiClient";

interface Party {
  id: string;
  party_name: string;
}

interface FormState {
  party_id: string;
  po_number: string;
  material: string;
  ordered_qty: string;
  unit: string;
  order_date: string;
  due_date: string;
  notes: string;
}

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
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
    material: "",
    ordered_qty: "",
    unit: "",
    order_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [poNumberError, setPoNumberError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const poNumberRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setPoNumberError(null);
    setSaving(true);
    try {
      const po = await api.post<{ id: string }>("/purchase-orders", {
        ...form,
        ordered_qty: Number(form.ordered_qty),
      });
      navigate(`/purchase-orders/${po.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setPoNumberError("That PO number is already in use.");
        poNumberRef.current?.focus();
      } else {
        setFormError("Could not save purchase order. Please try again.");
      }
    } finally {
      setSaving(false);
    }
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

          <FormField label="Material" required>
            <Input required value={form.material} onChange={(e) => update("material", e.target.value)} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Ordered Qty" required>
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                required
                value={form.ordered_qty}
                onChange={(e) => update("ordered_qty", e.target.value)}
              />
            </FormField>
            <FormField label="Unit" required hint="e.g. kg, tons, pcs">
              <Input required value={form.unit} onChange={(e) => update("unit", e.target.value)} />
            </FormField>
          </div>

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
