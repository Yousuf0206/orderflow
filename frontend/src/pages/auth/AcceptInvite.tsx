import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../../services/apiClient";
import { setTokens, type TokenPair } from "../../services/apiClient";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const tokens = await api.post<TokenPair>("/auth/invite/accept", { token, password });
      setTokens(tokens);
      navigate("/dashboard");
    } catch {
      setError("This invite link is invalid or has expired.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-lg shadow space-y-4">
        <h1 className="text-xl font-semibold">Join your team on OrderFlow</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm mb-1">Set a password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button className="w-full bg-slate-900 text-white rounded py-2">Accept invite</button>
      </form>
    </div>
  );
}
