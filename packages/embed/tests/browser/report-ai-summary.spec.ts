import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../../../../pages/capabilities/ai-summary/report-ai-summary.json', import.meta.url), 'utf8'));

test('nonblank body renders without an AI config or scoped queries; blank body generates', async ({ page }, info) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.aiSummaryBodyStats = { queries: 0, generates: 0 };
    const bodyPage = structuredClone(document);
    bodyPage.sections = [document.sections[0], { id: 'direct-body', components: [{
      ...document.sections[1].components[0], props: { body: '<p>直接正文，不等待查询。</p>',
        promptTemplate: '分析当前数据', relatedDataSources: ['usage'] }
    }] }];
    window.pageDocument = bodyPage;
    window.runtime = MetricCanvas.mount('#dashboard', { document: bodyPage, dataGateway: { async fetchData() {
      window.aiSummaryBodyStats.queries++;
      return { rows: [{ month: '已查询', tokens: 42 }], totalCount: 1 };
    } } });
  }, fixture);
  await expect(page.getByText('直接正文，不等待查询。')).toBeVisible();
  await page.getByLabel('报告期间开始', { exact: true }).fill('2026-08');
  await page.getByLabel('报告期间开始', { exact: true }).press('Enter');
  await expect(page.getByText('直接正文，不等待查询。')).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryBodyStats)).toEqual({ queries: 0, generates: 0 });
  await page.screenshot({ path: info.outputPath('body-direct-no-generation.png'), fullPage: true });

  await page.evaluate(() => {
    window.runtime.destroy();
    const document = structuredClone(window.pageDocument);
    document.sections[1].components[0].props.body = ' \n\t ';
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData() {
      window.aiSummaryBodyStats.queries++;
      return { rows: [{ month: '已查询', tokens: 42 }], totalCount: 1 };
    } }, aiSummary: { throttleMs: 0, async generate() {
      window.aiSummaryBodyStats.generates++;
      return '空白正文走动态生成';
    } } });
  });
  await expect(page.getByText('空白正文走动态生成')).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryBodyStats.queries)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.aiSummaryBodyStats.generates)).toBe(1);
  await page.screenshot({ path: info.outputPath('blank-body-generated.png'), fullPage: true });
});

test('Report time switching preserves background tasks, exact cache and independent region contexts', async ({ page }, info) => {
  expect(fixture.sections[3].components[0].props.relatedDataSources).toEqual(['comparison']);
  expect(fixture.sections[3].components[0].props).not.toHaveProperty('relatedDataSource');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.aiSummaryRequests = [];
    const config = { throttleMs: 0, concurrency: 4, generate: async (question: string, contextInfo: import('@metriccanvas/engine/ui').AiSummaryContextInfo) => {
      window.aiSummaryRequests.push({ question, contextInfo });
      const selected = contextInfo.timeFilters.month;
      const inputMonth = selected?.type === 'timeRange' ? selected.from : undefined;
      await new Promise<void>(resolve => {
        const done = (event: Event) => {
          if (!(event instanceof CustomEvent) || event.detail !== inputMonth) return;
          window.removeEventListener('finish-summary', done);
          resolve();
        };
        window.addEventListener('finish-summary', done);
      });
      const period = contextInfo.timeFilters.month;
      return `<p>${period?.type === 'timeRange' ? period.from : ''} ${contextInfo.componentId} 已完成</p>`;
    } };
    const options = { document, aiSummary: config, dataGateway: { async fetchData() {
      return { rows: [{ month: '已查询', tokens: 42 }], totalCount: 1 };
    } } };
    window.runtime = MetricCanvas.mount('#dashboard', options);
    window.addEventListener('remount-summary', () => { window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', options); });
  }, fixture);
  await expect(page.getByText('本段由页面直接提供，无需调用 AI。')).toBeVisible();
  await expect(page.getByText('可读结论', { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.aiSummaryRequests.length)).toBe(2);
  const scopes = await page.evaluate(() => window.aiSummaryRequests.map(request => request.contextInfo.dataSources.map(source => source.id)));
  expect(scopes).toEqual([['usage'], ['comparison']]);
  const directContext = await page.evaluate(() => window.aiSummaryRequests.find(request => request.contextInfo.componentId === 'comparison-summary')!.contextInfo);
  expect(directContext.sectionIds).toEqual([]);
  expect(Object.keys(directContext.dataSources[0]!.fields).sort()).toEqual(['month', 'tokens']);
  expect(directContext.dataSources[0]!.fields.tokens!.label).toBe(fixture.dataSources.comparison.fields.tokens.label);
  await page.getByLabel('报告期间开始', { exact: true }).fill('2026-08');
  await page.getByLabel('报告期间开始', { exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.aiSummaryRequests.length)).toBe(4);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('finish-summary', { detail: '2026-09' })));
  await expect(page.locator('[data-component="usage-region/usage-summary"]')).not.toContainText('2026-09 usage-summary 已完成');
  await page.getByLabel('报告期间开始', { exact: true }).fill('2026-09');
  await page.getByLabel('报告期间开始', { exact: true }).press('Enter');
  await expect(page.getByText('2026-09 usage-summary 已完成')).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(4);
  await page.evaluate(() => window.dispatchEvent(new Event('remount-summary')));
  await expect(page.getByText('2026-09 usage-summary 已完成')).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(4);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('finish-summary', { detail: '2026-08' })));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出图片', exact: true }).click();
  await (await download).saveAs(info.outputPath('report-ai-summary.png'));
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(4);
  await page.screenshot({ path: info.outputPath('report-ai-summary-page.png'), fullPage: true });
  expect(errors).toEqual([]);
});

