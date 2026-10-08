import FeatureBlock from "../../components/marketing/FeatureBlock";
import FinalCta from "../../components/marketing/FinalCta";
import Hero from "../../components/marketing/Hero";
import HowItWorks from "../../components/marketing/HowItWorks";
import ProblemOutcome from "../../components/marketing/ProblemOutcome";
import ProofStrip from "../../components/marketing/ProofStrip";
import SiteFooter from "../../components/marketing/SiteFooter";
import SiteHeader from "../../components/marketing/SiteHeader";
import TrustRow from "../../components/marketing/TrustRow";
import landingContent from "../../content/landing";
import { usePageMeta } from "../../hooks/usePageMeta";
import { usePublicPlans } from "../../hooks/useTrialInfo";

/**
 * The public landing page: nine sections, in the order FR-001 fixes, reading
 * every word and image from src/content/landing.ts and nothing else.
 *
 * Light-only by design -- see src/components/marketing/ScreenshotFrame.tsx and
 * specs/003-landing-page-upgrade/research.md R1. Adding a `dark:` class here
 * would put a dark panel next to a light screenshot.
 */
export default function Landing() {
  usePageMeta(
    "Track purchase orders and partial dispatches, live",
    "OrderFlow keeps your remaining balances accurate in real time for trading companies and material dealers who deliver in parts, not all at once.",
  );
  // Falls back to "Free trial" until this resolves, so the hero never states a
  // length that might not be the one signup grants.
  const trialDays = usePublicPlans().data?.trial_length_days;

  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader content={landingContent.nav} />

      <main>
        <Hero content={landingContent.hero} trialDays={trialDays} />

        <ProofStrip content={landingContent.proof} />

        <ProblemOutcome
          heading={landingContent.problemOutcomeHeading}
          pairs={landingContent.problemOutcome}
        />

        <section aria-label={landingContent.featuresHeading} className="bg-white pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mx-auto mb-12 max-w-2xl text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {landingContent.featuresHeading}
            </h2>
            <div className="space-y-16 sm:space-y-20">
              {landingContent.features.map((feature) => (
                <FeatureBlock key={feature.title} content={feature} />
              ))}
            </div>
          </div>
        </section>

        <HowItWorks heading={landingContent.stepsHeading} steps={landingContent.steps} />

        <TrustRow content={landingContent.trust} />

        <FinalCta content={landingContent.finalCta} trialDays={trialDays} />
      </main>

      <SiteFooter content={landingContent.footer} />
    </div>
  );
}
