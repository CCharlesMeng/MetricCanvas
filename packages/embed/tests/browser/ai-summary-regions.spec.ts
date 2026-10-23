import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../../../../pages/capabilities/ai-summary/report-ai-summary-regions.json', import.meta.url), 'utf8'));

test('nested region summaries freeze export bodies, preserve cache and do not generate unseen tabs on export', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.aiSummaryRequests = [];
    window.runtime = MetricCanvas.mount('#dashboard', { document, aiSummary: { throttleMs: 0,
      async generate(question, contextInfo) {
        window.aiSummaryRequests.push({ question, contextInfo });
        return `<p>${contextInfo.componentId} 完整正文</p>`;
      }
    } });
  }, fixture);
  await expect(page.locator('.ai-summary:visible')).toHaveCount(5);
  await expect(page.getByText('left-card-summary 完整正文', { exact: true })).toBeVisible();
  await expect(page.getByText('right-card-summary 完整正文', { exact: true })).toBeVisible();
  await expect(page.getByText('tab-usage-ai 完整正文', { exact: true })).toBeVisible();
  const scopes = await page.evaluate(() => window.aiSummaryRequests.map(request => ({
    id: request.contextInfo.componentId, region: request.contextInfo.region,
    sources: request.contextInfo.dataSources.map(source => source.id)
  })));
  expect(scopes).toContainEqual({ id: 'left-card-summary', region: { kind: 'compositeCard', id: 'left-card', sectionId: 'parallel' }, sources: ['usage'] });
  expect(scopes).toContainEqual({ id: 'right-card-summary', region: { kind: 'compositeCard', id: 'right-card', sectionId: 'parallel' }, sources: ['comparison'] });
  expect(scopes).toHaveLength(5);
  expect(JSON.stringify(await page.evaluate(() => window.aiSummaryRequests))).not.toContain('区域说明文字');
  expect(JSON.stringify(scopes)).not.toContain('unreferenced');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出图片', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(info.outputPath('region-summaries-export.png'));
  expect(await download.failure()).toBeNull();
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(5);
  await page.getByRole('tab', { name: '对照视角', exact: true }).click();
  await expect(page.getByText('tab-comparison-ai 完整正文', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '用量视角', exact: true }).click();
  await expect(page.getByText('tab-usage-ai 完整正文', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(6);
  expect(errors).toEqual([]);
});
