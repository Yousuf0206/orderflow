import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import { usePageMeta } from "../../hooks/usePageMeta";
import { ApiError, describeApiError, getValidationErrors } from "../../services/apiClient";
import { login } from "../../services/auth";
import { getSafeNextPath } from "../../utils/safeNext";

export default function Login() {
  usePageMeta("Log in");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEmailError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(getSafeNextPath(searchParams.get("next"), "/dashboard"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("Invalid email or password.");
      } else if (err instanceof ApiError && err.status === 422) {
        const fields = getValidationErrors(err);
        setEmailError(fields.email ?? null);
        if (!fields.email) {
          setFormError(describeApiError(err, "Could not log in. Please try again."));
        } else {
          emailRef.current?.focus();
        }
      } else {
        setFormError(describeApiError(err, "Could not log in. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-5 p-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              O
            </div>
            <span className="font-semibold tracking-tight text-slate-900 dark:text-white">OrderFlow</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage your purchase orders.</p>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {formError}
            </p>
          )}

          <FormField label="Email" required error={emailError ?? undefined}>
            <Input
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Password" required>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Log in"}
          </Button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No account?{" "}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Sign up
            </Link>
          </p>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-slate-400 hover:underline dark:text-slate-500">
              Forgot password?
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
