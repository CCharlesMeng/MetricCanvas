import { expect, test } from '@playwright/test';

test('指标卡按需呈现定义、更新链接和局部重试', async ({ page }, testInfo) => {
  await page.goto('/pages/metric-card-definition-tip');
  const first = page.getByRole('button', { name: '查看销售毛利率的指标定义' });
  const panel = page.getByRole('dialog');
  await expect(first.locator('..')).toHaveText('销售毛利率?');
  await expect(panel).toHaveCount(0);
  await first.hover();
  await expect(panel.getByRole('status')).toContainText('正在加载');
  await expect(panel).toContainText('销售毛利率（ZB0000377）');
  await expect(panel).toContainText('26年11月1日');
  const latest = panel.getByRole('link', { name: '查看最新指标定义', exact: true });
  await latest.hover();
  await expect(latest).toHaveCSS('color', 'rgb(25, 25, 25)');
  await expect(latest).toHaveCSS('font-weight', '700');
  await expect(latest).toHaveCSS('text-decoration-line', 'none');
  await expect(panel).toHaveCSS('width', '400px');
  await expect(panel).toHaveCSS('border-radius', '8px');
  await panel.screenshot({ path: testInfo.outputPath('metric-definition-loaded.png') });
  const [target] = await Promise.all([page.waitForEvent('popup'), latest.click()]);
  await expect(target).toHaveURL(/\/pages\/metric-card-primary-detail/);
  await target.close();

  const rowTip = page.getByRole('button', { name: '查看销售收入的指标定义' });
  await expect(rowTip.locator('..')).toHaveClass(/row-label/);
  await rowTip.hover();
  await expect(panel).toHaveAccessibleName('销售收入');
  await expect(panel.getByRole('link', { name: '查看更多', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '查看框架执行率的指标定义' }).hover();
  await expect(panel).toContainText('网络出小差了');
  await panel.getByRole('button', { name: '重新加载' }).click();
  await expect(panel.getByRole('link', { name: '查看更多', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看闭环率的指标定义' }).hover();
  await expect(panel).toContainText('DEMO-NO-LINK');
  await expect(panel.getByRole('link')).toHaveCount(0);
  await page.goto('/pages/metric-card-definition-tip?tips=off');
  await expect(page.getByText('32.8%', { exact: true })).toBeVisible();
  await expect(page.locator('[data-metric-definition-trigger]')).toHaveCount(0);
});
