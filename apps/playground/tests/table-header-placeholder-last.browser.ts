import { expect, test } from '@playwright/test';
import document from '../../../pages/capabilities/table/table-header-placeholder-last.json' with { type: 'json' };

for (const kind of ['static', 'dynamic']) {
  test(`${kind} keeps -- last through search, selection and all`, async ({ page }) => {
    await page.goto(`/pages/${document.id}`);
    const table = page.locator('.table-widget').filter({ has: page.getByRole('heading', { name: `${kind}-true`, exact: true }) });
    const header = table.locator('th[data-column-field="status"]');
    await header.locator('summary').click();
    const options = header.locator('label').filter({ has: page.getByRole('checkbox') });
    await expect(options.last()).toHaveText('--');
    await header.getByRole('checkbox', { name: '--', exact: true }).check();
    await expect(table).toContainText('总条数： 1');
    await header.getByRole('searchbox').fill('否');
    await expect(header.getByRole('checkbox', { name: '否', exact: true })).toBeVisible();
    if (kind === 'dynamic') await expect(options.last()).toContainText('--');
    await header.getByRole('searchbox').fill('');
    await expect(options.last()).toHaveText('--');
    await expect(header.getByRole('checkbox', { name: '--', exact: true })).toBeChecked();
    await header.getByRole('checkbox', { name: '全选', exact: true }).check();
    await expect(table).toContainText('总条数： 4');
    await expect(options.last()).toHaveText('--');
  });
}
