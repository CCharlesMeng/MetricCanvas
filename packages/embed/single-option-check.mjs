import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173/pages/ioc-opportunity-analysis', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const c = page.locator('[data-filter-control][data-filter-id="customer-category"]');
await c.locator('input').first().click();
await page.waitForTimeout(700);
const html = await c.innerHTML();
const opts = (await c.locator('[role="option"], li, label, button').allTextContents()).map(s => s.trim()).filter(Boolean);
console.log('客户分类展开后的可选项:', JSON.stringify(opts.slice(0, 8)));
const target = c.getByText('NA客户', { exact: false }).first();
if (await target.count()) {
  await target.click({ timeout: 3000 }).catch(e => console.log('选中失败', e.message.split('\n')[0]));
  await page.waitForTimeout(800);
  console.log('选中后控件显示:', (await c.innerText()).replace(/\s+/g, ' ').slice(0, 80));
  console.log('URL:', new URL(page.url()).search || '(无)');
} else {
  console.log('没找到候选项 NA客户；控件 HTML 片段:', html.replace(/\s+/g, ' ').slice(0, 300));
}
await browser.close();
