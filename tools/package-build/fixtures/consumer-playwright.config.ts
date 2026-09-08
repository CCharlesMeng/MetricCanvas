import { defineConfig } from '@playwright/test';

const browsers = (process.env.METRICCANVAS_TEST_BROWSERS ?? 'chrome,msedge').split(',');
for (const browser of browsers) {
  if (!['chrome', 'msedge'].includes(browser)) throw new Error(`Unsupported browser ${browser}`);
}

export default defineConfig({
  timeout: 30_000,
  workers: 1,
  retries: 0,
  globalSetup: './browser-versions.mjs',
  reporter: [['line'], ['json', { outputFile: 'browser-results.json' }]],
  projects: browsers.flatMap((browser) => {
    const launch = browser === 'msedge' && process.env.METRICCANVAS_EDGE_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.METRICCANVAS_EDGE_EXECUTABLE } }
      : { channel: browser };
    return [
      { name: `embed-${browser}`, testDir: './packages/embed/tests/browser', use: { ...launch, baseURL: 'http://127.0.0.1:4175', headless: true } },
      { name: `canvas-${browser}`, testDir: './packages/metric-canvas/tests/browser', use: { ...launch, baseURL: 'http://127.0.0.1:4176', headless: true, viewport: { width: 1280, height: 900 } } }
    ];
  }),
  webServer: [
    { command: 'node packages/embed/tests/serve.mjs', url: 'http://127.0.0.1:4175/examples/inline.html', reuseExistingServer: false },
    { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176/tests/browser/harness/index.html', reuseExistingServer: false }
  ]
});
