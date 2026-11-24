import { defineConfig, devices } from "@playwright/test";
import { readLocalWebEnvironment } from "./scripts/local-web-env.ts";

const port = 5174;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "apps/web/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Each multiplayer scenario renders two cities. Keep the software GPU available for its latency check.
  workers: 2,
  reporter: "list",
  use: {
    baseURL,
    actionTimeout: 10_000,
    // The tracker tests sign in real local users and open invitation URLs.
    trace: "off",
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { pathTemplate: "{testDir}/snapshots/{testFileName}/{projectName}/{arg}{ext}" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter @pupulta/web dev --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: { ...readLocalWebEnvironment(), VITE_ENABLE_TEST_OVERRIDES: "true" },
  },
});
