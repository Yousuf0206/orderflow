import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { CtaContent } from "../../content/landingTypes";

/**
 * The closing invitation. Same action as the hero, never a second one.
 *
 * The button is styled locally rather than with `Button`'s secondary variant:
 * that variant carries dark-mode classes, which turned this white-on-brand
 * button into dark slate on purple for anyone whose OS prefers dark
 * (research R1).
 */
export default function FinalCta({ content, trialDays }: { content: CtaContent; trialDays?: number }) {
  return (
    <section aria-label={content.headline} className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 rounded-2xl bg-brand-600 px-6 py-12 text-center shadow-card">
        <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {content.headline}
        </h2>
        <p className="max-w-md text-sm text-brand-100">{content.microcopy(trialDays)}</p>
        <Link
          to={content.action.to}
          className="inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
        >
          {content.action.label}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
