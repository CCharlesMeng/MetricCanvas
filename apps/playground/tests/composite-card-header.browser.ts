import { expect, test, type Locator } from '@playwright/test';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

async function expectCenteredToTheRight(heading: Locator, control: Locator) {
  await expect(control).toBeVisible();
  await expect.poll(async () => {
    const title = (await heading.boundingBox())!;
    const filter = (await control.boundingBox())!;
    return {
      centerDifference: Math.abs((title.y + title.height / 2) - (filter.y + filter.height / 2)),
      onTheRight: title.x + title.width <= filter.x
    };
  }).toEqual({ centerDifference: expect.closeTo(0, 0), onTheRight: true });
}

async function expectBelow(heading: Locator, control: Locator) {
  await expect(control).toBeVisible();
  await expect.poll(async () => {
    const title = (await heading.boundingBox())!;
    const filter = (await control.boundingBox())!;
    return filter.y - (title.y + title.height);
  }).toBeGreaterThan(0);
}

test('left and right filters share a row below the title', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/filter-group-parallel-selects');
  const heading = page.getByRole('heading', { name: '经营趋势', exact: true });
  const header = page.locator('.composite-header').filter({ has: heading });
  const left = header.getByRole('button', { name: '营业收入', exact: true });
  const right = header.locator('.toolbar-end button[aria-haspopup]');
  await expect(heading).toBeVisible();
  await expect(right).toHaveCount(2);
  await expectBelow(heading, left);
  for (const control of await right.all()) {
    await expectCenteredToTheRight(left, control);
  }
  await expect(heading).toHaveCSS('font-weight', '600');
  await expect(heading).toHaveCSS('font-family', '"PingFang SC", sans-serif');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectBelow(heading, left);
  await expectBelow(heading, right.first());
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('IOC cards move the toolbar when Region hides or reveals the left filter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/business-result-metrics?region=R99&region.level=geo');
  const region = page.locator('[data-ioc-header] [data-filter-id="region"]');
  const closureTitle = page.getByRole('heading', { name: '决策意见闭环率', exact: true });
  const closureHeader = page.locator('.composite-header').filter({ has: closureTitle });
  const closureLeft = closureHeader.getByRole('button', { name: '中国区', exact: true });
  const closureRight = closureHeader.locator('.toolbar-end button[aria-haspopup]');
  const frameworkTitle = page.getByRole('heading', { name: '框架执行情况', exact: true });
  const frameworkHeader = page.locator('.composite-header').filter({ has: frameworkTitle });
  const frameworkLeft = frameworkHeader.getByRole('button', { name: '中国区', exact: true });

  await expect(region).toContainText('中国');
  await expect(closureLeft).toHaveCount(0);
  await expect(frameworkHeader.getByRole('group', { name: '局部筛选工具栏' })).toHaveCount(0);
  await expectCenteredToTheRight(closureTitle, closureRight);
  await expect(closureTitle).toHaveCSS('font-weight', '600');
  await expect(closureTitle).toHaveCSS('font-family', '"PingFang SC", sans-serif');

  await openSelection(region);
  await region.getByRole('button', { name: '清空区域', exact: true }).click();
  await closeSelection(region);
  await expectBelow(closureTitle, closureLeft);
  await expectCenteredToTheRight(closureLeft, closureRight);
  await expectBelow(frameworkTitle, frameworkLeft);

  await chooseTree(region, '中国');
  await closeSelection(region);
  await expect(closureLeft).toHaveCount(0);
  await expectCenteredToTheRight(closureTitle, closureRight);
  await expect(frameworkLeft).toHaveCount(0);
});

test('a table title is bold and centered with its search field selector', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/table-column-visibility');
  const heading = page.getByRole('heading', { name: '内嵌表：搜索字段选择', exact: true });
  const toolbar = page.locator('.table-heading').filter({ has: heading });
  await expect(heading).toBeVisible();
  await expectCenteredToTheRight(heading, toolbar.getByRole('button', { name: '表格搜索字段' }));
  await expectCenteredToTheRight(heading, toolbar.getByRole('searchbox'));
  await expect(heading).toHaveCSS('font-weight', '600');
  await expect(heading).toHaveCSS('font-family', '"PingFang SC", sans-serif');
});

test('chart titles use the same bold type as table headings', async ({ page }) => {
  await page.goto('/pages/chart-axis-unit');
  for (const title of ['普通数字：轴顶单位与刻度右对齐', '自适应计数：整轴统一万人']) {
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(heading).toHaveCSS('font-weight', '600');
    await expect(heading).toHaveCSS('font-family', '"PingFang SC", sans-serif');
  }
});
