import { expect, test } from "@playwright/test";

/**
 * Constitution Principle VIII: a workflow that only works on desktop isn't
 * complete. The error and empty states added by this feature are new surface,
 * so they need checking at phone width too.
 *
 * jsdom has no layout engine, so this is the only place the no-sideways-scroll
 * claim can actually be verified rather than asserted.
 */

const PHONE = { width: 390, height: 844 }; // iPhone 12/13/14 logical size

test.use({ viewport: PHONE });

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  // A pixel of slack for sub-pixel rounding.
  expect(
    overflow.scrollWidth,
    `page scrolls sideways: content ${overflow.scrollWidth}px in a ${overflow.clientWidth}px viewport`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * Collision-proof per-test identifier. `Date.now() + n` only stays unique while
 * no two tests start in the same millisecond, which is exactly what happens
 * when the suite runs in parallel.
 */
function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function signUp(page: import("@playwright/test").Page, unique: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`Mob Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`mob-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  // Generous: the first signup of a run pays for a cold dev server and a cold
  // backend. The assertion itself is unchanged.
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
}

test("public pages fit a phone screen", async ({ page }) => {
  for (const path of ["/", "/pricing", "/signup", "/login", "/privacy", "/terms"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

/**
 * The landing page carries wide product screenshots, which is exactly the kind
 * of content that overflows at the narrow end. 390px is the design target; 320
 * is the narrowest phone still in use and 430 the widest common one
 * (spec FR-024, SC-004).
 */
test("the landing page fits every common phone width, CTA included", async ({ page }) => {
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expectNoHorizontalScroll(page);

    const cta = page.getByRole("link", { name: /start (your )?free trial/i }).first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box, `no CTA box at ${width}px`).not.toBeNull();
    // Reachable by scrolling down only: the button must sit inside the
    // viewport's width, not off to one side of it.
    expect(box!.x, `CTA starts off-screen at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `CTA overflows the viewport at ${width}px`).toBeLessThanOrEqual(width + 1);
  }
});

test("the empty dashboard fits and still names the next action", async ({ page }) => {
  await signUp(page, uid());
  await page.goto("/dashboard");

  await expect(page.getByText(/create your first party/i)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("error states fit a phone screen", async ({ page }) => {
  await signUp(page, uid());

  // Fail API calls only, so each screen lands on its error state. Scoped to
  // fetch/xhr: a bare URL pattern would also abort the page navigation, since
  // the app routes and the API share path names.
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "fetch" || type === "xhr") return route.abort();
    return route.continue();
  });

  for (const path of ["/dashboard", "/parties", "/purchase-orders"]) {
    await page.goto(path);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("billing fits a phone screen", async ({ page }) => {
  await signUp(page, uid());
  await page.goto("/billing");

  await expect(page.getByText(/current plan/i)).toBeVisible();
  // Usage is shown as "n of m" in a two-column grid -- the likeliest thing to
  // push a narrow screen wide.
  await expect(page.getByText(/of 3/)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("the core loop is reachable on a phone", async ({ page }) => {
  const unique = uid();
  await signUp(page, unique);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`MOB-${unique}`);
  await page.getByLabel("Party Name").fill("Mobile Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);
  await expectNoHorizontalScroll(page);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "Mobile Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill("100");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/(?!new)[^/]+$/);

  await expect(page.getByText(/No dispatches recorded yet/i)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Check the field took the value before submitting: an empty required field
  // makes the browser block the submit silently, and the failure then looks
  // like a balance that never updated.
  const qty = page.getByRole("spinbutton", { name: /qty/i });
  await qty.fill("30");
  await expect(qty).toHaveValue("30");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  // The named figure, not any "70" on the page: the signed-in user's email can
  // contain one, and on a phone the shell hides it -- which is how this
  // assertion used to fail for a reason unrelated to the core loop.
  await expect(page.locator('[data-stat="Remaining"] [data-stat-value]')).toHaveText("70", {
    timeout: 15_000,
  });
  await expectNoHorizontalScroll(page);
});
