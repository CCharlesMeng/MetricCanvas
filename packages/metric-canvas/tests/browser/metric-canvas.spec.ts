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
  await page.locator(cell).getByRole('button', { name: '拖动组件 note', exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer });
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

for (const schemaVersion of ['6.0', '6.1']) {
  for (const layout of ['report', 'dashboard']) {
    test(`${schemaVersion} ${layout} 进入搭建画布与正式渲染后保持规范布局`, async ({ page }) => {
      await page.goto(`${url}?schemaVersion=${schemaVersion}&layout=${layout}`);
      for (const host of ['#canvas', '#runtime']) {
        await expect(page.locator(`${host} [data-page-layout-form]`)).toHaveAttribute('data-page-layout-form', layout);
        await expect(page.locator(`${host} [data-component="main/note"]`)).toHaveCSS('grid-column-start', 'span 12');
      }
      const original = JSON.parse(await page.locator('[data-document]').textContent() ?? '{}');
      expect(original).toMatchObject({ schemaVersion: '6.5', layout });
      expect(original).not.toHaveProperty('layoutForm');
      await page.locator(cell).getByRole('heading', { name: '说明' }).click();
      const input = page.locator(cell).getByRole('textbox');
      await input.fill('布局迁移后的修改');
      await input.press('Tab');
      await expect(page.locator('#runtime').getByRole('heading', { name: '布局迁移后的修改' })).toBeVisible();
      const edited = JSON.parse(await page.locator('[data-document]').textContent() ?? '{}');
      expect(edited).toMatchObject({ schemaVersion: '6.5', layout, dataSources: original.dataSources });
      expect(edited).not.toHaveProperty('layoutForm');
    });
  }
}


test('组件主体不发起拖动，手柄原生拖动到整行下半区且结束后清除反馈', async ({ page }) => {
  // Keep both native-drag endpoints visible with the OS table's 48px rows.
  await page.setViewportSize({ width: 1280, height: 1600 });
  const source = page.locator(cell);
  await expect(source).not.toHaveAttribute('draggable', 'true');
  await source.hover();
  const handle = source.getByRole('button', { name: '拖动组件 note', exact: true });
  await expect(handle).toHaveAttribute('draggable', 'true');
  await page.getByRole('button', { name: '添加空分区' }).click();
  const target = page.locator('#canvas [data-section-id="empty"] [data-drop-slot]');
  await expect(handle).toBeInViewport();
  await expect(target).toBeInViewport();
  await handle.dragTo(target);
  await expect(page.locator('#canvas [data-component="empty/note"]')).toBeVisible();
  await expect(page.locator('#canvas .authoring-is-dragging')).toHaveCount(0);
  await expect(page.locator('#canvas [data-drop-active="true"]')).toHaveCount(0);
});

test('外部拖入被忽略，组件可用键盘选择且停用时不暴露手柄', async ({ page }) => {
  const source = page.locator(cell);
  await source.focus();
  await page.keyboard.press('Enter');
  await expect(source).toHaveClass(/authoring-selected/);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragover', { dataTransfer: transfer, clientX: 0, clientY: 0 });
  await expect(page.locator('#canvas [data-drop-active="true"]')).toHaveCount(0);
  await source.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('[data-intents]')).not.toContainText('move_component');
  await page.getByRole('button', { name: '切换编辑' }).click();
  await expect(page.locator('#canvas .authoring-toolbar')).toHaveCount(0);
  await transfer.dispose();
});


test('带内边距的分区按实际内容宽度识别整行，落点横线与取消反馈正确', async ({ page }) => {
  await page.goto(`${url}?container=panel`);
  const source = page.locator('#canvas [data-component="main/sales"]');
  const target = page.locator(cell);
  await expect(target).toHaveClass(/authoring-full-row/);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.getByRole('button', { name: '拖动组件 sales', exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer });
  const bounds = await target.boundingBox();
  await target.dispatchEvent('dragover', { dataTransfer: transfer, clientX: bounds!.x + bounds!.width * .8, clientY: bounds!.y + bounds!.height * .25 });
  const before = target.locator('[data-drop-index="0"]');
  await expect(before).toHaveAttribute('data-drop-active', 'true');
  expect(await before.evaluate(node => getComputedStyle(node, '::after').height)).toBe('3px');
  await page.evaluate(() => window.dispatchEvent(new DragEvent('dragend')));
  await expect(page.locator('#canvas [data-drop-active="true"]')).toHaveCount(0);
  await expect(page.locator('[data-intents]')).not.toContainText('move_component');
  await transfer.dispose();
});


test('C 选中条跟随组件、发送边界正确的意图，蓝色细框不拦截选择', async ({ page }) => {
  await page.goto(`${url}?controls=contextual&delete=true`);
  const source = page.locator(cell);
  await source.getByRole('heading', { name: '说明' }).click();
  const actions = page.getByRole('group', { name: '组件操作 note', exact: true });
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button', { name: '上移组件', exact: true })).toBeDisabled();
  await expect(actions.getByRole('button', { name: '下移组件', exact: true })).toBeEnabled();
  await expect(source).toHaveCSS('border-top-left-radius', '6px');
  const edge = await source.evaluate(node => { const style=getComputedStyle(node,'::after'); return { gradient:style.backgroundImage, padding:style.paddingTop, events:style.pointerEvents }; });
  expect(edge.gradient).toContain('rgb(23, 107, 250)');
  expect(edge.padding).toBe('1.5px');
  expect(edge.events).toBe('none');
  await actions.getByRole('button', { name: '下移组件', exact: true }).click();
  await expect(page.locator('[data-intents]')).toContainText('"index":2');
  await actions.getByRole('button', { name: '删除组件 note', exact: true }).click();
  await expect(page.locator('[data-intents]')).toContainText('delete_component');
  await page.locator('#canvas [data-component="main/sales"]').getByRole('heading', { name: '成交明细' }).click();
  await expect(page.getByRole('group', { name: '组件操作 sales', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '组件操作 sales', exact: true }).getByRole('button', { name: '下移组件', exact: true })).toBeDisabled();
  await expect(page.getByRole('group', { name: '组件操作 note', exact: true })).toHaveCount(0);
});

test('C 操作条滚出视野后隐藏，滚回与调整尺寸后重新定位，停用及卸载无残留', async ({ page }) => {
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}?controls=contextual`);
  const source = page.locator(cell);
  await source.getByRole('heading', { name: '说明' }).click();
  const actions = page.getByRole('group', { name: '组件操作 note', exact: true });
  await expect(actions).toBeVisible();
  await page.evaluate(() => window.scrollTo(0,document.body.scrollHeight));
  await expect(page.locator('.selection-actions')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0,0));
  await expect(actions).toBeVisible();
  await page.locator('#canvas').evaluate(node => (node as HTMLElement).style.width='720px');
  await expect.poll(async () => { const box=await actions.boundingBox(),cellBox=await source.boundingBox(); return box&&cellBox?Math.abs(box.x+box.width-cellBox.x-cellBox.width):100; }).toBeLessThan(2);
  await page.getByRole('button', { name: '切换编辑', exact: true }).click();
  await expect(page.locator('.selection-actions')).toHaveCount(0);
  await page.getByRole('button', { name: '切换编辑', exact: true }).click();
  await expect(actions).toBeVisible();
  await page.getByRole('button', { name: '挂载开关', exact: true }).click();
  await expect(page.locator('.selection-actions')).toHaveCount(0);
  await page.evaluate(() => { window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize')); });
  expect(errors).toEqual([]);
});
