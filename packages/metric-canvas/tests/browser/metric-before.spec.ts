import { expect, test } from '@playwright/test';

test('连接文字选择所属指标卡，创作与正式视图共用四卡十二列布局', async ({page})=>{
  await page.goto('/tests/browser/harness/index.html?scenario=metric-before');
  const canvas=page.locator('#canvas'), runtime=page.locator('#runtime');
  for(const host of [canvas,runtime]) {
    await expect(host.locator('[data-metric-connection-row="total-card"] [data-component]')).toHaveCount(4);
    await expect(host.getByText('1,200',{exact:true}).first()).toBeVisible();
  }
  await canvas.locator('[data-metric-connector="product-card"]').click();
  await expect(canvas.locator('[data-component="equation/product-card"]')).toHaveClass(/authoring-selected/);
  await expect(page.locator('[data-intents]')).toContainText('product-card');
  await expect(runtime.locator('button[data-metric-connector]')).toHaveCount(0);
  await expect(runtime.locator('[data-metric-connector="product-card"]')).toHaveText('=');
});
