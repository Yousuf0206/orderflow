import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import { api } from "../../services/apiClient";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/auth/password-reset/request", { email });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Reset your password</h1>
          {sent ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">If that email exists, a reset link has been sent.</p>
          ) : (
            <>
              <FormField label="Email" required>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </FormField>
              <Button type="submit" disabled={sending} className="w-full">
                {sending ? "Sending..." : "Send reset link"}
              </Button>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/password-reset/confirm", { token, new_password: password });
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Set a new password</h1>
          {done ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Password updated. You can now log in.</p>
          ) : (
            <>
              <FormField label="New password" required hint="At least 8 characters">
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Updating..." : "Update password"}
              </Button>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
