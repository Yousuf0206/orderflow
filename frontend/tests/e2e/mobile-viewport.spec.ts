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

async function signUp(page: import("@playwright/test").Page, unique: number) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`Mob Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`mob-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  await expect(page).toHaveURL(/onboarding/);
}

test("public pages fit a phone screen", async ({ page }) => {
  for (const path of ["/", "/pricing", "/signup", "/login", "/privacy", "/terms"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

test("the empty dashboard fits and still names the next action", async ({ page }) => {
  await signUp(page, Date.now());
  await page.goto("/dashboard");

  await expect(page.getByText(/create your first party/i)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("error states fit a phone screen", async ({ page }) => {
  await signUp(page, Date.now() + 1);

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
  await signUp(page, Date.now() + 2);
  await page.goto("/billing");

  await expect(page.getByText(/current plan/i)).toBeVisible();
  // Usage is shown as "n of m" in a two-column grid -- the likeliest thing to
  // push a narrow screen wide.
  await expect(page.getByText(/of 3/)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("the core loop is reachable on a phone", async ({ page }) => {
  const unique = Date.now() + 3;
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

  await page.getByRole("spinbutton", { name: /qty/i }).fill("30");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  await expect(page.getByText("70").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
