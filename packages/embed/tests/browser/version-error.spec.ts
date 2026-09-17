import { expect, test } from '@playwright/test';
import { supportedVersions, versionPolicy } from '@metriccanvas/page';
import type { MountOptions } from '../../src/types';

const supported = supportedVersions();
const [major, minor] = versionPolicy.current.split('.').map(Number);
const futureMajor = `${major + 1}.0`;
const futureMinor = `${major}.${minor + 1}`;

for (const mode of ['classic', 'esm'] as const) {
  test(`${mode} 版本失败关闭、宿主事件分类与更新恢复`, async ({ page }) => {
    await page.goto('/examples/query.html');
    const host = page.locator('[data-metriccanvas-runtime]');
    await expect(host.getByRole('table')).toBeVisible();
    await page.evaluate(async ({ mode, futureMajor }) => {
      window.queryRuntime.destroy();
      window.queryEvents = [];
      window.queryCalls = [];
      // 示例自带首屏快照；移除它以实证恢复后真的执行查询。
      delete window.queryPageDocument.dataSources.sales.source.initial;
      const esmUrl = '/dist/metriccanvas-runtime.es.js';
      const mount = mode === 'classic' ? MetricCanvas.mount : (await import(esmUrl)).mount;
      const options: MountOptions = {
        document: { ...window.queryPageDocument, schemaVersion: futureMajor },
        dataGateway: {
          async fetchData() {
            window.queryCalls.push({});
            return { rows: [] };
          }
        },
        onEvent: (event) => window.queryEvents.push(event)
      };
      window.missingRuntime = mount('#dashboard', options);
    }, { mode, futureMajor });
    await expect(host.getByRole('heading', { name: '引擎不支持页面协议版本' })).toBeVisible();
    expect(await page.evaluate(() => ({ events: window.queryEvents, calls: window.queryCalls })))
      .toMatchObject({
        calls: [],
        events: [{ type: 'version-error', requiredSchemaVersion: futureMajor, currentSchemaVersion: versionPolicy.current, supportedSchemaVersions: supported }]
      });
    await expect(host.getByRole('table')).toHaveCount(0);

    // Recover the example's declared version, every compatible 5.x input, and
    // the current protocol. 5.x is normalized by the shared runtime before
    // it renders; do not use this as a way to author newer capabilities.
    const originalVersion = await page.evaluate(() => window.queryPageDocument.schemaVersion);
    for (const schemaVersion of new Set([originalVersion, '5.0', '5.1', '5.2', '5.3', '5.4', versionPolicy.current])) {
      await page.evaluate((schemaVersion) => {
        window.queryEvents = [];
        window.queryCalls = [];
        window.missingRuntime.update({
          document: { ...window.queryPageDocument, schemaVersion },
          dataGateway: { async fetchData() { window.queryCalls.push({}); return { rows: [{ region: `恢复查询 ${schemaVersion}`, gmv: 42 }], totalCount: 1 }; } }
        });
      }, schemaVersion);
      await expect(host.getByRole('table')).toBeVisible();
      await expect(host.getByText(`恢复查询 ${schemaVersion}`, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.queryCalls.length)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.queryEvents.some((event) => event.type === 'ready'))).toBe(true);
    }

    for (const schemaVersion of [futureMinor, `${major - 2}.4`]) {
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
