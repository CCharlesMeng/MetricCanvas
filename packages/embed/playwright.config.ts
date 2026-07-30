import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: 'chrome',
    headless: true
  },
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:4175/examples/inline.html',
    reuseExistingServer: true
  }
});
