/**
 * Content model for the public landing page.
 *
 * Shapes come from specs/003-landing-page-upgrade/data-model.md. The point of
 * putting every string in one typed tree is that copy review, the
 * one-primary-action rule and the no-fake-proof rule each have a single place
 * to look -- and a single place to test (tests/unit/landingContent.test.tsx).
 */

/**
 * A link or button.
 *
 * Several places on the page may carry the primary action -- nav, hero and the
 * closing band all invite the same next step -- but every primary Action must
 * point at the same destination. Principle XVI is about there being one thing
 * to do, not one button on the page.
 */
export interface Action {
  label: string;
  /** A route path, or an "#anchor" for soft in-page actions. */
  to: string;
  emphasis: "primary" | "soft";
}

export interface ImageAssetRef {
  /** Imported module URL, so Vite fingerprints it and a missing file fails the build. */
  src: string;
  src2x: string;
  /** Intrinsic 1x dimensions. Both required, so the page reserves space before load. */
  width: number;
  height: number;
  /** Describes what the screen shows. Never the word "screenshot" alone. */
  alt: string;
  /** "eager" is permitted for the hero asset only. */
  loading: "eager" | "lazy";
}

export interface NavContent {
  logoLabel: string;
  links: Action[];
  primaryAction: Action;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  subcopy: string;
  primaryAction: Action;
  secondaryAction: Action;
  /** MUST return a string with no digits when trialDays is undefined (FR-016). */
  trialMicrocopy: (trialDays?: number) => string;
  image: ImageAssetRef;
  /**
   * Art direction, not a resolution swap: on a phone the full-page shot
   * shrinks until its labels cannot be read, so a tighter crop of the same
   * real screen takes its place below the `sm` breakpoint.
   */
  mobileImage?: ImageAssetRef;
}

export interface ProofContent {
  heading: string;
  /** Editable list; no claim about customers (FR-005, FR-015). */
  industries: string[];
  subline: string | null;
}

export interface PainOutcomePair {
  pain: string;
  /** MUST name a capability live in the application today (FR-006, FR-020). */
  outcome: string;
}

export interface FeatureBlockContent {
  title: string;
  copy: string;
  bullet: string | null;
  image: ImageAssetRef;
  /** Alternates down the page at desktop width; ignored when stacked. */
  imageSide: "left" | "right";
}

export interface HowItWorksStep {
  number: 1 | 2 | 3;
  title: string;
  text: string;
  image: ImageAssetRef;
}

export interface TrustStatement {
  title: string;
  text: string;
}

export interface TrustContent {
  heading: string;
  statements: TrustStatement[];
  legalLinks: Action[];
}

export interface CtaContent {
  headline: string;
  action: Action;
  microcopy: (trialDays?: number) => string;
}

export interface FooterContent {
  links: Action[];
}

export interface LandingContent {
  nav: NavContent;
  hero: HeroContent;
  proof: ProofContent;
  problemOutcomeHeading: string;
  problemOutcome: PainOutcomePair[];
  featuresHeading: string;
  features: FeatureBlockContent[];
  stepsHeading: string;
  steps: HowItWorksStep[];
  trust: TrustContent;
  finalCta: CtaContent;
  footer: FooterContent;
}
