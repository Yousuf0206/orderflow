import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input } from "../../components/ui/Field";
import { usePageMeta } from "../../hooks/usePageMeta";
import { ApiError, describeApiError, getValidationErrors } from "../../services/apiClient";
import { signup } from "../../services/auth";

export default function Signup() {
  usePageMeta("Start your free trial", "Create your OrderFlow account. No credit card required.");
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEmailError(null);
    setPasswordError(null);
    setLoading(true);
    try {
      await signup(email, password, organizationName);
      navigate("/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEmailError("This email is already registered. Try logging in instead.");
        emailRef.current?.focus();
      } else if (err instanceof ApiError && err.status === 422) {
        const fields = getValidationErrors(err);
        setEmailError(fields.email ?? null);
        setPasswordError(fields.password ?? null);
        if (!fields.email && !fields.password) {
          setFormError(describeApiError(err, "Could not create account. Please try again."));
        }
      } else {
        setFormError(describeApiError(err, "Could not create account. Please try again."));
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
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Start your free trial</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">No credit card required.</p>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {formError}
            </p>
          )}

          <FormField label="Company name" required>
            <Input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </FormField>

          <FormField label="Email" required error={emailError ?? undefined}>
            <Input
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Password" required hint="At least 8 characters" error={passwordError ?? undefined}>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

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
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Log in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
