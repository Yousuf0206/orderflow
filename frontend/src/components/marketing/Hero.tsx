import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { HeroContent } from "../../content/landingTypes";
import Button from "../ui/Button";
import ScreenshotFrame from "./ScreenshotFrame";

/**
 * The first screen. Constitution Principle XV turns on this component: the
 * product screenshot must be visible without scrolling, on a phone as well as
 * a desktop, which is why the copy column is kept short and the image is
 * fetched eagerly rather than lazily.
 */
export default function Hero({ content, trialDays }: { content: HeroContent; trialDays?: number }) {
  const scrollToAnchor = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const id = content.secondaryAction.to.replace("#", "");
    const target = document.getElementById(id);
    if (!target) return; // Let the browser handle it rather than swallowing the click.
    e.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // Keep the URL honest about where the visitor is.
    window.history.replaceState(null, "", content.secondaryAction.to);
  };

  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-10 lg:grid-cols-2 lg:gap-12 lg:pb-20 lg:pt-16">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{content.eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {content.headline}
          </h1>
          <p className="max-w-xl text-base text-slate-600 sm:text-lg">{content.subcopy}</p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <Link to={content.primaryAction.to} className="w-full sm:w-auto">
              <Button className="w-full justify-center px-6 py-3 text-base sm:w-auto">
                {content.primaryAction.label}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </Link>
            <a
              href={content.secondaryAction.to}
              onClick={scrollToAnchor}
              className="text-center text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {content.secondaryAction.label}
            </a>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
            {content.trialMicrocopy(trialDays)}
          </p>
        </div>

        <ScreenshotFrame
          image={content.image}
          mobileImage={content.mobileImage}
          priority
          className="lg:translate-x-2"
        />
      </div>
    </section>
  );
}
