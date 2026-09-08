import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

export default async function () {
  const versions = {};
  for (const channel of (process.env.METRICCANVAS_TEST_BROWSERS ?? 'chrome,msedge').split(',')) {
    const options = channel === 'msedge' && process.env.METRICCANVAS_EDGE_EXECUTABLE
      ? { executablePath: process.env.METRICCANVAS_EDGE_EXECUTABLE }
      : { channel };
    const browser = await chromium.launch({ ...options, headless: true });
    versions[channel] = browser.version();
    await browser.close();
  }
  writeFileSync('browser-versions.json', JSON.stringify(versions, null, 2) + '\n');
}
