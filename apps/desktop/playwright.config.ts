import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/playwright/results.xml" }],
    ["html", { outputFolder: "test-results/playwright/html", open: "never" }],
  ],
  outputDir: "test-results/playwright/artifacts",
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@a11y-e2e/,
    },
    {
      name: "a11y",
      use: { ...devices["Desktop Chrome"] },
      grep: /@a11y-e2e/,
    },
  ],
  webServer: {
    command: "npm run dev -- --host --port 1420",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120 * 1000,
  },
});
