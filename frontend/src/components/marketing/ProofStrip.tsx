import type { ProofContent } from "../../content/landingTypes";

/**
 * Industry chips, not customer logos.
 *
 * Principle XVII permits naming the industries OrderFlow is built for until
 * real logos exist, because that is a claim about the product's focus rather
 * than about customers it does not have. Nothing in this component may become
 * a count, a testimonial or a rating.
 */
export default function ProofStrip({ content }: { content: ProofContent }) {
  return (
    <section aria-label={content.heading} className="border-y border-slate-100 bg-slate-50 py-7">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{content.heading}</p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {content.industries.map((industry) => (
            <li
              key={industry}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600"
            >
              {industry}
            </li>
          ))}
        </ul>
        {content.subline && <p className="mt-3 text-sm text-slate-500">{content.subline}</p>}
      </div>
    </section>
  );
}
