import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * The whole suite shares one dev server and one single-process backend, so
   * past about two browsers the tests queue behind each other rather than
   * running faster: screens sit in their loading state longer than the default
   * 5s expect timeout and the suite fails for lack of capacity, not for lack of
   * correctness. Wall-clock time is unchanged -- these tests are waiting on I/O,
   * not on CPU.
   */
  workers: 2,
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
