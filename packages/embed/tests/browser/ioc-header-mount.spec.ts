import { expect, test } from '@playwright/test';

for (const shadowContainer of [false, true]) {
  test(`IOC header pins below the public header (outer shadow: ${shadowContainer})`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto('/pages/ioc-header-flow-sticky');
    const header = page.locator('[data-ioc-header]');
    await expect(header).toBeVisible();
    await page.evaluate(shadowContainer => {
      const publicHeader = document.createElement('header');
      publicHeader.dataset.publicHeader = '';
      publicHeader.textContent = '公共页头';
      publicHeader.style.cssText = 'position:fixed;inset:0 0 auto;height:88px;background:white;z-index:100';
      document.body.prepend(publicHeader);
      const target = document.querySelector<HTMLElement>('#dashboard')!;
      target.style.cssText = 'position:fixed;inset:88px 24px 0;overflow:auto;border:2px solid black';
      window.runtime.destroy();
      if (shadowContainer) {
        const shell = document.createElement('div');
        document.body.append(shell);
        shell.attachShadow({ mode: 'open' }).append(target);
      }
      window.runtime = MetricCanvas.mount(target, { document: window.pageDocument });
    }, shadowContainer);
    await header.getByRole('button', { name: '月', exact: true }).click();
    await page.locator('#dashboard').evaluate(node => { node.scrollTop = 650; });
    await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
    await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(90, 0);
    await expect(header.getByRole('combobox')).toHaveValue('2026-01');
    await page.locator('#dashboard').evaluate(node => { node.style.top = '120px'; });
    await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(122, 0);
    await page.locator('#dashboard').evaluate(node => { node.scrollTop = 0; });
    await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);
    await expect(header.getByRole('combobox')).toHaveValue('2026-01');
  });
}
