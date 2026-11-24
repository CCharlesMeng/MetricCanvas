import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import example from '../../../pages/capabilities/chart/pie-legend-color-rule.json' with { type: 'json' };

const route = '/pages/pie-legend-color-rule';
const runtimeUrl = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));
const green = 'var(--mc-color-positive, #52c41a)';
const red = 'var(--mc-color-negative, #f5222d)';
const colors = [
  [green, green, '', red, ''],
  [red, red, red, red, ''],
  ['', '', '', red, ''],
  ['', '', '', red, '']
];

test('colors the numeric cells while keeping swatches aligned with sectors', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto(route);
  const chart = page.locator('[data-component="main/changes"]');
  const legend = chart.getByRole('table');
  const rows = legend.locator('tbody tr');
  await expect(rows).toHaveCount(4);
  const growth = rows.nth(0).getByRole('cell');
  const decline = rows.nth(1).getByRole('cell');
  await expect(growth.nth(0)).toHaveText('+8.5%');
  await expect(growth.nth(1)).toHaveText('-3.2%');
  await expect(growth.nth(2)).toHaveText('0P');
  await expect(decline.nth(1)).toHaveText('+5.1%');
  await expect(rows.nth(2).getByRole('cell').nth(3)).toHaveText('0 家');
  await expect(rows.nth(3).getByRole('cell').nth(0)).toHaveText('—');
  await expect(growth.nth(0)).toHaveCSS('color', 'rgb(82, 196, 26)');
  await expect(decline.nth(0)).toHaveCSS('color', 'rgb(245, 34, 45)');
  expect(await rows.evaluateAll(elements => elements.map(row =>
    Array.from(row.querySelectorAll('td'), cell => cell.style.color)
  ))).toEqual(colors);

  const swatches = await rows.locator('.swatch').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).backgroundColor)
  );
  const plot = chart.locator('[_echarts_instance_]');
  await expect.poll(() => plot.evaluate(async (element, url) => {
    const echarts = await import(url);
    const series = echarts.getInstanceByDom(element)?.getOption().series as
      Array<{ data: Array<{ itemStyle: { color: string } }> }> | undefined;
    return series?.[0]?.data.map(sector => {
      const probe = document.createElement('span');
      probe.style.color = sector.itemStyle.color;
      return probe.style.color;
    });
  }, runtimeUrl)).toEqual(swatches);
});

test('paints the same legend cells in PDF and PNG export', async ({ page }) => {
  await page.goto(route);
  await page.evaluate(async input => {
    const fixtureUrl = '/tests/report-pdf-runtime-fixture.ts';
    const { mountPdfRuntimeFixture } = await import(fixtureUrl);
    const host = document.createElement('div');
    host.id = 'pie-legend-color-export-fixture';
    document.body.append(host);
    const cover = {
      id: 'cover',
      components: [{
        id: 'header', type: 'reportHeader', layout: { span: 12 },
        props: { title: '图例数字着色导出', pngExport: { filename: 'pie-legend-color' } }
      }]
    };
    mountPdfRuntimeFixture(host, { ...input, layout: 'report', sections: [cover, ...input.sections] });
    const BrowserWorker = window.Worker;
    window.Worker = class extends BrowserWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const frame = document.querySelector<HTMLIFrameElement>('[data-report-export-frame]');
        const legend = frame?.contentDocument?.querySelector('[data-export-component="changes"] .pie-legend');
        if (!legend) return;
        const colors = Array.from(legend.querySelectorAll('tbody tr'), row =>
          Array.from(row.querySelectorAll('td'), cell => cell.style.color)
        );
        Reflect.set(window, 'pieLegendExportColors', colors);
      }
    };
  }, example);
  const report = page.locator('#pie-legend-color-export-fixture');
  await expect(report.getByRole('table')).toBeVisible();
  for (const [button, signature] of [
    ['[data-report-pdf-download]', '25504446'],
    ['[data-report-image-download]', '89504e47']
  ]) {
    await page.evaluate(() => Reflect.deleteProperty(window, 'pieLegendExportColors'));
    const pending = page.waitForEvent('download');
    await report.locator(button).click();
    const download = await pending;
    const file = await readFile(await download.path());
    expect(file.subarray(0, 4).toString('hex')).toBe(signature);
    expect(await page.evaluate(() => Reflect.get(window, 'pieLegendExportColors'))).toEqual(colors);
  }
});
