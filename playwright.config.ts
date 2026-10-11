import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1, // one server log, read by the abort tests
  reporter: 'list',
  use: { baseURL: 'http://localhost:4370' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && node server/server.mjs',
    url: 'http://localhost:4370/api/log',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
