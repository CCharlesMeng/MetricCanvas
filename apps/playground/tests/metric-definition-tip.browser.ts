import { expect, test } from '@playwright/test';

test('英文宿主内的标题气泡使用中文文案', async ({ page }, testInfo) => {
  await page.route('**/pages/metric-card-definition-tip', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<html lang="zh-CN">', '<html lang="en-US">');
    await route.fulfill({ response, body });
  });
  await page.goto('/pages/metric-card-definition-tip');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  const first = page.getByRole('button', { name: '查看销售毛利率的指标定义' });
  const panel = page.getByRole('dialog');
  await expect(first.locator('..')).toHaveRole('heading');
  await expect(first.locator('..')).toHaveText('销售毛利率?');
  await expect(panel).toHaveCount(0);
  await first.hover();
  await expect(panel.getByRole('status')).toContainText('正在加载');
  await expect(panel.locator('dt')).toHaveText(['指标名称（指标编码）', '指标定义', '计算公式', '指标解释人']);
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
  await page.mouse.move(0, 0);
  await expect(panel).toHaveCount(0);
  await first.hover();
  await expect(panel.getByRole('status')).toHaveCount(0);
  await expect(latest).toBeVisible();
  const [target] = await Promise.all([page.waitForEvent('popup'), latest.click()]);
  await expect(target).toHaveURL(/\/pages\/metric-card-primary-detail/);
  await target.close();

  const rowTip = page.getByRole('button', { name: '查看销售收入的指标定义' });
  await expect(rowTip.locator('..')).toHaveClass(/row-label/);
  await rowTip.hover();
  await expect(panel).toHaveAccessibleName('销售收入');
  await expect(panel.getByRole('link', { name: '查看更多', exact: true })).toBeVisible();

  await page.getByRole('heading', { name: '框架执行率', exact: false }).getByRole('button').hover();
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

test('左右两组主次指标各自开启问号，共享结果字段仍按行控制', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/pages/metric-card-definition-tip');
  for (const title of ['闭环指标', '合同指标']) {
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(heading).toHaveText(title);
    await expect(heading.getByRole('button')).toHaveCount(0);
  }
  const cases = [
    ['总闭环率', 'DEMO-TOTAL-CLOSURE'],
    ['商务决策意见闭环率', 'DEMO-BUSINESS-DECISION-CLOSURE'],
    ['合同决策意见闭环率', 'DEMO-CONTRACT-DECISION-CLOSURE'],
    ['重大/高风险合同签署率', 'DEMO-HIGH-RISK-CONTRACT'],
    ['禁止类条款签署率', 'DEMO-PROHIBITED-CLAUSE'],
    ['框架执行率', 'DEMO-FRAMEWORK-EXECUTION']
  ];
  const panel = page.getByRole('dialog');
  const rowTip = (name: string) => page.locator('.row-label').getByRole('button', { name: `查看${name}的指标定义`, exact: true });
  const left = await rowTip(cases[0][0]).boundingBox();
  const right = await rowTip(cases[3][0]).boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(right!.x).toBeGreaterThan(left!.x);
  expect(Math.abs(right!.y - left!.y)).toBeLessThan(2);

  for (const [name, code] of cases) {
    const tip = rowTip(name);
    await expect(tip.locator('..')).toHaveText(`${name}?`);
    await tip.hover();
    await expect(panel).toHaveAccessibleName(name);
    await expect(panel).toContainText(code);
  }
  await expect(page.getByText('总闭环率（未开启）', { exact: true })).toBeVisible();
  await expect(page.getByText('总闭环率（显式关闭）', { exact: true })).toBeVisible();
  await expect(rowTip('总闭环率（未开启）')).toHaveCount(0);
  await expect(rowTip('总闭环率（显式关闭）')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('metric-definition-rows.png') });
});
