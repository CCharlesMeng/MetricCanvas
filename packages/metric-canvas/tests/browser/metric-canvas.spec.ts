import { expect, test, type Page } from '@playwright/test';

const url = '/tests/browser/harness/index.html';
const cell = '#canvas [data-component="main/note"]';

async function counts(page: Page): Promise<{ canvas: number; runtime: number }> {
  return JSON.parse(await page.locator('[data-calls]').innerText());
}

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#canvas').getByRole('heading', { name: '成交明细' })).toBeVisible();
  await expect(page.locator('#runtime').getByRole('heading', { name: '成交明细' })).toBeVisible();
});

test('选中和控件切换保留渲染实例与查询状态，正式渲染无创作装饰', async ({ page }) => {
  await expect(page.locator('#runtime [draggable], #runtime .authoring-controls')).toHaveCount(0);
  const before = await counts(page);
  await page.locator(cell).evaluate((element) => element.setAttribute('data-instance-marker', 'original'));
  await page.locator(cell).getByRole('heading', { name: '说明' }).click();
  await expect(page.locator(cell)).toHaveClass(/authoring-selected/);
  await expect(page.locator(cell).getByRole('textbox')).toBeVisible();
  await page.getByRole('button', { name: '切换控件' }).click();
  await expect(page.locator(cell).getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: '切换编辑' }).click();
  await expect(page.locator('#canvas [draggable]')).toHaveCount(0);
  await page.getByRole('button', { name: '切换编辑' }).click();
  await expect(page.locator(cell)).toHaveAttribute('data-instance-marker', 'original');
  expect(await counts(page)).toEqual(before);
  await expect(page.locator('#runtime .authoring-selected')).toHaveCount(0);
});

test('筛选与查询分页语义一致，编辑点击拦截且切换模式不清空状态', async ({ page }) => {
  const canvas = page.locator('#canvas');
  const runtime = page.locator('#runtime');
  await page.getByRole('button', { name: '切换编辑' }).click();
  for (const host of [canvas, runtime]) {
    await host.getByRole('tab', { name: '华东' }).click();
    await expect(host.getByRole('cell', { name: '华东-1', exact: true })).toBeVisible();
    await host.getByRole('button', { name: '下一页' }).click();
    await expect(host.getByRole('cell', { name: '华东-11', exact: true })).toBeVisible();
  }
  const before = await counts(page);
  expect(before.canvas).toBe(before.runtime);
  await page.getByRole('button', { name: '切换编辑' }).click();
  // 创作选择应吞掉单元格内原本会翻页的点击。
  await canvas.getByRole('button', { name: '下一页' }).click();
  await expect(canvas.locator('[data-component="main/sales"]')).toHaveClass(/authoring-selected/);
  await expect(canvas.getByRole('cell', { name: '华东-11', exact: true })).toBeVisible();
  await expect(canvas.getByRole('tab', { name: '华东' })).toHaveAttribute('aria-selected', 'true');
  expect(await counts(page)).toEqual(before);
  await page.getByRole('button', { name: '切换编辑' }).click();
  await canvas.getByRole('button', { name: '下一页' }).click();
  await expect(canvas.getByRole('cell', { name: '华东-21', exact: true })).toBeVisible();
});

test('标题和宽度编辑回传宿主，文档更新同时影响正式渲染', async ({ page }) => {
  await page.locator(cell).getByRole('heading', { name: '说明' }).click();
  const input = page.locator(cell).getByRole('textbox');
  await input.fill('宿主保存的新标题');
  await input.press('Tab');
  await expect(page.locator('#canvas').getByRole('heading', { name: '宿主保存的新标题' })).toBeVisible();
  await expect(page.locator('#runtime').getByRole('heading', { name: '宿主保存的新标题' })).toBeVisible();
  await page.locator(cell).getByRole('button', { name: '缩小组件' }).click();
  await expect(page.locator(cell)).toHaveCSS('grid-column-start', 'span 11');
  await expect(page.locator('#runtime [data-component="main/note"]')).toHaveCSS('grid-column-start', 'span 11');
  await expect(page.locator('[data-intents]')).toContainText('edit_component');
});

test('跨分区拖拽回传意图，草稿空分区不进入正式文档', async ({ page }) => {
  await page.getByRole('button', { name: '添加空分区' }).click();
  const target = page.locator('#canvas [data-section-id="empty"] [data-drop-slot]');
  await expect(target).toBeVisible();
  await expect(page.locator('#runtime [data-section-id="empty"]')).toHaveCount(0);
  const before = await counts(page);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(cell).dispatchEvent('dragstart', { dataTransfer: transfer });
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(target).toHaveAttribute('data-drop-active', 'true');
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('#canvas [data-component="empty/note"]')).toBeVisible();
  await expect(page.locator('#runtime [data-component="main/note"]')).toBeVisible();
  expect(await counts(page)).toEqual(before);
  await expect(page.locator('[data-intents]')).toContainText('move_component');
  await transfer.dispose();
});

test('无效草稿回退正式排布，卸载后单元格不再发送创作意图', async ({ page }) => {
  await page.getByRole('button', { name: '无效草稿' }).click();
  await expect(page.locator(cell)).toBeVisible();
  await expect(page.locator('#canvas [data-section-id="bad"]')).toHaveCount(0);
  const detached = await page.locator(cell).elementHandle();
  await page.getByRole('button', { name: '挂载开关' }).click();
  await expect(page.locator('#canvas .runtime-view')).toHaveCount(0);
  await detached!.evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.locator('[data-intents]')).toHaveText('[]');
  await detached!.dispose();
  await page.getByRole('button', { name: '挂载开关' }).click();
  await expect(page.locator(cell)).toBeVisible();
  await page.getByRole('button', { name: '替换文档' }).click();
  await expect(page.locator(cell)).toBeVisible();
  await expect.poll(async () => (await counts(page)).canvas).toBeGreaterThan(1);
});

test('编辑态捕获原生链接，退出编辑后恢复浏览器跳转', async ({ page }) => {
  const link = page.locator('#canvas').getByRole('link', { name: '关联内容 →' });
  await expect(link).toHaveAttribute('href', '#linked-content');
  const before = page.url();
  await link.click();
  expect(page.url()).toBe(before);
  await expect(page.locator(cell)).toHaveClass(/authoring-selected/);
  await page.getByRole('button', { name: '切换编辑' }).click();
  await link.click();
  await expect(page).toHaveURL(/#linked-content$/);
});
