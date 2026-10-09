import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * Refuses to run against a non-local database.
   *
   * This suite signs up through the real API, so every run writes an
   * organization, a user, parties, orders and dispatches wherever the backend
   * points. The landing fixture script already refuses a remote host; the
   * suite that writes far more had no such guard.
   */
  globalSetup: "./tests/e2e/globalSetup.ts",
  /**
   * One worker.
   *
   * The suite shares a single dev server and a single-process backend. At two
   * workers a dispatch POST was intermittently exceeding the client's 12s
   * request deadline (REQUEST_TIMEOUT_MS), which the app correctly turns into
   * "we couldn't record that dispatch" -- a real failure, caused by the test
   * environment rather than by the code under test. Parallelism here buys very
   * little anyway: the tests wait on I/O against one backend, so two workers
   * mostly queue behind each other.
   *
   * This is a release-gate suite. Being slower and trustworthy beats being
   * quicker and occasionally wrong.
   */
  workers: 1,
  /**
   * 10s rather than Playwright's 5s. Nearly every assertion here is a read
   * against a single-process backend shared with the other worker, and the
   * slow ones are reads straight after a write, where the screen legitimately
   * shows a loading state first. A wrong value still fails; only a slow one is
   * forgiven.
   */
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
