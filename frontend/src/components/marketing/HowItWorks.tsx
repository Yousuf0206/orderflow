import type { HowItWorksStep } from "../../content/landingTypes";
import ScreenshotFrame from "./ScreenshotFrame";

/**
 * Carries id="how-it-works" -- the hero's secondary action scrolls here, so
 * removing or renaming the id breaks that action (tests/e2e/landing.spec.ts
 * catches it).
 *
 * The step numbers are decorative: the ordered list already carries the
 * sequence for a screen reader, and announcing "1" twice adds nothing.
 */
export default function HowItWorks({ heading, steps }: { heading: string; steps: HowItWorksStep[] }) {
  return (
    <section id="how-it-works" aria-label={heading} className="scroll-mt-4 border-t border-slate-100 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mx-auto mb-10 max-w-2xl text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {heading}
        </h2>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.number}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
              >
                {step.number}
              </span>
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
              <p className="text-sm text-slate-500">{step.text}</p>
              <ScreenshotFrame image={step.image} chrome="none" className="mt-auto pt-2" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
