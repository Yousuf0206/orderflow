import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
  /**
   * Makes the whole card a link, for a figure that stands for a set of rows.
   *
   * Callers pass it only when there is something to see: a zero count must not
   * be a link, or pressing it opens an empty list that reads as an error.
   */
  to?: string;
}

const TONE_STYLES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  danger: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  to,
}: StatCardProps) {
  const body = (
    <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p
            data-stat-value
            className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[tone]}`}>
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </div>
    </div>
  );

  // data-stat gives tests a stable hook for "the Remaining figure" rather
  // than searching the page for the text "70" -- which also matches the
  // signed-in user's email in the app shell, and silently passes against the
  // wrong element.
  const shell =
    "block rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900";

  if (to) {
    return (
      <Link
        to={to}
        data-stat={label}
        className={`${shell} transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div data-stat={label} className={shell}>
      {body}
    </div>
  );
}
