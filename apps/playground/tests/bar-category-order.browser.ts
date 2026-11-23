import { expect, test, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import example from '../../../pages/capabilities/chart/bar-category-order.json' with { type: 'json' };

const runtimeUrl = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));
const descending = ['B 区', 'A 区', 'C 区', 'E 区', 'D 区'];

function chartState(chart: Locator, legend?: string) {
  return chart.evaluate(async (element, { url, legend }) => {
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    if (legend) instance.dispatchAction({ type: 'legendToggleSelect', name: legend });
    const option = instance.getOption();
    const axis = [...option.xAxis, ...option.yAxis].find((item: { type: string }) => item.type === 'category');
    const series: Array<{ data: unknown[]; markPoint?: { data: Array<{ name: string; value: number }> } }> = option.series;
    const totals = series.flatMap(item => item.markPoint?.data ?? []);
    return {
      categories: axis.data,
      values: series[0].data,
      totals: totals.map(point => [point.name, point.value]),
      selected: option.legend[0].selected,
      firstBar: instance.convertToPixel({ seriesIndex: 0 }, [0, 4]) as [number, number]
    };
  }, { url: runtimeUrl, legend });
}

test('sorts each chart independently and drills into the displayed row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/pages/bar-category-order');
  const stacked = page.locator('[data-component="main/by-total"] [_echarts_instance_]');
  const horizontal = page.locator('[data-component="main/by-region"] [_echarts_instance_]');
  const unordered = page.locator('[data-component="main/source-order"] [_echarts_instance_]');
  const totals = [['B 区', 11], ['A 区', 11], ['C 区', 7], ['E 区', 0]];
  await expect.poll(() => chartState(stacked)).toMatchObject({
    categories: descending, values: [9, 6, 3, 0, undefined], totals
  });
  expect((await chartState(horizontal)).categories).toEqual(['A 区', 'B 区', 'C 区', 'D 区', 'E 区']);
  expect((await chartState(unordered)).categories).toEqual(['C 区', 'B 区', 'D 区', 'A 区', 'E 区']);

  const { firstBar: [x, y] } = await chartState(stacked);
  await stacked.click({ position: { x, y } });
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-detail-title]')).toHaveText('B 区合同明细');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await chartState(stacked, '已签');
  await expect.poll(() => chartState(stacked)).toMatchObject({ categories: descending, totals, selected: { '已签': false } });
});

test('uses the sorted chart in PDF and PNG downloads', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/pages/bar-category-order');
  await page.evaluate(async input => {
    const fixtureUrl = '/tests/report-pdf-runtime-fixture.ts';
    const { mountPdfRuntimeFixture } = await import(fixtureUrl);
    const host = document.createElement('div');
    host.id = 'bar-order-export-fixture';
    document.body.append(host);
    const cover = {
      id: 'cover',
      components: [{
        id: 'header', type: 'reportHeader', layout: { span: 12 },
        props: { title: '柱图排序导出', pngExport: { filename: 'bar-order' } }
      }]
    };
    mountPdfRuntimeFixture(host, { ...input, layout: 'report', sections: [cover, ...input.sections] });
    const BrowserWorker = window.Worker;
    window.Worker = class extends BrowserWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const frame = document.querySelector<HTMLIFrameElement>('[data-report-export-frame]');
        const chart = frame?.contentDocument?.querySelector('[data-export-component="by-total"]');
        if (!chart) return;
        Reflect.set(window, 'barOrderExport', {
          labels: chart.querySelector('.chart-semantics')?.textContent?.trim(),
          imageWidth: chart.querySelector('img')?.naturalWidth
        });
      }
    };
  }, example);
  const report = page.locator('#bar-order-export-fixture');
  await expect(report.locator('canvas')).not.toHaveCount(0);
  for (const [format, button, signature] of [
    ['pdf', '[data-report-pdf-download]', '25504446'],
    ['png', '[data-report-image-download]', '89504e47']
  ]) {
    await page.evaluate(() => Reflect.deleteProperty(window, 'barOrderExport'));
    const downloadEvent = page.waitForEvent('download');
    await report.locator(button).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.' + format + '$'));
    const file = await readFile(await download.path());
    expect(file.subarray(0, 4).toString('hex')).toBe(signature);
    const result = await page.evaluate(() => Reflect.get(window, 'barOrderExport'));
    expect(result.labels).toContain(descending.join(' '));
    expect(result.imageWidth).toBeGreaterThan(0);
  }
});
