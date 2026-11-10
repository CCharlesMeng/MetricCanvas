import { expect, test } from '@playwright/test';
import { currentHealthResult } from '../../../tests/fixtures/partner-health/current-responses';

test('global URL retains regional tabs, correct overall scope and default local score ordering', async ({page}) => {
  test.setTimeout(60000);
  const bodies: unknown[] = [];
  await page.route('**/dsl/execute', async route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map(currentHealthResult)}});
  });
  await page.goto('/pages/partner-health?stat-year=year:2026&china-overseas=国内&region-dept=全球&tab.regional-comparison-tabs=region');
  const chart = page;
  await expect(chart.getByRole('tab',{name:'地区部',exact:true}).first()).toBeVisible({timeout:20000});
  await expect(chart.getByRole('tab',{name:'代表处',exact:true}).first()).toBeVisible();
  const total = page.locator('[data-component$="/total-score-card"]');
  await expect(total).toContainText(/伙伴健康度\s*8\s*分/);
  await expect(page.locator('[data-component$="/total-score-card-region"]')).toHaveCount(0);
  await page.locator('[data-component$="/china-overseas-buttons"]').getByRole('button',{name:'海外',exact:true}).click();
  await expect(total).toContainText(/伙伴健康度\s*17\s*分/);
  await page.locator('[data-component$="/china-overseas-buttons"]').getByRole('button',{name:'中国区',exact:true}).click();
  await expect(total).toContainText(/伙伴健康度\s*8\s*分/);
  const details = page;
  for (const label of ['地区部','代表处']) {
    await details.getByRole('tab',{name:label,exact:true}).last().click();
    const table = page.getByRole('table').first();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}12`);
    const before = bodies.length;
    await page.getByRole('button',{name:'下一页',exact:true}).last().click();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}02`);
    expect(bodies.length).toBe(before);
  }
  await page.screenshot({path:'../../.scratch/partner-health-fix/global.png',fullPage:true});
});

test('local default sort applies after computation and pagination stays isolated by table', async ({page}) => {
  await page.goto('/pages/table-default-sort');
  const descending = page.locator('[data-component$="/descending"]');
  const ascending = page.locator('[data-component$="/ascending"]');
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部12');
  await expect(ascending.locator('tbody tr').first()).toContainText('合成地区部01');
  await descending.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部02');
  await expect(ascending.locator('tbody tr').first()).toContainText('合成地区部01');
  await descending.getByRole('button',{name:/^健康度总分/}).click();
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部08');
  await descending.getByRole('button',{name:/^健康度总分/}).click();
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部01');
});

for (const state of ['empty','error']) {
  test(`global ${state} keeps tabs and presents missing scores without a fabricated total`, async ({page}) => {
    await page.route('**/dsl/execute', async route => {
      const body = route.request().postDataJSON();
      await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map((query: Parameters<typeof currentHealthResult>[0]) => currentHealthResult(query,state))}});
    });
    await page.goto('/pages/partner-health?region-dept=全球');
    await expect(page.getByRole('tab',{name:'地区部',exact:true}).first()).toBeVisible();
    await expect(page.getByRole('tab',{name:'代表处',exact:true}).first()).toBeVisible();
    await expect(page.locator('[data-component$="/total-score-card"]')).toContainText('--');
    await expect(page.getByRole('table').first()).toContainText('暂无数据');
  });
}
