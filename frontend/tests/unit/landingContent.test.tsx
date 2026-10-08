import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import landingContent from "../../src/content/landing";
import type { Action, ImageAssetRef } from "../../src/content/landingTypes";
import Landing from "../../src/pages/marketing/Landing";

/**
 * The landing page's constitutional gates, enforced as tests rather than as
 * review diligence (specs/003-landing-page-upgrade/research.md R8):
 *
 *   XVI  one primary call to action      -> a second primary button fails CI
 *   XVII proof claims must be real       -> "trusted by 500 traders" fails CI
 *   IX   no purchasable paid action      -> a checkout link fails CI
 *   XII  no silent failure in microcopy  -> a hardcoded trial length fails CI
 *
 * Content invariants are numbered in data-model.md; the names below match.
 */

function allActions(): Action[] {
  const c = landingContent;
  return [
    ...c.nav.links,
    c.nav.primaryAction,
    c.hero.primaryAction,
    c.hero.secondaryAction,
    ...c.trust.legalLinks,
    c.finalCta.action,
    ...c.footer.links,
  ];
}

function allImages(): ImageAssetRef[] {
  const c = landingContent;
  return [
    c.hero.image,
    ...(c.hero.mobileImage ? [c.hero.mobileImage] : []),
    ...c.features.map((f) => f.image),
    ...c.steps.map((s) => s.image),
  ];
}

describe("landing content invariants", () => {
  it("invariant 1: every primary action is the same action, and it is the trial", () => {
    const primary = allActions().filter((a) => a.emphasis === "primary");
    expect(primary.length).toBeGreaterThan(0);
    // Nav, hero and the closing band may all invite the trial. What Principle
    // XVI forbids is a *second* primary thing to do, so the test is on the
    // number of distinct destinations, not the number of buttons.
    expect(new Set(primary.map((a) => a.to))).toEqual(new Set(["/signup"]));
  });

  it("invariant 2: no action starts a purchase that cannot complete", () => {
    const forbidden = /checkout|upgrade|subscribe|billing|purchase|buy/i;
    for (const action of allActions()) {
      expect(action.to, `action "${action.label}" points at a paid surface`).not.toMatch(forbidden);
      expect(action.label).not.toMatch(/upgrade|buy now|subscribe/i);
    }
  });

  it("invariant 5: every image has alt text and dimensions, and exactly one is eager", () => {
    const images = allImages();
    expect(images.length).toBeGreaterThanOrEqual(7);
    for (const image of images) {
      expect(image.alt.trim().length).toBeGreaterThan(10);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.src).toBeTruthy();
      expect(image.src2x).toBeTruthy();
    }
    // Only the hero is eager. Its phone crop is the same image at a different
    // size -- a <picture> fetches exactly one of the two -- so both carry
    // "eager" and nothing below the fold may.
    const eager = images.filter((i) => i.loading === "eager");
    expect(eager).toEqual(
      [landingContent.hero.image, landingContent.hero.mobileImage].filter(Boolean),
    );
    for (const feature of landingContent.features) expect(feature.image.loading).toBe("lazy");
    for (const step of landingContent.steps) expect(step.image.loading).toBe("lazy");
  });

  it("invariant 6: trial microcopy states no number until the server supplies one", () => {
    expect(landingContent.hero.trialMicrocopy(undefined)).not.toMatch(/\d/);
    expect(landingContent.finalCta.microcopy(undefined)).not.toMatch(/\d/);
    expect(landingContent.hero.trialMicrocopy(14)).toMatch(/14/);
  });

  it("invariant 7: footer links include Privacy and Terms", () => {
    const targets = landingContent.footer.links.map((l) => l.to);
    expect(targets).toContain("/privacy");
    expect(targets).toContain("/terms");
  });

  it("structure: three pain-outcome pairs, three features, three steps", () => {
    expect(landingContent.problemOutcome).toHaveLength(3);
    expect(landingContent.features).toHaveLength(3);
    expect(landingContent.steps).toHaveLength(3);
    expect(landingContent.trust.statements).toHaveLength(3);
  });

  it("structure: feature blocks bind distinct lazy assets", () => {
    const srcs = landingContent.features.map((f) => f.image.src);
    expect(new Set(srcs).size).toBe(3);
    for (const feature of landingContent.features) {
      expect(feature.image.loading).toBe("lazy");
    }
  });

  it("structure: industries are a non-empty editable list", () => {
    expect(landingContent.proof.industries.length).toBeGreaterThanOrEqual(3);
  });
});

describe("landing page copy", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ paid_plans_enabled: false, trial_length_days: 14, plans: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  function renderLanding(): string {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui: ReactNode = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Landing />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { container } = render(ui);
    return container.textContent ?? "";
  }

  it("invariant 3: makes no unverifiable proof claim", () => {
    const text = renderLanding();
    const bannedProof = [
      /\btrusted by\b/i,
      /\b\d[\d,]*\+?\s*(happy\s+)?(customers|users|companies|businesses|traders|teams)\b/i,
      /\btestimonial/i,
      /\brated\b/i,
      /\b\d(\.\d)?\s*\/\s*5\b/i,
      /\breviews?\b/i,
      /\bloved by\b/i,
    ];
    for (const pattern of bannedProof) {
      expect(text, `landing copy matches banned proof pattern ${pattern}`).not.toMatch(pattern);
    }
  });

  it("invariant 4: avoids enterprise jargon", () => {
    const text = renderLanding();
    for (const word of ["orchestration", "synergy", "leverage", "paradigm", "best-in-class"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("speaks the trader's vocabulary", () => {
    const text = renderLanding().toLowerCase();
    for (const word of ["remaining balance", "dispatch", "party", "due"]) {
      expect(text).toContain(word);
    }
  });

  it("renders exactly one primary call to action in the DOM", () => {
    renderLanding();
    const trialLinks = screen.getAllByRole("link", { name: /start (your )?free trial/i });
    // Nav, hero, and closing band all point at the trial; only the hero and
    // closing actions carry primary emphasis, and both are the same style.
    expect(trialLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of trialLinks) {
      expect(link.getAttribute("href")).toBe("/signup");
    }
  });
});
