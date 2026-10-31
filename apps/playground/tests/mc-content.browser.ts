import {expect, test} from '@playwright/test';

test('MC diagnostics render in the product engine with sorting and narrow scrolling', async ({page}, info) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/pages/mc-content-layout-demo');
  await expect(page.getByText('同源知识有界读取', {exact: true})).toBeVisible();
  await expect(page.getByText('完整工具参数', {exact: true})).toBeVisible();
  await expect(page.getByText('来源覆盖对账', {exact: true})).toBeVisible();
  await expect(page.getByText('安装文件完整性', {exact: true})).toBeVisible();
  await expect(page.getByText('运行依赖预检', {exact: true})).toBeVisible();
  await expect(page.getByText('换行转换拒绝', {exact: true})).toBeVisible();
  const table = page.locator('table').first();
  await expect(table).toContainText('not_run');
  await expect(table).toContainText('CONTENT_RESOURCE_MISMATCH / line-endings');
  const before = await table.locator('tbody tr').first().textContent();
  await table.getByRole('button', {name: '检查项', exact: true}).click();
  await expect(table.locator('tbody tr').first()).not.toHaveText(before!);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    await expect(table).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`mc-content-${width}.png`), fullPage: true});
  }
  expect(failures).toEqual([]);
});

test('MC composed Report examples and migrated legacy page retain actual values', async ({page}, info) => {
  for (const scene of ['business-report', 'usage-report']) {
    await page.goto(`/pages/mc-layout-${scene}`);
    await expect(page.getByText('合成用量', {exact: true}).first()).toBeVisible();
    await expect(page.locator('table').first()).toContainText('2026-01');
    await expect(page.locator('table').first()).toContainText('20');
    await expect(page.locator('table').first()).toContainText('30');
    await page.screenshot({path: info.outputPath(`${scene}.png`), fullPage: true});
  }
  await page.goto('/pages/schema-upgrade-demo');
  await expect(page.getByText('继续开发：GMV', {exact: true})).toBeVisible();
  const table = page.locator('table').first();
  await expect(table).toContainText('华东');
  await table.getByRole('button', {name: '成交总额', exact: true}).click();
  await expect(table.locator('tbody tr').first()).toContainText('华南');
  await page.screenshot({path: info.outputPath('legacy-upgraded.png'), fullPage: true});
});

test('semantic chart-filter migration replays with the real engine and local DQE simulator', async ({page}, info) => {
  const {readFileSync} = await import('node:fs');
  const {upgradePageDocument} = await import('../../../packages/page/src/upgrade-document');
  const {execFileSync} = await import('node:child_process');
  const simulator = "const {executeDqeItem}=require('./tools/dqe-sim/src/execute.ts'); const input=JSON.parse(require('node:fs').readFileSync(0,'utf8')); process.stdout.write(JSON.stringify({retCode:'CBC.0000',retDesc:null,results:input.dsl_list.map(executeDqeItem)}));";
  const input = JSON.parse(readFileSync(new URL('../../../tools/fixtures/local-authoring-upgrade/chart-filter.json', import.meta.url), 'utf8'));
  const migrated = upgradePageDocument(input);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) return;
  expect(migrated.changes.filter(change => change.rule === 'chart-filter')).toHaveLength(4);
  const requests: string[] = [];
  await page.addInitScript(() => Object.assign(window, {__METRICCANVAS__: {
    dqeEndpoint: '/synthetic-mc-dqe', pageMetadataBaseUrl: '/pages', authToken: 'synthetic', operatorId: 'synthetic', workspaceId: 'synthetic'
  }}));
  await page.route('**/synthetic-mc-dqe', async route => {
    const body = route.request().postDataJSON();
    requests.push(JSON.stringify(body));
    const response = execFileSync(process.execPath, ['--import', 'tsx', '-e', simulator], {
      cwd: new URL('../../../', import.meta.url), input: JSON.stringify(body), encoding: 'utf8'
    });
    await route.fulfill({json: JSON.parse(response)});
  });
  await page.goto('/preview');
  await page.getByRole('textbox', {name: 'Page JSON 编辑器'}).fill(JSON.stringify(migrated.document));
  await expect(page.getByText('契约有效', {exact: true})).toBeVisible();
  const filter = page.getByRole('group', {name: '订单对比区域', exact: true});
  await expect(filter.getByRole('button', {name: '海外', exact: true})).toBeVisible();
  const previousRequests = requests.length;
  await filter.getByRole('button', {name: '海外', exact: true}).click();
  await expect(filter.getByRole('button', {name: '海外', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => requests.slice(previousRequests).some(value => value.includes('chart_demo_orders') && value.includes('OVERSEAS'))).toBe(true);
  await expect(page.getByText('Page 文档未通过契约校验', {exact: true})).toHaveCount(0);
  await page.locator('.render-panel').screenshot({path: info.outputPath('semantic-migration-sim.png')});
});
