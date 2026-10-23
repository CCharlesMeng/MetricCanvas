import { expect, test } from '@playwright/test';

for (const variant of ['default', 'forecast-matrix', 'embedded', 'report-compact']) {
  test(`${variant}: missing cells are plain text while real zero and dash remain actionable`, async ({ page }) => {
    await page.goto('/pages/table-missing-cell-actions');
    const runtime = page.locator('.runtime-view');
    const table = runtime.locator(`[data-component="main/${variant}"]`);
    const missing = table.locator('tbody tr').first();
    await expect(missing).toContainText('暂无');
    await expect(missing.locator('a, button')).toHaveCount(0);
    await expect(missing.locator('td.selectable, td.linkable')).toHaveCount(0);
    const url = page.url();
    for (const field of ['pick', 'destination', 'amount', 'custom']) {
      const cell = missing.locator(`td[data-column-field="${field}"]`);
      await expect(cell.locator('.cell-primary-value')).toHaveCSS('text-decoration-line', 'none');
      await cell.click();
    }
    await expect(runtime.getByRole('dialog')).toHaveCount(0);
    expect(page.url()).toBe(url);

    const real = table.locator('tbody tr').nth(1);
    const selection = real.locator('td[data-column-field="pick"] button');
    await selection.press('Enter');
    await expect(selection).toHaveAttribute('aria-pressed', 'true');
    const link = real.locator('td[data-column-field="destination"] a');
    await expect(link).toHaveText('—');
    await expect(link).toHaveAttribute('href', /\/pages\/table-missing-cell-actions/);
    for (const field of ['amount', 'custom']) {
      await real.locator(`td[data-column-field="${field}"]`).getByRole('button', { name: '0', exact: true }).press('Enter');
      await expect(runtime.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(runtime.getByRole('dialog')).toHaveCount(0);
    }
    await page.screenshot({ path: test.info().outputPath(`${variant}.png`), fullPage: true });
  });
}
