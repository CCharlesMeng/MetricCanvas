import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { McExportRequest } from '../../src';

test('hands displayed cells to OM once and settles each host outcome', async ({ page }) => {
  await page.goto('/examples/table-export-handler.html');
  const button = page.getByRole('button', { name: '导出', exact: true });
  const downloads: string[] = [];
  page.on('download', file => downloads.push(file.suggestedFilename()));
  await button.click();
  const request: McExportRequest = JSON.parse(await page.locator('pre').textContent() ?? '{}');
  expect(request.fileName).toBe('表格箭头');
  expect(request.meta).toEqual({ pageId: 'table-trend-arrows', componentId: 'trend-table', rowCount: 8 });
  expect(request.sheets[0].header[1].slice(0, 3)).toEqual(['', '收入变化 · 默认前置', '耗时变化 · 反向后置']);
  expect(request.sheets[0].rows[0]).toEqual(['正值', '↑ +2.5 万元', '+2.5 天 ↓', '+2.5% ↓', '+2.5 天', '+2.5 天', '+2.5 天', '已达标']);
  expect(request.sheets[0].rows[3][1]).toBe('—');
  await expect(page.getByRole('button', {name: '取消导出'})).toBeVisible();
  await page.getByRole('button', {name: '模拟提交'}).click();
  await expect(page.locator('#status')).toContainText('已提交 MOCK-001');
  for (const name of ['模拟确认拆分', '取消任务']) {
    await button.click();
    await page.getByRole('button', {name}).click();
    await expect(button).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await button.click();
  await page.getByRole('button', {name: '模拟接口失败'}).click();
  await expect(page.getByRole('alert')).toContainText('模拟导出接口调用失败');
  await button.click();
  await page.getByRole('button', {name: '取消导出'}).click();
  await expect(page.locator('#status')).toContainText('MC 已取消');
  await expect(button).toBeEnabled();
  expect(downloads).toEqual([]);
});

test('updates only the handler during a pending export and preserves filtered rows', async ({page}) => {
  const fixture = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
  await page.goto('/examples/inline.html');
  await page.evaluate(doc => {
    window.runtime.destroy();
    window.pageDocument = doc;
    window.runtime = MetricCanvas.mount('#dashboard', { document: doc, exportHandler: ({signal}) => {
      signal.addEventListener('abort', () => { document.body.dataset.aborted = 'yes'; });
      return new Promise(() => {});
    } });
  }, fixture);
  const search = page.getByRole('searchbox');
  await search.fill('客户2');
  await expect(page.locator('tbody tr')).toHaveCount(7);
  const button = page.getByRole('button', {name:'导出', exact:true});
  await button.click();
  await page.evaluate(() => {
    window.runtime.update({document: window.pageDocument, exportHandler: async request => {
      document.body.dataset.count = String(request.meta.rowCount);
      return {status:'submitted'};
    }});
  });
  await page.getByRole('button', {name: '取消导出'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-aborted', 'yes');
  await expect(search).toHaveValue('客户2');
  await button.click();
  await expect(page.locator('body')).toHaveAttribute('data-count', '7');
  await page.evaluate(() => window.runtime.update({document: window.pageDocument}));
  const download = page.waitForEvent('download');
  await button.click();
  expect((await download).suggestedFilename()).toBe('客户明细.xlsx');
});

test('exports all detail rows and aborts a pending request when the detail closes', async ({page}) => {
  const doc = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));
  const table = doc.detailViews[0].components[0];
  table.props.toolbar = {export:{format:'xlsx'}};
  await page.goto('/examples/inline.html');
  await page.evaluate(doc => {
    window.runtime.update({
      document:doc,
      dataGateway:{async fetchData() {
        return {rows:Array.from({length:15}, (_,index) => ({period:String(index + 1),value:index + 1})), totalCount:15};
      }},
      exportHandler: request => {
        document.body.dataset.detailCount = String(request.meta.rowCount);
        request.signal.addEventListener('abort', () => { document.body.dataset.detailAbort = 'yes'; });
        return new Promise(() => {});
      }
    });
  }, doc);
  await page.getByRole('button', {name:'客户01', exact:true}).click();
  const detail = page.getByRole('dialog');
  await expect(detail.locator('tbody tr')).toHaveCount(10);
  await detail.getByRole('button', {name:'导出',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-detail-count','15');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-detail-abort','yes');
});
