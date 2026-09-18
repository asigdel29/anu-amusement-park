/**
 * Playwright configuration — behaviour that needs a real browser.
 *
 * Contract: `npm run test:e2e` builds nothing; it starts the production server
 * against an existing build and runs every spec in `e2e/` against it.
 *
 * Why the production server rather than `next dev`: the park's cost model is
 * entirely about shipped bytes and a compiled bundle. A dev-server run would
 * measure the dev server, and the no-JavaScript path behaves differently under
 * Fast Refresh. This costs a build before the suite and is worth it.
 *
 * Projects cover the three engines that matter for a WebGL site, plus a mobile
 * viewport. `webkit` is not optional here: it is the engine every iOS visitor
 * uses regardless of which browser they think they are running.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] } },
  ],

  webServer: {
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