const sdtReport = JSON.parse(await readFile(new URL('../../../../pages/business/report/sdt/business-sdt-report.json', import.meta.url), 'utf8'));
const sdtHeader = sdtReport.sections.flatMap((section: { components: Array<{ type: string; props: { subtitle: string; subtitleFormat: string } }> }) => section.components).find((component: { type: string }) => component.type === 'reportHeader');

test('AI Summary shares the exact SDT report summary presentation at wide and narrow widths', async ({ page }, info) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(header => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document: {
      schemaVersion: '6.51', id: 'sdt-summary-parity', layout: 'report', dataSources: {},
      sections: [{ id: 'reference', container: 'plain', components: [{ id: 'header', type: 'reportHeader', layout: { span: 12 }, props: header.props }] },
        { id: 'summary', container: 'plain', components: [{ id: 'ai', type: 'aiSummary', layout: { span: 12 }, props: { mode: 'provided', body: header.props.subtitle } }] }]
    } });
  }, sdtHeader);
  const reference = page.locator('.report-header .report-summary');
  const summary = page.locator('.ai-summary .report-summary');
  for (const width of [1440, 640]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(summary).toBeVisible();
    const referenceWidth = await reference.evaluate(element => element.getBoundingClientRect().width);
    await page.locator('.ai-summary').evaluate((element, width) => { element.style.width = `${width}px`; }, referenceWidth);
    const styles = await page.locator('.report-summary').evaluateAll(elements => elements.map(element => {
      const selectors = ['', '.report-summary-title', '.report-summary-title span', '.report-summary-title img', '.report-summary-frame', '.report-summary-content', '.semantic-html', '.detail-title', '.tone-positive', '.tone-negative'];
      return selectors.map(selector => {
        const target = selector ? element.querySelector(selector)! : element;
        const css = getComputedStyle(target);
        return [target.getBoundingClientRect().width, target.getBoundingClientRect().height, css.padding, css.margin, css.font, css.color, css.background, css.border, css.borderRadius, css.gap];
      });
    }));
    expect(styles[1]).toEqual(styles[0]);
    await reference.screenshot({ path: info.outputPath(`sdt-reference-${width}.png`) });
    await summary.screenshot({ path: info.outputPath(`ai-summary-${width}.png`) });
  }
});
