import { expect, test } from '@playwright/test';
import type { RuntimeInput } from '../../src/types';

declare global {
  interface Window {
    dataGateway: NonNullable<RuntimeInput['dataGateway']>;
    setExportPermission(permission: unknown): void;
  }
}

for (const id of ['business-decision-all-details', 'ioc-opportunity-list']) {
  test(`mount and update apply host Excel permission to ${id}`, async ({page}) => {
    await page.goto('/pages/' + id + '?mtime=2026-04');
    const table = page.locator('.table-widget').first();
    const button = table.getByRole('button', {name:'导出', exact:true});
    await expect(table).toBeVisible();
    await page.evaluate(() => {
      window.runtime.destroy();
      const original: RuntimeInput = {
        document: window.pageDocument,
        dataGateway: window.dataGateway,
        initialSearch: location.search,
        displayInputs: {
          getSnapshot: () => ({permissionRevision:'demo', values:{}, permissions:{canExport:{status:'ready',value:false}}}),
          subscribe: () => () => {}
        }
      };
      window.runtime = MetricCanvas.mount('#dashboard', {...original, permissions:{canExport:false}});
      Object.assign(window, {setExportPermission(permissions: RuntimeInput['permissions']) {
        window.runtime.update({...original, permissions});
      }});
    });
    await expect(table).toBeVisible();
    await expect(button).toHaveCount(0);
    async function update(permissions?: unknown) {
      await page.evaluate(value => window.setExportPermission(value), permissions);
    }
    await update({canExport:true});
    await expect(button).toBeVisible();
    if (id === 'ioc-opportunity-list') {
      const downloaded = page.waitForEvent('download');
      await button.click();
      expect((await downloaded).suggestedFilename()).toMatch(/\.xlsx$/);
    }
    await update({canExport:false});
    await expect(button).toHaveCount(0);
    await update({canExport:true});
    await update({});
    await expect(button).toHaveCount(0);
    await update({canExport:'true'});
    await expect(button).toHaveCount(0);
    await update(null);
    await expect(button).toHaveCount(0);
    await update();
    await expect(button).toHaveCount(id === 'ioc-opportunity-list' ? 0 : 1);
  });
}
