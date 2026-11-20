import { expect, test, type Locator, type Page } from '@playwright/test';

async function openFilter(header: Locator) {
  if (await header.locator('details').getAttribute('open') === null) await header.locator('summary').click();
}

async function observeRequests(page: Page) {
  await page.addInitScript(() => {
    const requests: Array<{ phase: string; kind: string; offset: number }> = [];
    Object.assign(window, { syntheticColumnRequests: requests });
    window.addEventListener('metriccanvas:synthetic-column-query', event => requests.push((event as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as typeof window & { syntheticColumnRequests: Array<{ phase: string; kind: string; offset: number }> }).syntheticColumnRequests);
}

test('renders first, preloads on idle, and pages immediately while a candidate request never returns', async ({ page }) => {
  const requests = await observeRequests(page);
  await page.goto('/pages/table-column-candidates-query?state=blocked-candidates');
  const table = page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 620');
  await expect.poll(async () => (await requests()).some(event => event.kind === 'candidate' && event.phase === 'start')).toBe(true);
  expect((await requests())[0]).toMatchObject({ kind: 'table', phase: 'start', offset: 0 });
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('21');
  await expect(table).toContainText('总条数： 620');
  expect(await requests()).toContainEqual({ phase: 'abort', kind: 'candidate', offset: 0 });
  await page.screenshot({ path: test.info().outputPath('nonblocking-preload.png'), fullPage: true });
});

test('opening another column preempts a hung preload and leaves the rendered table usable', async ({ page }) => {
  const requests = await observeRequests(page);
  await page.goto('/pages/table-column-candidates-query?state=blocked-candidates');
  const table = page.locator('.runtime-view .table-widget');
  await expect.poll(async () => (await requests()).filter(event => event.kind === 'candidate' && event.phase === 'start').length).toBe(1);
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await expect(offices.locator('.text-skeleton')).toBeVisible();
  await expect(offices.getByText('候选项加载中…')).toHaveCount(0);
  await expect.poll(async () => (await requests()).some(event => event.kind === 'candidate' && event.phase === 'abort')).toBe(true);
  await expect.poll(async () => (await requests()).filter(event => event.kind === 'candidate' && event.phase === 'start').length).toBe(2);
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await expect(table).toContainText('总条数： 620');
});

test('remote candidates read across 200-row batches and keep alternatives after selecting their own column', async ({ page }) => {
  const requests = await observeRequests(page);
  await page.goto('/pages/table-column-candidates-query');
  const table = page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 620');
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await expect(offices.getByRole('checkbox')).toHaveCount(50);
  await expect(offices.getByRole('button', { name: /加载更多/ })).toHaveCount(0);
  await expect(offices.getByRole('status')).toHaveCount(0);
  const start = (await requests()).length;
  const search = offices.getByRole('searchbox');
  await search.fill('办');
  await search.fill('办事处8');
  await search.fill('办事处80');
  await expect(offices.getByRole('checkbox')).toHaveCount(1);
  await expect(offices.getByRole('status')).toHaveCount(0);
  expect((await requests()).slice(start).filter(event => event.kind === 'candidate' && event.phase === 'start')
    .map(event => event.offset)).toEqual([0, 200, 400, 600]);
  await offices.getByRole('checkbox', { name: '办事处80', exact: true }).click();
  await expect(table).toContainText('总条数： 1');
  await openFilter(offices);
  await offices.getByRole('searchbox').fill('');
  await expect(offices.locator('.candidate:not(.selected)')).toHaveCount(50);
  await offices.locator('.list').hover();
  await page.mouse.wheel(0, 2000);
  await expect(offices.getByRole('checkbox')).toHaveCount(80);
  const selectedOffice = offices.getByRole('checkbox', { name: '办事处80', exact: true });
  await expect(selectedOffice).toBeChecked();
  await selectedOffice.uncheck();
  await expect(table).toContainText('总条数： 620');
  await offices.locator('summary').click();
  const region = table.locator('th[data-column-field="region"]');
  await region.locator('summary').click();
  await expect(region.getByRole('checkbox', { name: '华北', exact: true })).toBeVisible();
  await region.getByRole('checkbox', { name: '华南', exact: true }).click();
  await expect(table).toContainText('总条数： 20');
  await openFilter(offices);
  await expect(offices.getByRole('checkbox')).toHaveCount(20);
  await expect(offices.getByRole('checkbox', { name: '办事处61', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('full-query-candidates.png'), fullPage: true });
});

test('over-budget candidates explain the limit without partial options or blocking table paging', async ({ page }) => {
  const requests = await observeRequests(page);
  await page.goto('/pages/table-column-candidates-query?state=over-limit');
  const table = page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 1001');
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await expect(offices.getByRole('status')).toContainText('超过1000条查询上限');
  await expect(offices.getByRole('status')).toContainText('请缩小筛选范围');
  await expect(offices.getByRole('checkbox')).toHaveCount(0);
  await expect(offices.getByRole('searchbox')).toBeDisabled();
  await expect(offices.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  expect((await requests()).filter(event => event.kind === 'candidate' && event.phase === 'start').every(event => event.offset === 0)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('candidate-limit.png'), fullPage: true });
  await offices.locator('summary').click();
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('21');
});

test('an explicit runtime override permits the complete candidate range above 1000 rows', async ({ page }) => {
  await page.goto('/pages/table-column-candidates-query?state=raised-limit');
  const table = page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 1001');
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await expect(offices.getByRole('checkbox')).toHaveCount(50);
  await expect(offices.getByRole('status')).toHaveCount(0);
});

test('source truncation shows a retryable failure while the ordinary table remains usable', async ({ page }) => {
  await page.goto('/pages/table-column-candidates-query?state=truncated');
  const table = page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 620');
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await expect(offices.getByText('候选项加载失败')).toBeVisible();
  await expect(offices.getByRole('checkbox')).toHaveCount(0);
  await expect(offices.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('full-query-candidates-truncated.png'), fullPage: true });
});

async function openProgressiveRegion(page: Page, state: string) {
  const requests = await observeRequests(page);
  await page.goto(`/pages/table-column-candidates-query?state=${state}`);
  const table = page.locator('.runtime-view .table-widget');
  const region = table.locator('th[data-column-field="region"]');
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await expect.poll(async () => (await requests()).filter(event => event.kind === 'candidate' && event.phase === 'start')
    .map(event => event.offset)).toEqual([0, 200]);
  await region.locator('summary').click();
  await expect(region.getByRole('checkbox', { name: '华北', exact: true })).toBeEnabled();
  await expect(region.getByRole('checkbox', { name: '全选', exact: true })).toBeDisabled();
  await expect(region.getByRole('status')).toHaveText('正在加载更多选项');
  return { region, table, requests };
}

function releaseCandidateBatch(page: Page) {
  return page.evaluate(() => window.dispatchEvent(new Event('metriccanvas:synthetic-column-continue')));
}

test('an open menu reuses the partial preload and keeps focus while appending verified choices', async ({ page }) => {
  const execution = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).searchParams.has('hold'));
  const { region, requests } = await openProgressiveRegion(page, 'progressive-candidates');
  const held = await execution;
  expect(new URL(held.url()).pathname).toMatch(/\/execute$/);
  expect(held.postDataJSON().dsl_list[0].order).toMatchObject({ offset: 200, limit: 200 });
  expect((await requests()).filter(event => event.kind === 'candidate' && event.phase === 'start')
    .map(event => event.offset)).toEqual([0, 200]);
  const north = region.getByRole('checkbox', { name: '华北', exact: true });
  await north.focus();
  await expect(region.getByRole('checkbox', { name: '华南', exact: true })).toHaveCount(0);
  await page.keyboard.press('Alt+Enter');
  expect((await held.response())?.status()).toBe(200);
  await expect(region.getByRole('checkbox', { name: '华南', exact: true })).toBeVisible();
  await expect(region.getByRole('checkbox', { name: '全选', exact: true })).toBeEnabled();
  await expect(north).toBeFocused();
  await expect(region.locator('.candidate')).toHaveText(['华北', '华南']);
});

test('a partial option can immediately filter the table and preempt remaining candidate reads', async ({ page }) => {
  const { region, table, requests } = await openProgressiveRegion(page, 'progressive-candidates');
  await region.getByRole('checkbox', { name: '华北', exact: true }).click();
  await expect(table).toContainText('总条数： 600');
  expect(await requests()).toContainEqual({ phase: 'abort', kind: 'candidate', offset: 200 });
});

test('a later truncated batch withdraws partial choices', async ({ page }) => {
  const { region } = await openProgressiveRegion(page, 'late-truncated');
  await releaseCandidateBatch(page);
  await expect(region.getByRole('status')).toHaveText('候选项加载失败');
  await expect(region.getByRole('checkbox', { name: '华北', exact: true })).toHaveCount(0);
  await expect(region.getByRole('checkbox', { name: '全选', exact: true })).toBeDisabled();
});

test('a transient failure keeps verified choices visible until an explicit retry completes', async ({ page }) => {
  const { region } = await openProgressiveRegion(page, 'candidate-retry');
  await releaseCandidateBatch(page);
  await expect(region.getByRole('status')).toHaveText('候选加载未完成');
  await expect(region.getByRole('checkbox', { name: '华北', exact: true })).toBeEnabled();
  await expect(region.getByRole('checkbox', { name: '全选', exact: true })).toBeDisabled();
  await region.getByRole('button', { name: '重试' }).click();
  await expect(region.getByRole('checkbox', { name: '华南', exact: true })).toBeVisible();
  await expect(region.getByRole('checkbox', { name: '全选', exact: true })).toBeEnabled();
});
