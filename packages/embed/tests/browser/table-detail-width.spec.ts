import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const demo = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-detail-overlay.json', import.meta.url), 'utf8'));
const queryDemo = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));

declare global {
  interface Window { rejectDetail: (reason: Error) => void }
}

async function mountDemo(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.update({ document });
    window.document.body.style.padding = '0';
    window.document.querySelector<HTMLElement>('#dashboard')!.style.maxWidth = 'none';
  }, demo);
}

async function expectWidePanel(page: Page, drawer = false) {
  const backdrop = page.locator('.detail-backdrop');
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  const container = await backdrop.boundingBox();
  const box = await panel.boundingBox();
  expect(container).not.toBeNull();
  expect(box).not.toBeNull();
  const expected = Math.min(container!.width * 0.9, 1440, container!.width - 32);
  expect(box!.width).toBeCloseTo(expected, 0);
  const right = container!.x + container!.width - box!.x - box!.width;
  expect(right).toBeCloseTo(drawer ? 0 : (container!.width - expected) / 2, 0);
  return box!.width;
}

test('same wide rule for modal, drawer, empty results and metric entry across container sizes', async ({ page }) => {
  for (const width of [1920, 1440, 390, 280]) {
    await mountDemo(page, width);
    await page.getByRole('button', { name: '8', exact: true }).click();
    const modalWidth = await expectWidePanel(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '3', exact: true }).click();
    expect(await expectWidePanel(page, true)).toBeCloseTo(modalWidth, 0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '0', exact: true }).click();
    expect(await expectWidePanel(page)).toBeCloseTo(modalWidth, 0);
    await expect(page.getByRole('dialog')).toContainText('暂无数据');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '订单详情 8', exact: true }).click();
    expect(await expectWidePanel(page)).toBeCloseTo(modalWidth, 0);
    await page.keyboard.press('Escape');
  }
});

test('narrow embed scrolls inside the table; fields and non-table views retain their width', async ({ page }) => {
  await mountDemo(page, 1920);
  // Host width, rather than the outer browser viewport, controls the rule.
  await page.evaluate(() => { window.document.querySelector<HTMLElement>('#dashboard')!.style.width = '390px'; });
  await page.getByRole('button', { name: '8', exact: true }).click();
  expect(await expectWidePanel(page)).toBeCloseTo(351, 0);
  const scroll = await page.getByRole('dialog').locator('.scroll').evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
  expect(scroll.content).toBeGreaterThan(scroll.width);
  await page.getByRole('dialog').locator('.scroll').evaluate(element => { element.scrollLeft = 150; });
  expect(await page.getByRole('dialog').locator('.scroll').evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.document.querySelector<HTMLElement>('#dashboard')!.style.width = '1440px'; });
  await page.getByRole('button', { name: '861,000', exact: true }).click();
  expect((await page.getByRole('dialog').boundingBox())!.width).toBeCloseTo(560, 0);
  await page.keyboard.press('Escape');
  const textDocument = structuredClone(demo);
  textDocument.detailViews[0].components = [{ id: 'plain-detail', type: 'text', layout: { span: 12 }, props: { body: '普通文字详情' } }];
  await page.evaluate(document => window.runtime.update({ document }), textDocument);
  await page.getByRole('button', { name: '8', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('普通文字详情');
  expect((await page.getByRole('dialog').boundingBox())!.width).toBeCloseTo(560, 0);
});

test('query loading and failure keep the declared table width', async ({ page }) => {
  await mountDemo(page, 1440);
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: {
      fetchData() { return new Promise((_resolve, reject) => { window.rejectDetail = reject; }); }
    } });
  }, queryDemo);
  await page.getByRole('button', { name: '客户01', exact: true }).click();
  const loadingWidth = await expectWidePanel(page, true);
  await page.evaluate(() => window.rejectDetail(new Error('详情加载失败')));
  // Existing detail rendering projects a failed request to an empty table.
  await expect(page.getByRole('dialog')).toContainText('暂无数据');
  expect(await expectWidePanel(page, true)).toBeCloseTo(loadingWidth, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '客户01', exact: true })).toBeFocused();
  const missingParameter = structuredClone(queryDemo);
  missingParameter.dataSources.rows.source.rows[0].amount = null;
  missingParameter.sections[1].components[0].props.actions[0].openDetail.bindings['detail-customer'].field = 'amount';
  await page.evaluate(document => window.runtime.update({ document, dataGateway: { async fetchData() { return { rows: [] }; } } }), missingParameter);
  await page.getByRole('button', { name: '客户01', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('详情参数不完整或无效');
  expect(await expectWidePanel(page, true)).toBeCloseTo(loadingWidth, 0);
});
