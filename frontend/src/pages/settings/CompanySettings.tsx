import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "../../services/apiClient";

interface Org {
  name: string;
  logo_url: string | null;
  currency: string;
  timezone: string;
  plan_tier: string;
}

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["org"], queryFn: () => api.get<Org>("/org") });
  const [form, setForm] = useState<Org | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    await api.patch("/org", form);
    queryClient.invalidateQueries({ queryKey: ["org"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!form) return <p>Loading...</p>;

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Company Settings</h1>
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
        <div>
          <label className="block text-sm mb-1">Company Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Currency</label>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Timezone</label>
            <input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <button className="bg-slate-900 text-white rounded px-4 py-2 text-sm">Save</button>
      </form>
    </div>
  );
}
