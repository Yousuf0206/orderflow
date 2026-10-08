import { ArrowRight } from "lucide-react";

import type { PainOutcomePair } from "../../content/landingTypes";

/**
 * Three pains, each answered by something the product actually does.
 *
 * The pairing lives in the markup -- a <dl> with each pain as the term and its
 * outcome as the description -- so it survives a screen reader and the
 * single-column phone layout, where "left column vs right column" means
 * nothing.
 */
export default function ProblemOutcome({
  heading,
  pairs,
}: {
  heading: string;
  pairs: PainOutcomePair[];
}) {
  return (
    <section aria-label={heading} className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mx-auto mb-10 max-w-2xl text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {heading}
        </h2>
        <dl className="space-y-6">
          {pairs.map((pair) => (
            <div
              key={pair.pain}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-5"
            >
              <dt className="text-sm text-slate-500">{pair.pain}</dt>
              <ArrowRight
                size={18}
                aria-hidden="true"
                className="hidden shrink-0 text-slate-300 sm:block"
              />
              <dd className="text-sm font-medium text-slate-900">{pair.outcome}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
