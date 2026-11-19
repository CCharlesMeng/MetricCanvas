import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const [pageId, expectedGap] of [
  ['chart-axis-unit', 0],
  ['table-child-keyless', 16]
] as const) {
  test(`${pageId} keeps one gap below the IOC header and the expected section spacing`, async ({ page }) => {
    await page.goto(`/pages/${pageId}`);
    const leading = page.locator('[data-leading-header-section]');
    const header = leading.locator('[data-ioc-header]');
    const content = page.locator('[data-leading-header-section] + .page-sections');
    const firstBody = page.locator(
      '[data-leading-header-section] .ioc-header-cell + *, [data-leading-header-section] + .page-sections'
    ).first();
    await expect(header).toBeVisible();
    await expect(firstBody).toBeVisible();
    await expect.poll(async () => {
      const headerBox = (await header.boundingBox())!;
      const leadingBox = (await leading.boundingBox())!;
      const firstBodyBox = (await firstBody.boundingBox())!;
      const contentBox = (await content.boundingBox())!;
      return {
        belowHeader: Math.round(firstBodyBox.y - headerBox.y - headerBox.height),
        belowLeadingSection: Math.round(contentBox.y - leadingBox.y - leadingBox.height)
      };
    }).toEqual({ belowHeader: 16, belowLeadingSection: expectedGap });
  });
}

async function expectNoHeaderScrollbars(header: Locator) {
  const scrollbars = await header.evaluate(node => Array.from(node.querySelectorAll('*')).concat(node).filter(element => {
    if (element.closest('[popover], [role="dialog"]') || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1
      || /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
  }).map(element => element.className));
  expect(scrollbars).toEqual([]);
  expect(await header.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
}

test('ordinary overflow header has no reserved title column and pins the same controls', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.goto('/pages/ioc-header-flow-sticky');
  const header = page.locator('[data-ioc-header]');
  await expect(header).toHaveCount(1);
  const gap = await header.evaluate(node => node.querySelector('[data-ioc-filter]')!.getBoundingClientRect().left
    - node.querySelector('h1')!.getBoundingClientRect().right);
  expect(gap).toBeGreaterThanOrEqual(16);
  expect(gap).toBeLessThanOrEqual(48);
  await header.getByRole('button', { name: '月', exact: true }).click();
  await page.mouse.wheel(0, 700);
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(0, 0);
  await expect(header).toHaveCount(1);
  await expect(header.getByRole('combobox')).toHaveValue('2026-01');
  await expectNoHeaderScrollbars(header);
  await page.mouse.wheel(0, -2000);
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);
  await expect(header.getByRole('combobox')).toHaveValue('2026-01');
});

