import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../services/apiClient";

export default function PartyForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ party_code: "", party_name: "", city: "", contact_person: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const party = await api.post<{ id: string }>("/parties", form);
      navigate(`/parties/${party.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? "That party code is already in use." : "Could not save party.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">New Party</h1>
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Field label="Party Code" value={form.party_code} onChange={(v) => setForm({ ...form, party_code: v })} required />
        <Field label="Party Name" value={form.party_name} onChange={(v) => setForm({ ...form, party_name: v })} required />
        <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <Field label="Contact Person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <button disabled={saving} className="bg-slate-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {saving ? "Saving..." : "Save Party"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
    </div>
  );
}
