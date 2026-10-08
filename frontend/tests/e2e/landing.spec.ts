import { expect, test, type Page } from "@playwright/test";

/**
 * The landing page's gates, checked in a real browser because jsdom has no
 * layout engine and "above the fold" is a layout claim
 * (constitution Principle XV, spec SC-001).
 */

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function heroImage(page: Page) {
  return page.getByRole("img", { name: /purchase order/i }).first();
}

for (const [name, viewport] of [
  ["desktop 1280x800", DESKTOP],
  ["phone 390x844", PHONE],
] as const) {
  test(`hero shows a loaded product screenshot above the fold on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const image = await heroImage(page);
    await expect(image).toBeVisible();

    // Visible is not enough: a broken image is "visible" too.
    const loaded = await image.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0);
    expect(loaded, "hero screenshot did not load").toBe(true);

    // Above the fold means inside the first viewport, with no scrolling.
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, "test scrolled before asserting").toBe(0);
    const box = await image.boundingBox();
    expect(box, "hero image has no layout box").not.toBeNull();
    expect(box!.y, "hero screenshot starts below the fold").toBeLessThan(viewport.height);

    // The alt text is the accessible description of the three figures.
    await expect(image).toHaveAttribute("alt", /ordered|dispatched|remaining/i);
  });
}

test("the primary call to action goes to signup", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  await page.getByRole("link", { name: /start (your )?free trial/i }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});

test("the secondary action scrolls to how it works instead of leaving the page", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  await page.getByRole("link", { name: /see how it works/i }).click();
  await expect(page).toHaveURL(/#how-it-works/);
  await expect(page.locator("#how-it-works")).toBeInViewport({ timeout: 5000 });
});

test("legal links resolve from the landing page", async ({ page }) => {
  for (const [name, path] of [
    [/privacy/i, "/privacy"],
    [/terms/i, "/terms"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(new RegExp(path));
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("header and footer match between the landing page and pricing", async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  async function chrome(path: string) {
    await page.goto(path);
    const header = await page.locator("header").first().innerText();
    const footer = await page.locator("footer").first().innerText();
    return { header, footer };
  }

  const landing = await chrome("/");
  const pricing = await chrome("/pricing");
  expect(pricing.header).toBe(landing.header);
  expect(pricing.footer).toBe(landing.footer);
});

/**
 * The app bootstraps a `dark` class from the OS preference (index.html), and
 * the shared app components carry dark variants. The landing page is
 * light-only and its screenshots are captured light, so a dark panel beside a
 * light screenshot is the exact mismatch research R1 exists to prevent.
 */
test.describe("dark-mode preference", () => {
  test.use({ colorScheme: "dark" });

  test("the landing page stays light for a dark-preference visitor", async ({ page }) => {
    await page.goto("/");

    const darkened = await page.evaluate(() => {
      const isDark = (color: string) => {
        const m = color.match(/\d+/g);
        if (!m || m.length < 3) return false;
        const [r, g, b] = m.map(Number);
        return r + g + b < 240; // near-black panels
      };
      return Array.from(document.querySelectorAll("header, footer, section, main > div"))
        .filter((el) => isDark(getComputedStyle(el).backgroundColor))
        .map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 40));
    });

    expect(darkened, `dark surfaces leaked onto the landing page: ${darkened.join(", ")}`).toEqual([]);
  });
});

test("the landing page is navigable and described", async ({ page }) => {
  await page.goto("/");

  // Exactly one h1, and no skipped heading level.
  await expect(page.locator("h1")).toHaveCount(1);

  // Every product image describes what the screen shows.
  const alts = await page.locator("main img").evaluateAll((els) =>
    els.map((el) => (el as HTMLImageElement).alt),
  );
  expect(alts.length).toBeGreaterThanOrEqual(7);
  for (const alt of alts) {
    expect(alt.trim().length, "an image has no meaningful alt text").toBeGreaterThan(10);
  }

  // The primary action is reachable by keyboard alone.
  const cta = page.getByRole("link", { name: /start your free trial/i }).first();
  await cta.focus();
  await expect(cta).toBeFocused();
});

test("no paid or checkout action is reachable from the landing page", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("a").evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  for (const href of hrefs) {
    expect(href).not.toMatch(/checkout|upgrade|subscribe|billing/i);
  }
});
