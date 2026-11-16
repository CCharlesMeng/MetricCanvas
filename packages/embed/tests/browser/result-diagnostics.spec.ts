import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = () => JSON.parse(readFileSync(new URL('../../../../pages/capabilities/query/query-numeric-tolerance.json', import.meta.url), 'utf8'));

for (const mode of ['missing-field', 'invalid-dimension', 'total-smaller', 'total-larger'] as const) {
  test(`${mode}: 正式运行保留查询错误诊断，总数不一致仍渲染数据且不告警`, async ({ page }, testInfo) => {
    const document = fixture();
    const rows = document.dataSources.samples.source.initial.rows;
    delete document.dataSources.samples.source.initial;
    if (mode === 'missing-field') delete rows[1]['容错样例'];
    if (mode === 'invalid-dimension') rows[1]['容错样例'] = {};
    const total = mode === 'total-smaller' ? 0 : mode === 'total-larger' ? rows.length + 3 : rows.length;
    await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: rows, total_count: total }] })
    }));
    const errors: Array<Promise<unknown[]>> = [], warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(Promise.all(message.args().map(arg => arg.jsonValue())));
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.goto('/examples/inline.html');
    await page.evaluate(document => {
      window.runtime.destroy();
      window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: MetricCanvas.createDqeGateway() });
    }, document);
    const table = page.locator('[data-component="samples/samples-table"]');
    const host = page.locator('[data-metriccanvas-runtime]');
    await expect(table.getByRole('table')).toBeVisible();
    if (mode === 'missing-field' || mode === 'invalid-dimension') {
      await expect(table.locator('tbody')).toHaveText('暂无数据');
      await expect(host.getByRole('alert')).toHaveCount(0);
      await expect(host.getByText(/DQE_(FIELD_MAPPING|ROW_CONTRACT)_ERROR/)).toHaveCount(0);
      const code = mode === 'missing-field' ? 'DQE_FIELD_MAPPING_ERROR' : 'DQE_ROW_CONTRACT_ERROR';
      await expect.poll(async () => JSON.stringify(await Promise.all(errors))).toContain(code);
      const output = await Promise.all(errors);
      expect(output).toEqual(expect.arrayContaining([[expect.stringContaining(code), expect.objectContaining({
        detail: expect.objectContaining({ rowIndex: 1, fieldId: 'sample' })
      })]]));
      // The line chart and cards still render their normal empty content.
      await expect(host.locator('.metric-card')).toHaveCount(2);
      await expect(host.locator('[data-component="samples/samples-line"] .echart')).toBeVisible();
    } else {
      await expect(table.locator('tbody tr')).toHaveCount(8);
      await expect(table.getByRole('cell', { name: '正常', exact: true })).toBeVisible();
      await expect(table.getByRole('cell', { name: '-4', exact: true }).first()).toBeVisible();
      await expect(host.getByRole('alert')).toHaveCount(0);
      expect(warnings.join('\n')).not.toMatch(/TOTAL_COUNT_MISMATCH|QUERY_VALUE_FALLBACK/);
    }
    await page.screenshot({ path: testInfo.outputPath(`${mode}.png`), fullPage: true });
  });
}
