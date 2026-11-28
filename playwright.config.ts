import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    headless: true,
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: [
    {
      command: "npx tsx bff/server.ts",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 8080",
      url: "http://127.0.0.1:8080",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
    },
  ],
});
