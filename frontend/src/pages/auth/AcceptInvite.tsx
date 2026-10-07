import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import { api } from "../../services/apiClient";
import { setTokens, type TokenPair } from "../../services/apiClient";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const tokens = await api.post<TokenPair>("/auth/invite/accept", { token, password });
      setTokens(tokens);
      navigate("/dashboard");
    } catch {
      setError("This invite link is invalid or has expired.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Join your team on OrderFlow</h1>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}
          <FormField label="Set a password" required hint="At least 8 characters">
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Joining..." : "Accept invite"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
