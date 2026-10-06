import { expect, test } from "@playwright/test";

/**
 * Smoke test for the P1 critical path (spec.md User Story 1 / quickstart.md
 * Scenario B): sign up, create a party, create a PO, record a dispatch, and
 * confirm the remaining balance updates live.
 *
 * Requires the backend running at BASE_URL (default http://localhost:8000)
 * and the frontend dev server running at http://localhost:5173.
 */

test("sign up, create PO, record dispatch, see live remaining balance", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`E2E Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`e2e-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();

  await expect(page).toHaveURL(/onboarding/);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`E2E-${unique}`);
  await page.getByLabel("Party Name").fill("E2E Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/.+/);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "E2E Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill("100");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();

  await expect(page).toHaveURL(/\/purchase-orders\/.+/);
  await expect(page.getByText("100")).toBeVisible();

  await page.getByLabel("Qty").fill("40");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  await expect(page.getByText("60")).toBeVisible();
});
