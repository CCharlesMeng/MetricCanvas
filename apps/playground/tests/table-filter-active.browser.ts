import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import document from '../../../pages/capabilities/table/table-tiny-os.json' with { type: 'json' };

for (const variant of ['ordinary', 'compact']) {
  test(`${variant} select, date and number filters are black while applied and restore their initial gray`, async ({ page }) => {
    await page.goto(`/pages/${document.id}`);
    const table = page.locator(`[data-component="${variant}/${variant}-table"] .table-widget`);
    const facts: Array<{field:string;initial:string;active:string;cleared:string}> = [];
    for (const field of ['status', 'created', 'value']) {
      const header = table.locator(`th[data-column-field="${field}"]`), summary = header.locator('summary');
      const initial = await summary.evaluate(element => getComputedStyle(element).color);
      let active: string;
      await summary.click();
      if (field === 'status') {
        const choice = header.getByRole('checkbox').first();
        await choice.check();
        await expect(summary).toHaveClass(/active/);
        active = await summary.evaluate(element => getComputedStyle(element).color);
        await choice.uncheck();
      } else {
        const input = field === 'created' ? header.locator('input[type=date]').first() : header.getByRole('textbox', { name: '数值下限' });
        await input.fill(field === 'created' ? '2020-01-01' : '100');
        await input.press('Tab');
        await expect(summary).toHaveClass(/active/);
        active = await summary.evaluate(element => getComputedStyle(element).color);
        await input.fill('');
        await input.press('Tab');
      }
      await expect(summary).not.toHaveClass(/active/);
      await page.mouse.move(0, 0);
      const cleared = await summary.evaluate(element => getComputedStyle(element).color);
      facts.push({field,initial,active,cleared});
      await summary.click();
    }
    writeFileSync(test.info().outputPath('filter-colors.json'), JSON.stringify({variant,facts}));
    for (const fact of facts) {
      expect(fact.active).toBe('rgb(25, 25, 25)');
      expect(fact.cleared).toBe(fact.initial);
    }
  });
}
