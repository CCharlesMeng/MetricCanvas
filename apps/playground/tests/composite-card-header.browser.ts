import { expect, test } from '@playwright/test';

for (const [url, title] of [
  ['/pages/business-result-metrics?region=R99&region.level=geo', '决策意见闭环率'],
  ['/pages/filter-group-parallel-selects', '经营趋势']
] as const) {
test(`${title} and filters share a header row`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  const geometry = () => heading.evaluate(element => {
    const card = element.closest('.composite-card')!;
    const control = card.querySelector('.toolbar-end')!;
    const title = element.getBoundingClientRect();
    const select = control.getBoundingClientRect();
    return { difference: Math.abs(title.y + title.height / 2 - select.y - select.height / 2),
      separated: title.right <= select.left };
  });
  await expect.poll(async () => (await geometry()).difference).toBeLessThan(1);
  expect((await geometry()).separated).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(heading).toBeVisible();
});
}
