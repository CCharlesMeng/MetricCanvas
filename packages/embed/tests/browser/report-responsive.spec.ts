import { expect, test, type Page } from '@playwright/test';
import type { DataGatewayResult } from '@metriccanvas/runtime';

test.use({ viewport: { width: 1707, height: 860 }, deviceScaleFactor: 1.5 });

async function mountReport(page: Page) {
  await page.goto('/examples/inline.html');
  await page.evaluate(async () => {
    const response = await fetch('/pages/flow-analysis-report.json');
    const document: unknown = await response.json();
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', {
      document,
      // Use the report's real initial rows; layout verification needs no DQE service.
      dataGateway: { fetchData: () => new Promise<DataGatewayResult>(() => {}) }
    });
  });
  await page.addStyleTag({ content: 'body { padding: 0; } #dashboard { max-width: none; }' });
  await expect(page.locator('[data-metriccanvas-runtime] .report-header')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function setHostWidth(page: Page, width: number) {
  await page.locator('#dashboard').evaluate((element, value) => {
    element.style.width = `${value}px`;
  }, width);
}

async function reportGeometry(page: Page) {
  return page.locator('[data-metriccanvas-runtime] .page-content').evaluate((content) => {
    const rect = content.getBoundingClientRect();
    const title = content.querySelector('.report-header h1')!;
    const cells = [...content.querySelectorAll('[data-section-id="flow-overview"] > .section-grid > .metric-cell')];
    return {
      width: rect.width,
      padding: getComputedStyle(content).paddingLeft,
      titleSize: getComputedStyle(title).fontSize,
      cards: cells.map((cell) => {
        const box = cell.getBoundingClientRect();
        return { x: box.left - rect.left, y: box.top - rect.top, width: box.width };
      })
    };
  });
}

test('报表随宿主宽度回流：150% 系统缩放、侧栏与恢复宽屏', async ({ page }) => {
  await mountReport(page);
  const host = page.locator('[data-metriccanvas-runtime]');
  for (const width of [1707, 1467, 1095, 700, 1467]) {
    await setHostWidth(page, width);
    await expect.poll(async () => {
      const { cards } = await reportGeometry(page);
      if (cards.length !== 3) return false;
      return width <= 760
        ? cards.every((card) => Math.abs(card.x - cards[0].x) <= 1) && cards[1].y > cards[0].y
        : cards.every((card) => Math.abs(card.y - cards[0].y) <= 1) && cards[1].x > cards[0].x;
    }, { message: `${width}px host: overview cards must follow available width` }).toBe(true);
    await expect.poll(() => host.locator('.metric-panel .value-line').evaluateAll((values) =>
      values.every((value) => value.scrollWidth <= value.clientWidth + 1)
    ), { message: `${width}px host: metric amounts must fit` }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1708);
  }
});

test('相同报表宽度在窄窗口与宽窗口的嵌入容器中布局一致', async ({ page }) => {
  await mountReport(page);
  for (const width of [1000, 700]) {
    await page.setViewportSize({ width: 1707, height: 860 });
    await setHostWidth(page, width);
    await expect.poll(async () => (await reportGeometry(page)).padding).toBe('12px');
    const embedded = await reportGeometry(page);
    await page.setViewportSize({ width, height: 860 });
    await expect.poll(() => reportGeometry(page)).toEqual(embedded);
    if (width === 700) expect(embedded.titleSize).toBe('42px');
  }
});
