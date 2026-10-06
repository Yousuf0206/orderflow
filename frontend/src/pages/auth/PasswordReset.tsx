import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../services/apiClient";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/auth/password-reset/request", { email });
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-lg shadow space-y-4">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {sent ? (
          <p className="text-sm text-slate-600">If that email exists, a reset link has been sent.</p>
        ) : (
          <>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="you@company.com"
            />
            <button className="w-full bg-slate-900 text-white rounded py-2">Send reset link</button>
          </>
        )}
      </form>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/auth/password-reset/confirm", { token, new_password: password });
    setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-lg shadow space-y-4">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        {done ? (
          <p className="text-sm text-slate-600">Password updated. You can now log in.</p>
        ) : (
          <>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <button className="w-full bg-slate-900 text-white rounded py-2">Update password</button>
          </>
        )}
      </form>
    </div>
  );
}
