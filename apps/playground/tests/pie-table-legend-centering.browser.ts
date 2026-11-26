import { expect, test, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const runtimeUrl = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));

async function measurePie(chart: Locator, position: 'left' | 'right') {
  return chart.evaluate(async (card, { position, runtimeUrl }) => {
    const echarts = await import(runtimeUrl);
    const plot = card.querySelector<HTMLElement>('[_echarts_instance_]')!;
    const legend = card.querySelector<HTMLElement>('.pie-legend')!.getBoundingClientRect();
    const instance = echarts.getInstanceByDom(plot);
    const sector = instance?.getModel().getSeriesByIndex(0).getData().getItemLayout(0);
    // ECharts updates the layout model before the painted sectors finish resizing.
    if (!sector || !instance.getZr().animation.isFinished()) return null;

    const frame = card.getBoundingClientRect();
    const plotBox = plot.getBoundingClientRect();
    const centerX = plotBox.left + sector.cx;
    const centerY = plotBox.top + sector.cy;
    const stacked = legend.top >= plotBox.bottom - 1;
    const visibleLeft = Math.min(centerX - sector.r, legend.left);
    const visibleRight = Math.max(centerX + sector.r, legend.right);
    const cardCenter = frame.left + frame.width / 2;
    const centered = stacked
      ? Math.abs(centerX - cardCenter) < 1 && Math.abs(legend.left + legend.width / 2 - cardCenter) < 1
      : Math.abs((visibleLeft + visibleRight) / 2 - cardCenter) < 1;
    const gap = stacked ? legend.top - (centerY + sector.r)
      : position === 'right' ? legend.left - (centerX + sector.r)
      : (centerX - sector.r) - legend.right;
    const angle = (sector.startAngle + sector.endAngle) / 2;
    const sliceRadius = (sector.r + sector.r0) / 2;
    return {
      diameter: sector.r * 2,
      thickness: sector.r - sector.r0,
      stacked,
      centered,
      gap: Math.round(gap),
      slice: { x: centerX + Math.cos(angle) * sliceRadius, y: centerY + Math.sin(angle) * sliceRadius }
    };
  }, { position, runtimeUrl });
}

async function expectCentered(chart: Locator, position: 'left' | 'right', stacked: boolean, gap: number) {
  await expect(chart.locator('[_echarts_instance_]')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => measurePie(chart, position)).toMatchObject({ stacked, centered: true, gap });
}

test('centers the visible ring and legend with either side and stacks on narrow cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/pie-table-legend');
  const right = page.locator('[data-component="centered-pair/execution-distribution"] .pie-chart');
  const left = page.locator('[data-component="left/left-pie"] .pie-chart');
  await expectCentered(right, 'right', false, 56);
  await expectCentered(left, 'left', false, 16);
  expect(await measurePie(right, 'right')).toMatchObject({ diameter: 128, thickness: 12 });
  const bar = page.locator('[data-component="centered-pair/execution-by-interval"] [_echarts_instance_]');
  await expect(bar).toBeVisible();
  const barBox = (await bar.boundingBox())!;
  const ringBox = (await right.boundingBox())!;
  expect(barBox.x).toBeGreaterThanOrEqual(ringBox.x + ringBox.width);
  expect(barBox.y).toBeLessThan(ringBox.y + ringBox.height);
  expect(barBox.y + barBox.height).toBeGreaterThan(ringBox.y);

  await page.setViewportSize({ width: 960, height: 900 });
  await expectCentered(right, 'right', false, 56);
  expect(await measurePie(right, 'right')).toMatchObject({ diameter: 128, thickness: 12 });

  await page.setViewportSize({ width: 470, height: 900 });
  await expectCentered(right, 'right', true, 16);
  await expectCentered(left, 'left', true, 16);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectCentered(right, 'right', false, 56);
  await right.scrollIntoViewIfNeeded();
  const { slice } = (await measurePie(right, 'right'))!;
  await page.mouse.click(slice.x, slice.y);
  await expect(page.getByRole('dialog')).toContainText('0–25%');
});
