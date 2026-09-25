import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  // Shared CI runners need time to preload 245 flags and complete full game journeys.
  timeout: process.env.CI ? 60000 : 30000,
  expect: { timeout: process.env.CI ? 20000 : 7000 },
  fullyParallel: true,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: {
    command: '.venv-modernise/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8000',
    url: 'http://127.0.0.1:8000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
