import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /**
   * Full width on a phone, natural width from `sm` up.
   *
   * For a form's primary action. A dispatch is recorded one-handed at a gate,
   * and a small inline button is a small target for a thumb.
   */
  block?: boolean;
}

/**
 * `min-h-11` is 44px: the touch-target floor Constitution Principle XXII sets
 * for the dispatch path. It was 2.5rem (40px), and
 * tests/e2e/mobile-viewport.spec.ts now measures it.
 */
export default function Button({
  variant = "primary",
  block = false,
  className = "",
  ...props
}: Props) {
  const width = block ? "w-full sm:w-auto" : "";
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_STYLES[variant]} ${width} ${className}`}
      {...props}
    />
  );
}
