import { expect, test } from '@playwright/test';
import type { MountOptions } from '../../src/types';

for (const mode of ['classic', 'esm'] as const) {
  test(`${mode} 版本失败关闭、宿主事件分类与更新恢复`, async ({ page }) => {
    await page.goto('/examples/query.html');
    const host = page.locator('[data-metriccanvas-runtime]');
    await expect(host.getByRole('table')).toBeVisible();
    await page.evaluate(async (mode) => {
      window.queryRuntime.destroy();
      window.queryEvents = [];
      window.queryCalls = [];
      // 示例自带首屏快照；移除它以实证恢复后真的执行查询。
      delete window.queryPageDocument.dataSources.sales.source.initial;
      const esmUrl = '/dist/metriccanvas-runtime.es.js';
      const mount = mode === 'classic' ? MetricCanvas.mount : (await import(esmUrl)).mount;
      const options: MountOptions = {
        document: { ...window.queryPageDocument, schemaVersion: '7.0' },
        dataGateway: {
          async fetchData() {
            window.queryCalls.push({});
            return { rows: [] };
          }
        },
        onEvent: (event) => window.queryEvents.push(event)
      };
      window.missingRuntime = mount('#dashboard', options);
    }, mode);
    await expect(host.getByRole('heading', { name: '引擎不支持页面协议版本' })).toBeVisible();
    expect(await page.evaluate(() => ({ events: window.queryEvents, calls: window.queryCalls })))
      .toMatchObject({
        calls: [],
        events: [{ type: 'version-error', requiredSchemaVersion: '7.0', currentSchemaVersion: '6.0', supportedSchemaVersions: ['6.0'] }]
      });
    await expect(host.getByRole('table')).toHaveCount(0);

    await page.evaluate(() => window.missingRuntime.update({
      document: window.queryPageDocument,
      dataGateway: { async fetchData() { window.queryCalls.push({}); return { rows: [{ region: '恢复查询', gmv: 42 }], totalCount: 1 }; } }
    }));
    await expect(host.getByRole('table')).toBeVisible();
    await expect(host.getByText('恢复查询')).toBeVisible();
    expect(await page.evaluate(() => window.queryCalls.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.queryEvents.some((event) => event.type === 'ready'))).toBe(true);

    for (const schemaVersion of ['6.1', '5.4']) {
      await page.evaluate((schemaVersion) => {
        window.queryEvents = [];
        window.queryCalls = [];
        window.missingRuntime.update({
          document: { ...window.queryPageDocument, schemaVersion },
          dataGateway: { async fetchData() { window.queryCalls.push({}); return { rows: [] }; } }
        });
      }, schemaVersion);
      await expect(host.getByText(`页面需要协议版本 ${schemaVersion}`, { exact: false })).toBeVisible();
      expect(await page.evaluate(() => window.queryCalls)).toEqual([]);
      expect(await page.evaluate(() => window.queryEvents.map((event) => event.type))).toEqual(['version-error']);
      await expect(host.getByRole('table')).toHaveCount(0);
    }
    await page.evaluate(() => {
      window.queryEvents = [];
      window.missingRuntime.update({ document: { ...window.queryPageDocument, schemaVersion: 'bad' } });
    });
    await expect(host.getByRole('heading', { name: '页面文档未通过校验' })).toBeVisible();
    expect(await page.evaluate(() => window.queryEvents.map((event) => event.type))).toEqual(['invalid']);
  });
}
