import { Lock, ShieldAlert } from "lucide-react";

/**
 * Explains why a region is not actionable for this user.
 *
 * Shown in place of a control the user's role forbids, rather than leaving the
 * space blank. An empty space where a dispatch form belongs reads as a broken
 * page; a sentence naming the role required reads as a working product with a
 * correct permission boundary (Constitution Principle XXIII).
 */
export function RoleRequired({ action, role }: { action: string; role: string }) {
  return (
    <div className="flex items-start gap-3 p-5 text-sm text-slate-600 dark:text-slate-300">
      <Lock size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <p>
        {action} needs <span className="font-medium text-slate-900 dark:text-white">{role}</span>{" "}
        access or above. Ask an organization owner if you need it.
      </p>
    </div>
  );
}

/**
 * Shown when the signed-in user's role could not be determined.
 *
 * Deliberately neither "you may" nor "you may not": guessing permissive shows
 * a Viewer a form that will be refused, and guessing restrictive tells an Owner
 * they lack access they have.
 */
export function PermissionsUnconfirmed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 p-5 text-sm text-amber-800 dark:text-amber-300"
    >
      <ShieldAlert size={18} className="shrink-0" aria-hidden="true" />
      <span>We couldn't confirm your permissions, so this section is unavailable.</span>
      <button type="button" onClick={onRetry} className="min-h-11 font-medium underline">
        Try again
      </button>
    </div>
  );
}
