import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../../services/apiClient";

interface PurchaseOrder {
  id: string;
  po_number: string;
  material: string;
  ordered_qty: number;
  unit: string;
  due_date: string;
  total_dispatched: number;
  remaining_balance: number;
  status: string;
}

interface Dispatch {
  id: string;
  dispatch_date: string;
  qty: number;
  vehicle_ref: string | null;
  remarks: string | null;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ dispatch_date: new Date().toISOString().slice(0, 10), qty: "", vehicle_ref: "", remarks: "" });
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: po } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
  const { data: dispatches } = useQuery({
    queryKey: ["dispatches", id],
    queryFn: () => api.get<Dispatch[]>(`/purchase-orders/${id}/dispatches`),
    enabled: !!id,
  });

  async function submitDispatch(confirm: boolean) {
    setSaving(true);
    try {
      const result = await api.post<{ dispatch: Dispatch | null; warning: string | null }>(
        `/purchase-orders/${id}/dispatches`,
        { ...form, qty: Number(form.qty), confirm },
      );
      if (result.warning && !result.dispatch) {
        setWarning(result.warning);
        return;
      }
      setWarning(null);
      setForm({ dispatch_date: new Date().toISOString().slice(0, 10), qty: "", vehicle_ref: "", remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["dispatches", id] });
    } finally {
      setSaving(false);
    }
  }

  if (!po) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{po.po_number}</h1>
        <p className="text-slate-500 text-sm">{po.material} · {po.unit} · Due {po.due_date}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Ordered" value={po.ordered_qty} />
        <Stat label="Dispatched" value={po.total_dispatched} />
        <Stat label="Remaining" value={po.remaining_balance} />
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="font-medium">Record a Dispatch</h2>
        {warning && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm p-3 rounded space-y-2">
            <p>{warning}</p>
            <button
              onClick={() => submitDispatch(true)}
              className="bg-amber-600 text-white rounded px-3 py-1.5 text-sm"
            >
              Confirm anyway
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDispatch(false);
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-sm mb-1">Dispatch Date</label>
            <input
              type="date"
              required
              value={form.dispatch_date}
              onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Qty</label>
            <input
              type="number"
              required
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Vehicle / Ref</label>
            <input
              value={form.vehicle_ref}
              onChange={(e) => setForm({ ...form, vehicle_ref: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Remarks</label>
            <input
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button disabled={saving} className="col-span-2 bg-slate-900 text-white rounded py-2 text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Add Dispatch"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h2 className="px-4 py-3 font-medium border-b">Dispatch History</h2>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left border-b text-slate-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Vehicle/Ref</th>
              <th className="px-4 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(dispatches ?? []).map((d) => (
              <tr key={d.id} className="border-b last:border-b-0">
                <td className="px-4 py-2">{d.dispatch_date}</td>
                <td className="px-4 py-2">{d.qty}</td>
                <td className="px-4 py-2">{d.vehicle_ref ?? "-"}</td>
                <td className="px-4 py-2">{d.remarks ?? "-"}</td>
              </tr>
            ))}
            {(dispatches ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>No dispatches recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
