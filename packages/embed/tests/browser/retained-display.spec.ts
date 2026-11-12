import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/layout/metric-card-loading.json', import.meta.url), 'utf8'));
const rows: Record<string, unknown>[] = JSON.parse(readFileSync(new URL('../../../../tools/dqe-sim/fixtures/loading-structure-gallery.json', import.meta.url), 'utf8'));

test('same-instance page returns keep old display until the new response, while a new gateway clears it', async ({ page }) => {
  let release: () => void = () => {};
  let pending = Promise.resolve();
  let multiplier = 1;
  await page.route('**/retained-display-dqe', async route => {
    await pending;
    const request = route.request().postDataJSON();
    expect(request.dsl_list).toHaveLength(1);
    const data = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? value * multiplier : value])));
    await route.fulfill({ json: { retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data, total_count: data.length }] } });
  });
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.__iocGateway = MetricCanvas.createDqeGateway({ endpoint: '/retained-display-dqe' });
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: window.__iocGateway });
  }, document);
  const first = page.locator('.metric-card .row-value').first();
  await expect(first).toHaveText('72');
  await page.evaluate(document => window.runtime.update({ document: { ...document, id: 'other-loading-page' }, dataGateway: window.__iocGateway }), document);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  pending = new Promise<void>(resolve => { release = resolve; });
  multiplier = 2;
  await page.evaluate(document => window.runtime.update({ document, dataGateway: window.__iocGateway }), document);
  await expect(page.locator('[data-retained="true"]')).toHaveCount(8);
  await expect(first).toHaveText('72');
  await expect(page.locator('.loading-spinner')).toHaveCount(0);
  await expect(page.locator('.widget-content').first()).toHaveAttribute('inert', '');
  release();
  await expect(first).toHaveText('144');
  await expect(page.locator('[data-retained="true"]')).toHaveCount(0);

  pending = new Promise<void>(resolve => { release = resolve; });
  await page.evaluate(document => window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway({ endpoint: '/retained-display-dqe' }) }), document);
  await expect(first).toHaveText('--');
  await expect(page.locator('[data-retained="true"]')).toHaveCount(0);
  release();
  await expect(first).toHaveText('144');
});
