import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-twelve-row-viewport.json', import.meta.url), 'utf8'));

test('public mount updates empty, twelve, thirteen and short row windows without truncation', async ({ page }) => {
  const document = structuredClone(fixture);
  document.sections = [document.sections[0]];
  document.sections[0].components[0].props.pagination = { mode: 'none' };
  const allRows = document.dataSources.records.source.rows;
  await page.goto('/examples/inline.html');
  for (const count of [0, 12, 13, 5]) {
    document.dataSources.records.source.rows = allRows.slice(0, count);
    await page.evaluate(document => {
      window.runtime.destroy();
      window.runtime = MetricCanvas.mount('#dashboard', { document });
    }, document);
    const widget = page.locator('.table-widget');
    if (count === 0) {
      await expect(widget.getByText('暂无数据', { exact: true })).toBeVisible();
      continue;
    }
    await expect(widget.locator('tbody tr')).toHaveCount(count);
    await expect.poll(() => widget.evaluate(root => {
      const scroll = root.querySelector<HTMLElement>('.scroll')!;
      const rows = Array.from(root.querySelectorAll('tbody tr')).slice(0, 12);
      const cap = root.querySelector('thead')!.getBoundingClientRect().height + rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
      return Math.abs(scroll.clientHeight - cap);
    })).toBeLessThan(2);
    const overflow = await widget.locator('.scroll').evaluate(scroll => scroll.scrollHeight - scroll.clientHeight);
    expect(overflow > 2).toBe(count > 12);
  }
});
