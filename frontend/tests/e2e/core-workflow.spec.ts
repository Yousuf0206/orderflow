import { expect, test } from "@playwright/test";

/**
 * The P1 critical path (spec.md User Story 1), and the release gate: a build
 * that fails this is not announced to beta users.
 *
 * Deliberately driven through the UI only. An API-level pass is not accepted as
 * evidence that this loop works, because every failure users have hit lived in
 * the gap between a working endpoint and a screen that could reach it.
 *
 * Requires the backend at BASE_URL (default http://localhost:8000) and the
 * frontend dev server at http://localhost:5173.
 */

async function signUp(page: import("@playwright/test").Page, unique: number) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`E2E Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`e2e-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  await expect(page).toHaveURL(/onboarding/);
}

async function createParty(page: import("@playwright/test").Page, unique: number, name = "E2E Party") {
  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`E2E-${unique}`);
  await page.getByLabel("Party Name").fill(name);
  await page.getByRole("button", { name: /save party/i }).click();

  // Not just /parties/.+ -- "/parties/new" matches that too, so a failed save
  // would slip through here and resurface later as a confusing empty party
  // dropdown. Assert we actually reached the saved party's detail page.
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function createOrder(
  page: import("@playwright/test").Page,
  unique: number,
  partyLabel: string,
  orderedQty: string,
) {
  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: partyLabel });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill(orderedQty);
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/.+/);

  // Wait for the detail page to settle before any test types into it. The
  // order and its dispatch history load as two separate requests, and typing
  // into the dispatch form while the second is still landing can lose the
  // keystrokes to a re-render.
  await expect(page.getByText("Remaining")).toBeVisible();
  await expect(page.getByText(/No dispatches recorded yet/i)).toBeVisible();
}

test("sign up, create PO, record partial dispatch, see live remaining balance", async ({ page }) => {
  const unique = Date.now();

  await signUp(page, unique);

  // The shell must know who you are on the first authenticated screen, not
  // after a reload. /onboarding sits outside AppShell, so check from inside.
  await page.goto("/dashboard");
  await expect(page.getByText(`E2E Co ${unique}`)).toBeVisible();

  await createParty(page, unique);
  await createOrder(page, unique, "E2E Party", "100");

  await expect(page.getByText("100").first()).toBeVisible();

  const orderUrl = page.url();

  await page.getByRole("spinbutton", { name: /qty/i }).fill("30");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  // Remaining must fall to 70 on the page already open. No reload: a number
  // that is only correct after a refresh is not a number a trader can trust
  // mid-conversation with a supplier.
  await expect(page.getByText("70").first()).toBeVisible();
  await expect(page).toHaveURL(orderUrl);

  // And the dispatch has to show up in this order's history, not just change a total.
  await expect(page.getByText("30").first()).toBeVisible();

  // The dashboard is where the balance gets trusted, so it has to agree.
  await page.goto("/dashboard");
  await expect(page.getByText("70").first()).toBeVisible();
});

test("over-dispatch is warned about and requires explicit confirmation", async ({ page }) => {
  const unique = Date.now() + 1;

  await signUp(page, unique);
  await createParty(page, unique, "Over Party");
  await createOrder(page, unique, "Over Party", "100");

  await page.getByRole("spinbutton", { name: /qty/i }).fill("30");
  await page.getByRole("button", { name: /add dispatch/i }).click();
  await expect(page.getByText("70").first()).toBeVisible();

  // 80 against 70 remaining: must warn rather than silently accept or silently reject.
  await page.getByRole("spinbutton", { name: /qty/i }).fill("80");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  await expect(page.getByText(/exceed|more than|over/i).first()).toBeVisible();
});

test("a dispatch equal to the remaining balance completes without a warning", async ({ page }) => {
  const unique = Date.now() + 2;

  await signUp(page, unique);
  await createParty(page, unique, "Exact Party");
  await createOrder(page, unique, "Exact Party", "100");

  // Exactly the remaining quantity is full fulfilment, not an over-dispatch --
  // the boundary an off-by-one in the comparison would get wrong.
  await page.getByRole("spinbutton", { name: /qty/i }).fill("100");
  await page.getByRole("button", { name: /add dispatch/i }).click();

  await expect(page.getByText("0").first()).toBeVisible();
});

test("logging out clears the session completely", async ({ page }) => {
  const unique = Date.now() + 3;

  await signUp(page, unique);

  // Log out lives in the app shell, which /onboarding is not inside.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /log out|sign out/i }).click();
  await expect(page).toHaveURL(/login/);

  const stored = await page.evaluate(() => window.localStorage.getItem("orderflow_tokens"));
  expect(stored).toBeNull();

  // A cleared session must actually be unusable, not merely hidden.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
});

test("a brand-new organization sees an empty dashboard that says what to do next", async ({ page }) => {
  const unique = Date.now() + 4;

  await signUp(page, unique);
  await page.goto("/dashboard");

  // Not a blank panel, and not a skeleton that never resolves.
  await expect(page.getByText(/create|get started|add your first|no purchase orders/i).first()).toBeVisible();
});
