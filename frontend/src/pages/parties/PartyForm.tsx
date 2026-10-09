import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import AccessDenied from "../../components/ui/AccessDenied";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { PermissionsUnconfirmed } from "../../components/ui/RoleNotice";
import { usePermissions } from "../../hooks/usePermissions";
import { api, ApiError } from "../../services/apiClient";

interface FormState {
  party_code: string;
  party_name: string;
  city: string;
  contact_person: string;
  phone: string;
}

export default function PartyForm() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [form, setForm] = useState<FormState>({ party_code: "", party_name: "", city: "", contact_person: "", phone: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCodeError(null);
    setSaving(true);
    try {
      const party = await api.post<{ id: string }>("/parties", form);
      navigate(`/parties/${party.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setCodeError("That party code is already in use.");
        codeRef.current?.focus();
      } else {
        setFormError("Could not save party. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  // The link to this screen is already hidden from roles that cannot create a
  // party, but a URL can be typed or bookmarked -- and a form that submits
  // into a refusal is the defect being removed, not a lesser version of it.
  if (permissions.unknown) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="New Party" />
        <Card>
          <PermissionsUnconfirmed onRetry={permissions.retry} />
        </Card>
      </div>
    );
  }
  if (!permissions.canManageParties) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="New Party" />
        <AccessDenied description="Creating parties needs Manager access or above." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="New Party" description="Add the customer or supplier you'll track purchase orders against." />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {formError}
            </p>
          )}
          <FormField label="Party Code" required error={codeError ?? undefined}>
            <Input ref={codeRef} required value={form.party_code} onChange={(e) => update("party_code", e.target.value)} />
          </FormField>
          <FormField label="Party Name" required>
            <Input required value={form.party_name} onChange={(e) => update("party_name", e.target.value)} />
          </FormField>
          <FormField label="City">
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </FormField>
          <FormField label="Contact Person">
            <Input value={form.contact_person} onChange={(e) => update("contact_person", e.target.value)} />
          </FormField>
          <FormField label="Phone">
            <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </FormField>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save Party"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
