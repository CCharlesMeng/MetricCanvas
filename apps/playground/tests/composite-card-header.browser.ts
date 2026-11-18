import { expect, test, type Locator } from '@playwright/test';

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

for (const [url, title, filterCount] of [
  ['/pages/business-result-metrics?region=R99&region.level=geo', '决策意见闭环率', 1],
  ['/pages/filter-group-parallel-selects', '经营趋势', 2]
] as const) {
  test(`${title} is bold and centered with its right-hand filters`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(heading).toBeVisible();
    const controls = page.locator('.composite-header').filter({ has: heading })
      .locator('.toolbar-end button[aria-haspopup]');
    await expect(controls).toHaveCount(filterCount);
    for (const control of await controls.all()) {
      await expectCenteredToTheRight(heading, control);
    }
    await expect(heading).toHaveCSS('font-weight', '600');
    await expect(heading).toHaveCSS('font-family', '"PingFang SC", sans-serif');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(heading).toBeVisible();
  });
}

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
