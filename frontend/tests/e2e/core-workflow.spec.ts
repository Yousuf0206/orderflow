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

/**
 * A per-test identifier that cannot collide with another test's.
 *
 * The previous scheme was `Date.now()`, `Date.now() + 1`, `Date.now() + 2`...
 * which only stays unique if no two tests start within a few milliseconds of
 * each other. Run in parallel they routinely do, and two tests sharing an
 * email means one of them fails at signup for reasons that have nothing to do
 * with what it is testing.
 */
function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Asserts on a named figure, not on a number that happens to appear somewhere
 * on the page.
 *
 * `getByText("70").first()` used to match the signed-in user's email in the app
 * shell whenever the generated timestamp contained "70" -- which passed against
 * the wrong element on desktop, and failed on a phone where the shell hides it.
 * Either way it never waited for the figure under test, so the next step raced
 * the application.
 */
async function expectStat(page: import("@playwright/test").Page, label: string, value: string) {
  // 15s, not the default 5s. Every call here is a read straight after a write,
  // against a single-process backend that other workers are also using. The
  // assertion stays exact -- the figure must become this number, not merely
  // change -- so a slow refetch costs seconds, while a wrong figure still
  // fails.
  await expect(page.locator(`[data-stat="${label}"] [data-stat-value]`)).toHaveText(value, {
    timeout: 15_000,
  });
}

/**
 * Records a dispatch, checking that the form actually took the quantity before
 * submitting it.
 *
 * Without the value check this step can fail silently: if the keystroke is lost
 * to a re-render, the qty field is left empty, the browser blocks the submit on
 * its `required` attribute, and nothing happens at all. The test then waits out
 * its whole timeout watching an unchanged figure, which says "the balance never
 * updated" when the truth is "the form was never submitted".
 */
async function recordDispatch(page: import("@playwright/test").Page, qty: string) {
  const field = page.getByRole("spinbutton", { name: /qty/i });
  await field.fill(qty);
  await expect(field).toHaveValue(qty);
  await page.getByRole("button", { name: /add dispatch/i }).click();
}

async function signUp(page: import("@playwright/test").Page, unique: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /company name/i }).fill(`E2E Co ${unique}`);
  await page.locator("#email, input[type=email]").fill(`e2e-${unique}@test.com`);
  await page.locator("#password, input[type=password]").fill("password123");
  await page.getByRole("button", { name: /start free trial/i }).click();
  // Generous, because the first signup of a run pays for a cold dev server
  // compiling the bundle and a cold backend opening its connection pool. The
  // assertion is unchanged -- signup must still reach onboarding -- it just
  // does not call a slow first run a broken one.
  await expect(page).toHaveURL(/onboarding/, { timeout: 30_000 });
}

async function createParty(page: import("@playwright/test").Page, unique: string, name = "E2E Party") {
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
  unique: string,
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
  //
  // Both waits are given room: this is the first read straight after a write,
  // so it is the slowest point in the suite. The default 5s turned a merely
  // slow response into a failure, with the page still showing its skeleton.
  await expect(page.locator('[data-stat="Remaining"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/No dispatches recorded yet/i)).toBeVisible({ timeout: 15_000 });
}

test("sign up, create PO, record partial dispatch, see live remaining balance", async ({ page }) => {
  const unique = uid();

  await signUp(page, unique);

  // The shell must know who you are on the first authenticated screen, not
  // after a reload. /onboarding sits outside AppShell, so check from inside.
  await page.goto("/dashboard");
  await expect(page.getByText(`E2E Co ${unique}`)).toBeVisible();

  await createParty(page, unique);
  await createOrder(page, unique, "E2E Party", "100");

  await expectStat(page, "Ordered", "100");
  await expectStat(page, "Remaining", "100");

  const orderUrl = page.url();

  await recordDispatch(page, "30");

  // Remaining must fall to 70 on the page already open. No reload: a number
  // that is only correct after a refresh is not a number a trader can trust
  // mid-conversation with a supplier.
  await expectStat(page, "Remaining", "70");
  await expectStat(page, "Dispatched", "30");
  await expect(page).toHaveURL(orderUrl);

  // And the dispatch has to show up in this order's history, not just change a total.
  // The history is its own query, so it can lag the stat cards by a refetch.
  await expect(
    page.locator('[data-capture="dispatch-history"] tbody tr').filter({ hasText: "30" }),
  ).toHaveCount(1, { timeout: 15_000 });

  // The dashboard is where the balance gets trusted, so it has to agree.
  await page.goto("/dashboard");
  await expectStat(page, "Total Remaining Balance", "70");
});

test("over-dispatch is warned about and requires explicit confirmation", async ({ page }) => {
  const unique = uid();

  await signUp(page, unique);
  await createParty(page, unique, "Over Party");
  await createOrder(page, unique, "Over Party", "100");

  await recordDispatch(page, "30");
  // The second dispatch is only meaningful once this one has landed, so this
  // assertion has to be the real figure -- not a number found anywhere.
  await expectStat(page, "Remaining", "70");

  // 80 against 70 remaining: must warn rather than silently accept or silently reject.
  await recordDispatch(page, "80");

  await expect(page.getByText(/exceed|more than|over/i).first()).toBeVisible();
});

test("a dispatch equal to the remaining balance completes without a warning", async ({ page }) => {
  const unique = uid();

  await signUp(page, unique);
  await createParty(page, unique, "Exact Party");
  await createOrder(page, unique, "Exact Party", "100");

  // Exactly the remaining quantity is full fulfilment, not an over-dispatch --
  // the boundary an off-by-one in the comparison would get wrong.
  await recordDispatch(page, "100");

  await expectStat(page, "Remaining", "0");
  // And no warning: full fulfilment is not an over-dispatch.
  await expect(page.getByText(/exceed|more than|over/i)).toHaveCount(0);
});

test("logging out clears the session completely", async ({ page }) => {
  const unique = uid();

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
  const unique = uid();

  await signUp(page, unique);
  await page.goto("/dashboard");

  // Not a blank panel, and not a skeleton that never resolves.
  await expect(page.getByText(/create|get started|add your first|no purchase orders/i).first()).toBeVisible();
});
