import { expect, test } from '@playwright/test';

for (const mode of ['classic', 'esm'] as const) {
  for (const layout of ['report', 'dashboard'] as const) {
    test(`${mode} 新旧 ${layout} 文档渲染等价且非法文档失败关闭`, async ({ page }) => {
      await page.goto('/examples/inline.html');
      await page.evaluate(async ({ mode, layout }) => {
        window.runtime.destroy();
        const url = '/dist/metriccanvas-runtime.es.js';
        const mount = mode === 'classic' ? MetricCanvas.mount : (await import(url)).mount;
        delete window.pageDocument.layout;
        window.runtime = mount('#dashboard', { document: { ...window.pageDocument, schemaVersion: '6.5', layoutForm: layout } });
      }, { mode, layout });
      const surface = page.locator('[data-page-layout-form]');
      await expect(surface).toHaveAttribute('data-page-layout-form', layout);
      await expect(surface.getByText('128,600')).toBeVisible();
      const before = await surface.evaluate(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, components: [...el.querySelectorAll('[data-component-id]')].map(c => ({ id: c.getAttribute('data-component-id'), width: c.getBoundingClientRect().width })) }));
      await page.evaluate(layout => window.runtime.update({ document: { ...window.pageDocument, schemaVersion: '6.5', layout } }), layout);
      await expect(surface).toHaveAttribute('data-page-layout-form', layout);
      const after = await surface.evaluate(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, components: [...el.querySelectorAll('[data-component-id]')].map(c => ({ id: c.getAttribute('data-component-id'), width: c.getBoundingClientRect().width })) }));
      expect(after).toEqual(before);
      for (const layoutForm of ['report', 'dashboard']) {
        await page.evaluate(({ layout, layoutForm }) => window.runtime.update({ document: { ...window.pageDocument, schemaVersion: '6.5', layout, layoutForm } }), { layout, layoutForm });
        await expect(page.getByText('layout 与 layoutForm 不得同时声明；仅保留一个布局真源', { exact: false })).toBeVisible();
        await expect(surface).toHaveCount(0);
      }
    });
  }
}
