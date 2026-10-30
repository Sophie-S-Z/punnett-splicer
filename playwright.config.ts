import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: process.env.PUNNETT_TEST_URL ?? "http://127.0.0.1:3104",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
});
