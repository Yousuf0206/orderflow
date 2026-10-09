import { expect, test, type Page } from "@playwright/test";

/**
 * The release smoke path, timed, at a phone viewport.
 *
 * Constitution Principle XIII requires signup -> party -> PO -> dispatch ->
 * dashboard remaining to pass before any production deploy, and the v1.3.0
 * "Phone dispatch evidence" gate requires it at a phone width rather than only
 * on a desktop. This runs the whole path and reports what it cost, so SC-002's
 * 30-second budget is a measurement rather than an assumption.
 *
 * It does not replace a human walking the path in a real browser -- it cannot
 * see that a figure looks wrong, only that it reads what was expected.
 */

const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE });

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function signUp(page: Page, unique: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`Smoke Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`smoke-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
}

test("the full smoke path completes at 390px, and a dispatch lands inside 30s", async ({
  page,
}) => {
  const unique = uid();

  await signUp(page, unique);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`SMK-${unique}`);
  await page.getByLabel("Party Name").fill("Smoke Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "Smoke Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("TMT Steel Bars 12mm");
  await page.getByLabel("Ordered Qty").fill("1000");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/(?!new)[^/]+$/);

  // SC-002 is measured from the purchase order screen with the user already
  // signed in, so the clock starts here rather than at signup.
  const started = Date.now();

  const qty = page.getByRole("spinbutton", { name: /qty/i });
  await qty.fill("400");
  await expect(qty).toHaveValue("400");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  await expect(page.locator('[data-stat="Remaining"] [data-stat-value]')).toHaveText("600", {
    timeout: 30_000,
  });
  const elapsedMs = Date.now() - started;

  // eslint-disable-next-line no-console
  console.log(`[smoke] dispatch recorded and Remaining updated in ${elapsedMs}ms`);
  expect(
    elapsedMs,
    `dispatch took ${elapsedMs}ms against SC-002's 30000ms budget`,
  ).toBeLessThan(30_000);

  // The dashboard must agree with the purchase order screen; Principle XIII's
  // path ends there, not at the order.
  await page.goto("/dashboard");
  await expect(page.locator('[data-stat="Total Remaining Balance"] [data-stat-value]')).toHaveText(
    "600",
  );
});
