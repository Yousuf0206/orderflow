import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Captures the four product screenshots the landing page shows, plus three
 * narrower crops for the How-it-works steps.
 *
 * This is the documented refresh procedure for FR-028: when an in-app screen
 * changes, re-run it instead of redesigning the page. It drives the real UI,
 * which is what makes constitution Principle XIX ("screenshots match the
 * shipped UI") true by construction rather than by diligence.
 *
 * Prerequisites (see specs/003-landing-page-upgrade/quickstart.md):
 *   1. backend running, migrations applied
 *   2. `python -m src.scripts.seed_landing_demo` from backend/
 *   3. `npm run capture:landing` from frontend/
 *
 * Contract: specs/003-landing-page-upgrade/contracts/image-assets.md
 */

const OWNER_EMAIL = "demo@orderflow.example";
const OWNER_PASSWORD = "password123";
const HERO_PO = "PO-2001";
const FIXTURE_PARTY = "Northgate Steel Works";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "landing");

/** Byte budgets from the asset contract. Exceeding one fails the capture. */
const HERO_BUDGET_BYTES = 200 * 1024;
const TOTAL_BUDGET_BYTES = 600 * 1024;

interface CapturedAsset {
  name: string;
  route: string;
  selector: string;
  files: Record<string, string>;
  dimensions: { width: number; height: number };
  bytes: Record<string, number>;
}

const captured: CapturedAsset[] = [];

function appCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Encodes one captured PNG buffer to a 1x and 2x WebP at the target width.
 * The buffer arrives at deviceScaleFactor 2, so its pixel width is already 2x
 * the CSS width -- the 2x file is the capture scaled to 2 * targetWidth.
 */
async function emit(
  name: string,
  png: Buffer,
  targetWidth: number,
  meta: { route: string; selector: string },
): Promise<CapturedAsset> {
  mkdirSync(OUT_DIR, { recursive: true });

  const one = await sharp(png).resize({ width: targetWidth }).webp({ quality: 82 }).toBuffer();
  const two = await sharp(png).resize({ width: targetWidth * 2 }).webp({ quality: 78 }).toBuffer();

  const oneMeta = await sharp(one).metadata();
  const fileOne = `${name}.webp`;
  const fileTwo = `${name}@2x.webp`;
  writeFileSync(join(OUT_DIR, fileOne), one);
  writeFileSync(join(OUT_DIR, fileTwo), two);

  const asset: CapturedAsset = {
    name,
    route: meta.route,
    selector: meta.selector,
    files: { "1x": fileOne, "2x": fileTwo },
    dimensions: { width: oneMeta.width ?? targetWidth, height: oneMeta.height ?? 0 },
    bytes: { "1x": one.byteLength, "2x": two.byteLength },
  };
  captured.push(asset);
  console.log(
    `  ${name}: ${asset.dimensions.width}x${asset.dimensions.height} ` +
      `(1x ${(one.byteLength / 1024).toFixed(1)}KB, 2x ${(two.byteLength / 1024).toFixed(1)}KB)`,
  );
  return asset;
}

/** Fails loudly rather than writing an empty image when a selector is gone. */
async function requireCapture(page: Page, selector: string): Promise<{ png: Buffer; locator: Locator }> {
  const locator = page.locator(`[data-capture="${selector}"]`);
  await expect(
    locator,
    `missing [data-capture="${selector}"] -- the in-app screen changed; see contracts/image-assets.md`,
  ).toBeVisible({ timeout: 15_000 });
  const png = await locator.screenshot({ animations: "disabled" });
  return { png, locator };
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(OWNER_EMAIL);
  await page.locator('input[type="password"]').fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page, "login did not reach the app -- is the fixture seeded?").toHaveURL(
    /dashboard|onboarding/,
    { timeout: 20_000 },
  );
}

