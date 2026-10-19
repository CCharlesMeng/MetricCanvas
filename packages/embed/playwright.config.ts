import { defineConfig } from '@playwright/test';

const port = process.env.MC_EMBED_EXAMPLE_PORT ?? '4175';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: 'chrome',
    headless: true
  },
  webServer: {
    command: 'node tests/serve.mjs',
    url: `http://127.0.0.1:${port}/examples/inline.html`,
    reuseExistingServer: true
  }
});
