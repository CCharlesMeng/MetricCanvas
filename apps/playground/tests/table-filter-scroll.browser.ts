import { expect, test } from '@playwright/test';
import example from '../../../pages/capabilities/table/table-column-candidates.json' with { type: 'json' };

for (const viewport of [{ width: 1280, height: 720 }, { width: 1280, height: 360 }, { width: 390, height: 360 }]) {
  test(`candidate options are the only scroll area at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/pages/${example.id}`);
    const table = page.locator('.table-widget').first();
    const header = table.locator('th[data-column-field="office"]');
    await header.locator('summary').click();
    await expect(header.getByRole('checkbox', { name: '办事处01', exact: true })).toBeVisible();
    const menu = header.locator('.menu');
    const list = header.locator('.list');
    const search = header.getByRole('searchbox');
    await expect(header.getByRole('button', { name: /加载更多/ })).toHaveCount(0);
    await expect(header.getByRole('checkbox')).toHaveCount(50);
    await expect.poll(() => menu.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    await expect.poll(() => list.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
    const searchBefore = await search.boundingBox();
    await list.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(await search.boundingBox()).toEqual(searchBefore);
    await expect(header.getByRole('checkbox', { name: '办事处64', exact: true })).toHaveCount(1);
    await expect(header.getByRole('checkbox')).toHaveCount(64);
    await page.mouse.wheel(0, 2000);
    await expect(header.getByRole('checkbox')).toHaveCount(64);
    await search.fill('办事处64');
    await header.getByRole('checkbox', { name: '办事处64', exact: true }).check();
    await expect(table).toContainText('总条数： 1');
    await search.fill('不存在');
    await expect(header.getByText('没有候选项', { exact: true })).toBeVisible();
    await expect(header.getByRole('checkbox', { name: /办事处64/ })).toBeChecked();
    await search.fill('');
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBe(0);
    await expect.poll(() => menu.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    await expect.poll(() => list.evaluate(node => node.clientHeight)).toBeGreaterThan(0);
    await expect.poll(() => list.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
    await expect(search).toBeVisible();
    await expect(menu).toBeInViewport({ ratio: 1 });
  });
}
