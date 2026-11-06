import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/query-sort-baseline.json', import.meta.url), 'utf8'));

declare global {
  interface Window { __sortCategoryPaints: Array<{ chart: string; text: string; x: number }> }
}

async function categoryPaints(page: Page, chart: string) {
  return page.evaluate(id => ['乙代表处', '丙代表处', '甲代表处'].map(text =>
    window.__sortCategoryPaints.find(paint => paint.chart === id && paint.text === text)), chart);
}

test('query default direction is visible before clicking, with constant baseline charts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__sortCategoryPaints = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      const chart = this.canvas.closest('[_echarts_instance_]')?.getAttribute('_echarts_instance_');
      if (chart && args[0].endsWith('代表处')) {
        const transform = this.getTransform();
        window.__sortCategoryPaints.push({ chart, text: args[0], x: transform.a * args[1] + transform.c * args[2] + transform.e });
      }
      return fillText.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('.table-widget');
  const duration = table.getByRole('button', { name: /平均决策时长/ });
  await expect(duration.locator('.sort-state')).toHaveAttribute('aria-label', '排序:desc');
  await expect(duration.locator('.sort-state')).toHaveCSS('opacity', '1');
  await expect(page.locator('[_echarts_instance_]')).toHaveCount(2);
  for (const [index, values] of [[6, 3, 1], [8, 4, 2]].entries()) {
    const chart = page.locator('[_echarts_instance_]').nth(index);
    const baseline = fixture.sections[0].components[index + 1].props.series[1];
    const id = (await chart.getAttribute('_echarts_instance_'))!;
    await expect.poll(async () => (await categoryPaints(page, id)).filter(Boolean).length).toBe(3);
    const paints = await categoryPaints(page, id);
    expect(paints[0]!.x).toBeLessThan(paints[1]!.x);
    expect(paints[1]!.x).toBeLessThan(paints[2]!.x);
    for (const [point, value] of values.entries()) {
      await chart.hover({ position: { x: paints[point]!.x, y: 100 } });
      await expect(chart.getByText(new RegExp(`^${value}(?:\\.0+)?(?:\\s*${baseline.unit})?$`))).toBeVisible();
      await expect(chart.getByText(new RegExp(`^${baseline.value}(?:\\.0+)?\\s*${baseline.unit}$`))).toBeVisible();
    }
  }
  await duration.click();
  await expect(duration.locator('.sort-state')).toHaveCount(0);
  await duration.click();
  await expect(duration.locator('.sort-state')).toHaveAttribute('aria-label', '排序:asc');
  await expect(table.locator('tbody tr').first()).toContainText('甲代表处');
  await duration.click();
  await expect(duration.locator('.sort-state')).toHaveAttribute('aria-label', '排序:desc');
  await expect(table.locator('tbody tr').first()).toContainText('乙代表处');
  await page.mouse.click(5, 5);
  await expect(duration.locator('.sort-state')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '/tmp/query-sort-baseline-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(duration.locator('.sort-state')).toBeVisible();
  await page.screenshot({ path: '/tmp/query-sort-baseline-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});
