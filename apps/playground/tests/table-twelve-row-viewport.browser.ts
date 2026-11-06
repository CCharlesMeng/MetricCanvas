import { test, expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-twelve-row-viewport.json', import.meta.url), 'utf8'));

async function viewportFacts(widget: Locator) {
  return widget.evaluate(root => {
    const scroll = root.querySelector<HTMLElement>('.scroll')!;
    const table = scroll.querySelector('table')!;
    const rows = Array.from(table.querySelectorAll<HTMLElement>(':scope > tbody > tr:not(.row-expansion-row):not([data-pinned-top])'));
    const head = table.querySelector('thead')!.getBoundingClientRect().height;
    const firstTwelve = rows.slice(0, 12).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
    return { height: scroll.clientHeight, cap: head + firstTwelve, overflow: scroll.scrollHeight - scroll.clientHeight, count: rows.length };
  });
}

for (const section of fixture.sections) {
  test(`${section.id}: twelve-row viewport keeps all rows reachable and the header fixed`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/pages/${fixture.id}`);
    const widget = page.locator(`[data-component="${section.id}/${section.components[0].id}"] .table-widget`);
    const count = section.id === 'short' ? 10 : section.id === 'multi' ? 25 : 20;
    await expect(widget.locator('tbody tr')).toHaveCount(count);
    await expect.poll(async () => Math.abs((await viewportFacts(widget)).height - (await viewportFacts(widget)).cap)).toBeLessThan(2);
    if (section.id === 'short') {
      expect((await viewportFacts(widget)).overflow).toBeLessThan(2);
      return;
    }
    expect((await viewportFacts(widget)).overflow).toBeGreaterThan(100);
    await widget.locator('.scroll').evaluate(scroll => { scroll.scrollTop = scroll.scrollHeight; });
    await expect.poll(() => widget.locator('.scroll').evaluate(scroll => scroll.scrollTop)).toBeGreaterThan(100);
    const positions = await widget.evaluate(root => {
      const scroll = root.querySelector('.scroll')!.getBoundingClientRect();
      const header = root.querySelector('thead th')!.getBoundingClientRect();
      const last = root.querySelector('tbody tr:last-child')!.getBoundingClientRect();
      return { header: header.top - scroll.top, last: last.bottom - scroll.bottom };
    });
    expect(Math.abs(positions.header)).toBeLessThan(2);
    expect(positions.last).toBeLessThanOrEqual(2);
    if (section.id === 'multi') {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(async () => Math.abs((await viewportFacts(widget)).height - (await viewportFacts(widget)).cap)).toBeLessThan(2);
    }
  });
}

test('page size, final page and search resize the viewport without truncating data', async ({ page }) => {
  await page.goto(`/pages/${fixture.id}`);
  const widget = page.locator('[data-component="ordinary/ordinary-table"] .table-widget');
  for (const size of [10, 20, 50]) {
    await widget.locator('.page-size-select summary').click();
    await widget.getByRole('option', { name: String(size), exact: true }).click();
    await expect(widget.locator('tbody tr')).toHaveCount(Math.min(size, 25));
    await expect.poll(async () => Math.abs((await viewportFacts(widget)).height - (await viewportFacts(widget)).cap)).toBeLessThan(2);
  }
  await widget.locator('.page-size-select summary').click();
  await widget.getByRole('option', { name: '20', exact: true }).click();
  await widget.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(widget.locator('tbody tr')).toHaveCount(5);
  await expect.poll(async () => (await viewportFacts(widget)).overflow).toBeLessThan(2);
  await widget.getByRole('searchbox').fill('客户25');
  await widget.getByRole('searchbox').press('Enter');
  await expect(widget.locator('tbody tr')).toHaveCount(1);
  await expect.poll(async () => (await viewportFacts(widget)).overflow).toBeLessThan(2);
});
