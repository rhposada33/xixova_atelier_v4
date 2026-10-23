import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", workers: 1, timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:5178", headless: true, launchOptions: { executablePath: "/usr/bin/google-chrome" } },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5178/login", reuseExistingServer: false, timeout: 30_000 },
});
