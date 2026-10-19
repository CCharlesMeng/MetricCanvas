import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function featureDocument(id: string) {
  return JSON.parse(await readFile(`pages/${id}.json`, 'utf8'));
}

test('installed runtime projects the actual hierarchy page', async ({ page }) => {
  const document = await featureDocument('page-visibility-region-linkage');
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document });
  }, document);
  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.locator('[data-section-id="department-norms"]')).toBeVisible();
  await host.getByRole('tab', { name: '地区部', exact: true }).first().click();
  await expect(host.locator('[data-section-id="department-norms"]')).toHaveCount(0);
  await expect(host.locator('[data-section-id="retained-container"]')).toBeVisible();
  await expect(host.getByRole('button', { name: '条件组B', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('[data-component="rows-and-tabs/projected-table"] tbody tr')).toHaveCount(2);
  await host.getByRole('button', { name: '显示扩展内容', exact: true }).click();
  await expect(host.locator('[data-section-id="extra"]')).toBeVisible();
});

test('installed runtime keeps permission invalidation across a replaced source', async ({ page }) => {
  const document = await featureDocument('page-visibility-inputs');
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    let snapshot = { permissionRevision: 'installed-1', permissions: { 'department.read': { status: 'ready' as const, value: true } }, values: {} };
    const options = { document, displayInputs: { getSnapshot: () => snapshot, subscribe: () => () => {} } };
    window.runtime = MetricCanvas.mount('#dashboard', options);
    Object.assign(window, { replacePresentationSource() {
      snapshot = { ...snapshot, permissionRevision: 'installed-2' };
      options.displayInputs = { getSnapshot: () => snapshot, subscribe: () => () => {} };
      window.runtime.update(options);
    } });
  }, document);
  const host = page.locator('[data-metriccanvas-runtime]');
  await expect(host.locator('[data-section-id="protected"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as { replacePresentationSource(): void }).replacePresentationSource());
  await expect(host.getByText('权限会话已变化，请以当前身份重新初始化页面', { exact: true })).toBeVisible();
  await expect(host.locator('[data-section-id="protected"]')).toHaveCount(0);
});
