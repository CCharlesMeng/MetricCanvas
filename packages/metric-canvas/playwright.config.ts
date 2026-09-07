import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4176',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 }
  },
  webServer: {
    command: 'vite --host 127.0.0.1 --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176/tests/browser/harness/index.html',
    reuseExistingServer: false
  }
});
