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

/** Constitution Principle XXII's touch-target floor, in CSS pixels. */
const MIN_TOUCH_TARGET = 44;

/**
 * Every control a user can touch on the given screen measures at least 44x44.
 *
 * The figure applies to the touch target, not the glyph: a 20px icon inside a
 * 44px padded button passes, and is usually the right implementation.
 *
 * This existed as a requirement before it existed as a check, which is why the
 * app shell's menu buttons sat at 36px -- the first two controls a phone user
 * touches. A requirement nothing measures goes stale at the next layout
 * change, and nobody notices until a clerk at a loading gate does.
 */
async function expectTouchTargets(page: import("@playwright/test").Page, where: string) {
  const tooSmall = await page.evaluate((min) => {
    const selector = "button, a[href], input, select, textarea, [role=button]";
    const offenders: { tag: string; label: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      // Zero-size elements are not rendered controls (collapsed menus, hidden
      // inputs); they cannot be touched, so they are not touch targets.
      if (box.width === 0 || box.height === 0) continue;
      if (box.width + 0.5 < min || box.height + 0.5 < min) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          label:
            el.getAttribute("aria-label") ??
            (el.textContent ?? "").trim().slice(0, 40) ??
            "",
          w: Math.round(box.width),
          h: Math.round(box.height),
        });
      }
    }
    return offenders;
  }, MIN_TOUCH_TARGET);

  expect(
    tooSmall,
    `${where}: controls below ${MIN_TOUCH_TARGET}px — ` +
      tooSmall.map((o) => `${o.tag}"${o.label}" ${o.w}x${o.h}`).join(", "),
  ).toEqual([]);
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

/**
 * Spec FR-006 to FR-009, SC-003, SC-004: the dispatch path measured rather
 * than asserted.
 *
 * 390px is the design target; 320 is the narrowest phone still in use and 430
 * the widest common one. Every width is checked, because a layout that holds
 * at 390 can still trap a 320px screen.
 */
test("every control on the dispatch path is comfortable at phone widths", async ({ page }) => {
  const unique = uid();
  await signUp(page, unique);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`TCH-${unique}`);
  await page.getByLabel("Party Name").fill("Touch Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "Touch Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill("100");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/(?!new)[^/]+$/);
  const poUrl = page.url();

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const [label, url] of [
      ["purchase order list", "/purchase-orders"],
      ["purchase order detail", poUrl],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: /add dispatch/i })).toBeVisible({
        timeout: 15_000,
      }).catch(() => undefined); // The list has no such button; detail does.
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page, `${label} at ${width}px`);
    }

    // The menu drawer is part of the path -- it is how a phone user reaches
    // the list in the first place.
    await page.goto("/purchase-orders");
    await page.getByRole("button", { name: /open menu/i }).click();
    await expectTouchTargets(page, `navigation drawer at ${width}px`);
    await page.getByRole("button", { name: /close menu/i }).click();
  }
});

test("the dispatch form's primary action spans the screen and sits below the fields", async ({
  page,
}) => {
  const unique = uid();
  await signUp(page, unique);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`FW-${unique}`);
  await page.getByLabel("Party Name").fill("Full Width Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);

  await page.goto("/purchase-orders/new");
  await page.getByRole("combobox").selectOption({ label: "Full Width Party" });
  await page.getByLabel("PO Number").fill(`PO-${unique}`);
  await page.getByLabel("Material").fill("Steel");
  await page.getByLabel("Ordered Qty").fill("100");
  await page.getByLabel("Unit").fill("ton");
  await page.getByLabel("Due Date").fill("2027-01-01");
  await page.getByRole("button", { name: /create purchase order/i }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/(?!new)[^/]+$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const submit = page.getByRole("button", { name: /add dispatch/i });
  const qty = page.getByRole("spinbutton", { name: /qty/i });
  await expect(submit).toBeVisible();

  const submitBox = (await submit.boundingBox())!;
  const qtyBox = (await qty.boundingBox())!;

  // Full width: within a few pixels of the field above it, rather than a small
  // inline button a thumb has to aim for.
  expect(
    Math.abs(submitBox.width - qtyBox.width),
    `submit is ${Math.round(submitBox.width)}px wide against a ${Math.round(qtyBox.width)}px field`,
  ).toBeLessThanOrEqual(4);

  // Below the last field in document flow. A submit pinned to the bottom of
  // the viewport is where an on-screen keyboard covers it -- which Playwright
  // cannot render, so it is kept out of that position by construction and
  // verified for real on a device (research R13).
  expect(submitBox.y).toBeGreaterThan(qtyBox.y);
});

test("a numeric keypad is requested for quantity", async ({ page }) => {
  const unique = uid();
  await signUp(page, unique);

  await page.goto("/parties/new");
  await page.getByLabel("Party Code").fill(`NK-${unique}`);
  await page.getByLabel("Party Name").fill("Keypad Party");
  await page.getByRole("button", { name: /save party/i }).click();
  await expect(page).toHaveURL(/\/parties\/(?!new)[^/]+$/);

  await page.goto("/purchase-orders/new");
  await expect(page.getByLabel("Ordered Qty")).toHaveAttribute("inputmode", "decimal");
});