test('integrating application dropdown covers the pinned header and IOC filters still open', async ({ page }) => {
  await page.goto('/pages/ioc-header-section-sticky');
  const header = page.locator('[data-ioc-header]');
  await expect(header).toBeVisible();
  await page.evaluate(() => window.scrollBy(0, 700));
  const frame = page.locator('[data-ioc-floating]');
  await expect(frame).toHaveCount(1);

  const hostDropdown = page.getByRole('button', { name: '集成应用下拉选项' });
  await frame.evaluate(node => {
    const dropdown = document.createElement('button');
    dropdown.textContent = '集成应用下拉选项';
    const { left, top, width, height } = node.getBoundingClientRect();
    dropdown.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${width}px;height:${height}px;z-index:4900`;
    dropdown.addEventListener('click', () => dropdown.remove());
    document.body.append(dropdown);
  });
  await hostDropdown.click({ timeout: 2000 });
  await expect(hostDropdown).toHaveCount(0);
  await expect(frame).not.toHaveAttribute('popover');

  await header.getByRole('button', { name: '团队', exact: true }).click();
  await expect(header.locator(':popover-open').getByRole('option', { name: '团队乙' })).toBeVisible();
  await header.getByRole('option', { name: '团队乙' }).click();
  await expect(header).toContainText('当前团队：B');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(frame).toHaveCount(0);
  await expect(header).toContainText('当前团队：B');
});

test('pinned header does not drift between a scroll event and the next animation frame', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 });
  await page.goto('/pages/ioc-header-flow-sticky');
  await expect(page.locator('[data-ioc-header]')).toBeVisible();
  await page.mouse.wheel(0, 400);
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await page.evaluate(() => {
    const samples = document.createElement('output');
    samples.dataset.iocScrollSamples = '';
    samples.hidden = true;
    document.body.append(samples);
    window.addEventListener('scroll', () => {
      const frame = document.querySelector('[data-ioc-floating]');
      if (frame) samples.textContent += `${frame.getBoundingClientRect().top},`;
    }, true);
  });
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, -50);
  await expect.poll(async () => (await page.locator('[data-ioc-scroll-samples]').textContent())!.length).toBeGreaterThan(0);
  const samples = (await page.locator('[data-ioc-scroll-samples]').textContent())!.split(',').filter(Boolean).map(Number);
  expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
});

test('compact header wraps every control without either scrollbar and still pins', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/pages/ioc-header-section-sticky');
  const header = page.locator('[data-ioc-header]');
  await expect(header.getByRole('checkbox', { name: '仅看已签约项目' })).toBeVisible();
  await expectNoHeaderScrollbars(header);
  await header.getByRole('checkbox', { name: '仅看本年新增' }).check();
  await page.mouse.wheel(0, 700);
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(0, 0);
  await expect(header.getByRole('checkbox', { name: '仅看本年新增' })).toBeChecked();
  await expectNoHeaderScrollbars(header);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('measured first-row collapse still expands naturally without internal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/pages/ioc-header-dense-filter-demo');
  const header = page.locator('[data-ioc-header]');
  await header.getByRole('button', { name: '展开筛选' }).click();
  await expect(header.locator('[data-ioc-filter][inert]')).toHaveCount(0);
  await expectNoHeaderScrollbars(header);
  await header.getByRole('button', { name: '收起筛选' }).click();
  await expect(header.locator('[data-ioc-filter][inert]').first()).toBeAttached();
  await expectNoHeaderScrollbars(header);
});

test('nested header stays at the viewport top when the outer page also scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 360 });
  await page.goto('/preview?prototype=ioc-header-component');
  await page.getByLabel('验收模式').selectOption('nested');
  await page.locator('[data-nested-scroll]').hover();
  await page.mouse.wheel(0, 650);
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await page.mouse.move(595, 250);
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => (await page.locator('[data-nested-scroll]').boundingBox())!.y).toBeLessThan(0);
  await expect.poll(async () => (await page.locator('[data-ioc-header]').boundingBox())!.y).toBeCloseTo(0, 0);
  await expectNoHeaderScrollbars(page.locator('[data-ioc-header]'));
});

test('shadow-mounted header respects the mount scroll region below the public header', async ({ page }) => {
  await page.goto('/preview?prototype=ioc-header-component');
  await page.getByLabel('验收模式').selectOption('mount-scroll');
  const region = page.locator('[data-mount-scroll]');
  const header = page.locator('[data-ioc-header]');
  await expect(header).toBeVisible();
  await region.evaluate(node => { node.scrollTop = 650; });
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await expect.poll(async () => (await header.boundingBox())!.y - (await region.boundingBox())!.y).toBeCloseTo(1, 0);
  expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('[data-public-header]').boundingBox())!.y + 88);
  await expectNoHeaderScrollbars(header);
  await region.evaluate(node => { node.scrollTop = 0; });
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);
});

test('shadow-mounted header pins at the scaled scroll region edge without changing its size', async ({ page }) => {
  await page.goto('/preview?prototype=ioc-header-component');
  await page.getByLabel('验收模式').selectOption('mount-scroll');
  const region = page.locator('[data-mount-scroll]');
  const header = page.locator('[data-ioc-header]');
  await expect(header).toBeVisible();
  await region.evaluate(node => {
    node.style.transform = 'scale(0.9, 0.75)';
    node.style.transformOrigin = 'top left';
    node.style.borderTopWidth = '12px';
  });
  const original = (await header.boundingBox())!;
  const scrollportTop = (await region.boundingBox())!.y + 12 * 0.75;

  await region.evaluate(node => { node.scrollTop = 650; });
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
  await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(scrollportTop, 0);
  const pinned = (await header.boundingBox())!;
  expect(pinned.x).toBeCloseTo(original.x, 0);
  expect(pinned.width).toBeCloseTo(original.width, 0);
  expect(pinned.height).toBeCloseTo(original.height, 0);
  await region.evaluate(node => { node.scrollTop = 0; });
  await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);
  await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(original.y, 0);
});

test('more filters stays inside the viewport when its trigger wraps onto another row', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../pages/capabilities/ioc-header/section-component/ioc-header-flow-sticky.json', import.meta.url), 'utf8'));
  document.filters = Array.from({ length: 6 }, (_, index) => ({ id: `flag-${index}`, type: 'boolean', label: `条件${index + 1}`, default: false }));
  document.sections[0].components[0].props.filterIds = document.filters.map((filter: { id: string }) => filter.id);
  await page.setViewportSize({ width: 600, height: 850 });
  await page.goto('/preview');
  await page.getByRole('textbox', { name: 'Page JSON 编辑器' }).fill(JSON.stringify(document));
  const header = page.locator('[data-ioc-header]');
  await header.locator('[data-dashboard-filter-overflow] > summary').click();
  const panel = await header.locator('.overflow-panel').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(600);
  await expectNoHeaderScrollbars(header);
});
