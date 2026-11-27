import { expect, test } from '@playwright/test';
import type { RuntimeDataGateway } from '@metriccanvas/engine';
import cardDemand from '../../../packages/engine/runtime/tests/fixtures/card-comparison-demand.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import example from '../../../pages/capabilities/layout/metric-card-change-visibility.json' with { type: 'json' };

test('switches change items by applied period while preserving both metric values', async ({ page }) => {
  await page.goto(`/pages/${example.id}`);
  const card = page.locator('[data-component="metrics/rates"]');
  const period = page.locator('[data-filter-id="period"]');
  await expect(card.locator('.change-label')).toHaveText(['环比', '环比', '较目标']);
  await expect(card.locator('.change-value')).toHaveText(['+3%', '-2%', '+1%']);
  const primaryChange = card.locator('.metric-content .change');
  await expect(primaryChange.locator('.change-label')).toHaveCSS('color', 'rgb(113, 113, 122)');
  await expect(primaryChange.locator('.change-value')).toHaveCSS('color', 'rgb(245, 34, 45)');

  for (const mode of ['年', '季']) {
    await period.getByRole('button', { name: mode, exact: true }).click();
    await expect(card.locator('.change-label')).toHaveText(['同比', '同比', '较目标']);
    await expect(card.locator('.change-value')).toHaveText(['+7%', '+5%', '+1%']);
    await expect(primaryChange.locator('.change-label')).toHaveCSS('color', 'rgb(113, 113, 122)');
    await expect(primaryChange.locator('.change-value')).toHaveCSS('color', 'rgb(245, 34, 45)');
    await expect(card.locator('.metric-panel .change-value').first()).toHaveCSS('color', 'rgb(82, 196, 26)');
  }

  await period.getByRole('button', { name: '近一年', exact: true }).click();
  await expect(card.locator('.change-label')).toHaveText(['较目标']);
  await expect(card.locator('.changes')).toHaveCount(1);
  await expect(card.locator('.row-value')).toHaveText(['82%', '91%']);
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(card.locator('.change-label')).toHaveText(['环比', '环比', '较目标']);
});

test('PDF and PNG use the projected change items for the captured period', async ({ page }) => {
  await page.goto(`/pages/${example.id}`);
  await page.evaluate(async input => {
    const runtimeUrl = '/tests/report-pdf-runtime-fixture.ts';
    const { mountPdfRuntimeFixture } = await import(runtimeUrl);
    const host = document.createElement('div');
    host.id = 'metric-change-export-fixture';
    document.body.append(host);
    const cover = {
      id: 'cover',
      components: [{
        id: 'cover', type: 'reportHeader', layout: { span: 12 },
        props: { title: '指标卡变化项导出', pngExport: { filename: 'metric-changes' } }
      }]
    };
    const [header, metrics] = input.sections;
    mountPdfRuntimeFixture(host, { ...input, layout: 'report', sections: [header, cover, metrics] });

    const BrowserWorker = window.Worker;
    window.Worker = class extends BrowserWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const frame = document.querySelector<HTMLIFrameElement>('[data-report-export-frame]');
        const card = frame?.contentDocument?.querySelector('[data-export-component="rates"]');
        if (!card) return;
        const changeLabels = Array.from(card.querySelectorAll('.change-label'), item => item.textContent?.trim());
        const metricValues = Array.from(card.querySelectorAll('.row-value'), item => item.textContent?.trim());
        Reflect.set(window, 'metricChangeExport', { changeLabels, metricValues });
      }
    };
  }, example);

  const report = page.locator('#metric-change-export-fixture');
  const card = report.locator('[data-component="metrics/rates"]');
  for (const [mode, label, format, button, signature] of [
    ['月', '环比', 'pdf', '[data-report-pdf-download]', '25504446'],
    ['年', '同比', 'png', '[data-report-image-download]', '89504e47']
  ] as const) {
    await report.getByRole('button', { name: mode, exact: true }).click();
    const changeLabels = [label, label, '较目标'];
    await expect(card.locator('.change-label')).toHaveText(changeLabels);
    await page.evaluate(() => Reflect.deleteProperty(window, 'metricChangeExport'));
    const downloadEvent = page.waitForEvent('download');
    await report.locator(button).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.' + format + '$'));
    expect((await readFile(await download.path())).subarray(0, 4).toString('hex')).toBe(signature);
    expect(await page.evaluate(() => Reflect.get(window, 'metricChangeExport'))).toEqual({
      changeLabels, metricValues: ['82%', '91%']
    });
  }
});

test('renders the current value and table while a separate comparison request is pending', async ({ page }) => {
  await page.goto('/pages/' + example.id);
  await page.evaluate(async document => {
    const fixtureUrl = '/tests/report-pdf-runtime-fixture.ts';
    const { mountPdfRuntimeFixture } = await import(fixtureUrl);
    const host = window.document.createElement('div');
    host.id = 'comparison-demand';
    window.document.body.append(host);
    const comparison = new Promise<void>(resolve => host.addEventListener('release-comparison', () => resolve(), { once: true }));
    const gateway: RuntimeDataGateway = {
      async fetchData(query) {
        const metrics = query.body.dsl_list[0].output_metrics;
        if (Array.isArray(metrics) && metrics.includes('mom')) {
          host.dataset.comparison = 'pending';
          await comparison;
        }
        return { rows: [{ name: '中国', rate: 36, change: 1, mom: -2 }], totalCount: 1 };
      }
    };
    const cover = { id: 'cover', components: [{ id: 'cover', type: 'reportHeader', layout: { span: 12 }, props: { title: '查询回归' } }] };
    mountPdfRuntimeFixture(host, { ...document, layout: 'report', sections: [document.sections[0], cover, document.sections[1]] }, gateway);
  }, cardDemand);
  const host = page.locator('#comparison-demand');
  const card = host.locator('[data-component="metrics/rate"]');
  await expect(host).toHaveAttribute('data-comparison', 'pending');
  await expect(card.locator('.row-value')).toHaveText('36');
  await expect(host.getByRole('cell', { name: '36', exact: true })).toBeVisible();
  await expect(card.locator('.change-value .skeleton')).toBeVisible();
  await host.dispatchEvent('release-comparison');
  await expect(card.locator('.change-value')).toHaveText('-2');
});
