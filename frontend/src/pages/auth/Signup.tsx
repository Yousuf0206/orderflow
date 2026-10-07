import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { usePageMeta } from "../../hooks/usePageMeta";
import { ApiError, describeApiError } from "../../services/apiClient";
import { signup } from "../../services/auth";

export default function Signup() {
  usePageMeta("Start your free trial", "Create your OrderFlow account. No credit card required.");
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, organizationName);
      navigate("/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with that email already exists. Try logging in instead.");
      } else {
        setError(describeApiError(err, "Could not create account. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">O</div>
          <span className="font-semibold tracking-tight text-slate-900 dark:text-white">OrderFlow</span>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Start your free trial</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">No credit card required.</p>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
        )}
        <div>
          <label htmlFor="org" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Company name</label>
          <input
            id="org"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account..." : "Start free trial"}
        </Button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            Privacy Policy
          </Link>
          .
        </p>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Log in</Link>
        </p>
      </form>
    </div>
  );
}
