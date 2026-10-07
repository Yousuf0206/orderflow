import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
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
  const { data, isLoading } = useQuery({ queryKey: ["org"], queryFn: () => api.get<Org>("/org") });
  const [form, setForm] = useState<Org | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function update<K extends keyof Org>(key: K, value: Org[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await api.patch("/org", form);
      queryClient.invalidateQueries({ queryKey: ["org"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="max-w-xl space-y-4">
        <PageHeader title="Company Settings" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Company Settings" description="Update your organization's profile." />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          {saved && (
            <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Saved.
            </p>
          )}
          <FormField label="Company Name">
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Currency">
              <Input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
            </FormField>
            <FormField label="Timezone">
              <Input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} />
            </FormField>
          </div>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
