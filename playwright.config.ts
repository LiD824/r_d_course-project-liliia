import { defineConfig } from '@playwright/test';

/**
 * E2E configuration — checkout flow of the Merchant Payment Service.
 *
 * The service is a running Docker container (black box), not started by
 * Playwright. Point WEB_URL at it (default http://localhost:3000).
 *
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reports/playwright' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
