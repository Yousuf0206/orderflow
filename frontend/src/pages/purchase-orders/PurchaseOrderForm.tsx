import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../services/apiClient";

interface Party {
  id: string;
  party_name: string;
}

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { data: parties } = useQuery({ queryKey: ["parties", ""], queryFn: () => api.get<Party[]>("/parties") });
  const [form, setForm] = useState({
    party_id: "",
    po_number: "",
    material: "",
    ordered_qty: "",
    unit: "",
    order_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const po = await api.post<{ id: string }>("/purchase-orders", {
        ...form,
        ordered_qty: Number(form.ordered_qty),
      });
      navigate(`/purchase-orders/${po.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? "That PO number is already in use." : "Could not save purchase order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">New Purchase Order</h1>
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm mb-1">Party</label>
          <select
            required
            value={form.party_id}
            onChange={(e) => setForm({ ...form, party_id: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a party...</option>
            {(parties ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.party_name}</option>
            ))}
          </select>
        </div>
        <Field label="PO Number" value={form.po_number} onChange={(v) => setForm({ ...form, po_number: v })} required />
        <Field label="Material" value={form.material} onChange={(v) => setForm({ ...form, material: v })} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ordered Qty" type="number" value={form.ordered_qty} onChange={(v) => setForm({ ...form, ordered_qty: v })} required />
          <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Order Date" type="date" value={form.order_date} onChange={(v) => setForm({ ...form, order_date: v })} required />
          <Field label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} required />
        </div>
        <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <button disabled={saving} className="bg-slate-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {saving ? "Saving..." : "Create Purchase Order"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
    </div>
  );
}
