import { defineConfig } from "@playwright/test";

/**
 * Config for the landing-page screenshot capture, kept separate from
 * playwright.config.ts so `npm run test:e2e` never runs it and a capture
 * never counts as a passing test suite.
 *
 * Capture is a developer command, not a CI step: it needs a running backend
 * and a seeded fixture database (see specs/003-landing-page-upgrade/quickstart.md).
 *
 * colorScheme is forced to light so a developer's dark-mode preference cannot
 * leak into a committed asset -- the landing page is light-only.
 */
export default defineConfig({
  testDir: "./scripts",
  testMatch: /capture-landing\.ts/,
  // One worker: the capture writes shared files and reads one fixture org.
  workers: 1,
  retries: 0,
  // Capture drives several screens and encodes eight images.
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:5173",
    colorScheme: "light",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
