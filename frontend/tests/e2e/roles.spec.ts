import { expect, test, type Page } from "@playwright/test";

/**
 * Spec SC-001: a user encounters zero controls that refuse them after being
 * pressed.
 *
 * The defect this covers: the dispatch form had no role check, while the
 * backend restricted recording to owner/manager/staff. A Viewer filled the
 * form in, pressed the button, and was refused -- with nothing wrong with what
 * they had typed. They concluded the product was broken.
 *
 * Roles are driven through the real invitation flow rather than by stubbing
 * /auth/me, because the point is that the interface and the server agree.
 */

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function signUpOwner(page: Page, unique: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`Role Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`owner-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
}

/** Creates a party and a purchase order, and returns the PO's URL. */
async function seedOrder(page: Page, unique: string): Promise<string> {
  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`RL-${unique}`);
  await page.getByLabel("Party Name").fill("Role Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "Role Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill("100");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/(?!new)[^/]+$/);
  return page.url();
}

/**
 * Invites someone, takes the link the screen now offers (no mail service is
 * configured in this environment, which is exactly the case the invite work
 * made honest), accepts it in a fresh context, and returns that page.
 */
async function joinAs(
  page: Page,
  browser: import("@playwright/test").Browser,
  unique: string,
  role: string,
): Promise<Page> {
  const email = `${role}-${unique}@test.com`;
  await page.goto("/settings/team");
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("combobox").first().selectOption(role);
  await page.getByRole("button", { name: /^invite$/i }).click();

  const link = page.locator("code", { hasText: "accept-invite" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const url = (await link.textContent())!.trim();

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const member = await context.newPage();
  await member.goto(url.replace(/^https?:\/\/[^/]+/, ""));
  await member.locator("input[type=password]").first().fill("password123");
  await member.getByRole("button", { name: /accept|join|set password|continue/i }).first().click();
  await expect(member).toHaveURL(/dashboard|onboarding/, { timeout: 30_000 });
  return member;
}

test("a viewer is offered no control the server would refuse", async ({ page, browser }) => {
  const unique = uid();
  await signUpOwner(page, unique);
  const poUrl = await seedOrder(page, unique);

  const viewer = await joinAs(page, browser, unique, "viewer");

  await viewer.goto(poUrl.replace(/^https?:\/\/[^/]+/, ""));
  // The figures are still there -- a Viewer exists to read them.
  await expect(viewer.locator('[data-stat="Remaining"] [data-stat-value]')).toHaveText("100");
  // The form is not.
  await expect(viewer.getByRole("button", { name: /add dispatch/i })).toHaveCount(0);
  await expect(viewer.getByText(/needs Staff access or above/i)).toBeVisible();

  // No create controls on the lists either.
  await viewer.goto("/purchase-orders");
  await expect(viewer.getByRole("link", { name: /new purchase order/i })).toHaveCount(0);
  await viewer.goto("/parties");
  await expect(viewer.getByRole("link", { name: /new party/i })).toHaveCount(0);

  await viewer.context().close();
});

test("staff may record a dispatch and the figure updates", async ({ page, browser }) => {
  const unique = uid();
  await signUpOwner(page, unique);
  const poUrl = await seedOrder(page, unique);

  const staff = await joinAs(page, browser, unique, "staff");
  await staff.goto(poUrl.replace(/^https?:\/\/[^/]+/, ""));

  const qty = staff.getByRole("spinbutton", { name: /qty/i });
  await qty.fill("30");
  await expect(qty).toHaveValue("30");
  await staff.getByRole("button", { name: /add dispatch/i }).click();

  await expect(staff.locator('[data-stat="Remaining"] [data-stat-value]')).toHaveText("70", {
    timeout: 15_000,
  });

  await staff.context().close();
});

test("an owner sees every control", async ({ page }) => {
  const unique = uid();
  await signUpOwner(page, unique);
  await seedOrder(page, unique);

  await expect(page.getByRole("button", { name: /add dispatch/i })).toBeVisible();
  await page.goto("/purchase-orders");
  await expect(page.getByRole("link", { name: /new purchase order/i })).toBeVisible();
  await page.goto("/parties");
  await expect(page.getByRole("link", { name: /new party/i })).toBeVisible();
});
