import { defineConfig, devices } from "@playwright/test";

/**
 * Runs e2e specs against a production build (`next build && next start`)
 * rather than the dev server, so tests exercise the same output users get.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // `exactOptionalPropertyTypes` forbids explicitly assigning `undefined`
  // to an optional property - the key must be omitted entirely to mean
  // "use the default," so this is spread in conditionally instead of
  // set to `undefined`.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