test("capture landing assets", async ({ page }) => {
  // A developer's stored dark theme must never leak into a committed asset.
  await page.addInitScript(() => window.localStorage.removeItem("orderflow_theme"));

  await login(page);

  // --- Asset 1: hero, the purchase-order summary -------------------------
  await page.goto("/purchase-orders");
  await page.getByRole("link", { name: HERO_PO }).click();
  await expect(page).toHaveURL(/purchase-orders\/[0-9a-f-]+/);

  const summary = page.locator('[data-capture="po-summary"]');
  await expect(summary).toBeVisible();
  // The hero's whole job is these three figures. If the fixture is wrong, the
  // asset would be a quiet lie, so refuse to write it.
  await expect(summary, "hero PO must read 1,000 ordered").toContainText("1,000");
  await expect(summary, "hero PO must read 400 dispatched").toContainText("400");
  await expect(summary, "hero PO must read 600 remaining").toContainText("600");

  // The hero takes the whole screen: a 6:1 strip of three stat cards reads as
  // a widget, not as a product. The full page shows the numbers *and* how a
  // dispatch gets recorded against them.
  const poPage = await requireCapture(page, "po-page");
  await emit("po-detail", poPage.png, 720, {
    route: "/purchase-orders/:id",
    selector: 'data-capture="po-page"',
  });

  const poSummary = await requireCapture(page, "po-summary");
  // The phone hero. The full-page shot shrunk to 358px makes its labels
  // unreadable, and an illegible screenshot fails the point of Principle XV
  // as surely as no screenshot would.
  await emit("po-summary", poSummary.png, 560, {
    route: "/purchase-orders/:id",
    selector: 'data-capture="po-summary"',
  });
  await emit("step-po", poSummary.png, 320, {
    route: "/purchase-orders/:id",
    selector: 'data-capture="po-summary"',
  });

  // --- Asset 3: dispatch history (same screen, lower down) ---------------
  const history = await requireCapture(page, "dispatch-history");
  await emit("dispatch-history", history.png, 640, {
    route: "/purchase-orders/:id",
    selector: 'data-capture="dispatch-history"',
  });
  await emit("step-dispatch", history.png, 320, {
    route: "/purchase-orders/:id",
    selector: 'data-capture="dispatch-history"',
  });

  // --- Asset 2: dashboard remaining balance ------------------------------
  await page.goto("/dashboard");
  // Recharts paints asynchronously and animates in. Screenshotting too early
  // produced an empty "PO Status Breakdown" panel -- a blank card in a
  // landing image reads as a broken product.
  await expect(page.locator(".recharts-pie-sector").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  const dashboard = await requireCapture(page, "dashboard-balance");
  await emit("dashboard-balance", dashboard.png, 640, {
    route: "/dashboard",
    selector: 'data-capture="dashboard-balance"',
  });

  // --- Asset 4: party-wise open orders -----------------------------------
  await page.goto("/parties");
  await page.getByRole("link", { name: FIXTURE_PARTY }).click();
  await expect(page).toHaveURL(/parties\/[0-9a-f-]+/);
  const party = await requireCapture(page, "party-open-orders");
  await emit("party-open-orders", party.png, 640, {
    route: "/parties/:id",
    selector: 'data-capture="party-open-orders"',
  });
  await emit("step-party", party.png, 320, {
    route: "/parties/:id",
    selector: 'data-capture="party-open-orders"',
  });

  // --- Budgets ------------------------------------------------------------
  const hero = captured.find((a) => a.name === "po-detail")!;
  const heroBytes = hero.bytes["1x"] + hero.bytes["2x"];
  const totalBytes = captured.reduce((sum, a) => sum + a.bytes["1x"] + a.bytes["2x"], 0);
  console.log(
    `  budgets: hero ${(heroBytes / 1024).toFixed(1)}KB / 200KB, ` +
      `total ${(totalBytes / 1024).toFixed(1)}KB / 600KB`,
  );

  // --- Manifest -----------------------------------------------------------
  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        appCommit: appCommit(),
        fixture: "seed_landing_demo.py",
        fixtureOrg: "OrderFlow Demo",
        viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
        assets: captured,
      },
      null,
      2,
    )}\n`,
  );

  expect(heroBytes, `hero assets exceed the ${HERO_BUDGET_BYTES} byte budget`).toBeLessThanOrEqual(
    HERO_BUDGET_BYTES,
  );
  expect(totalBytes, `landing assets exceed the ${TOTAL_BUDGET_BYTES} byte budget`).toBeLessThanOrEqual(
    TOTAL_BUDGET_BYTES,
  );
});
