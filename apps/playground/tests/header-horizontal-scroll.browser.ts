import { expect, test, type Locator, type Page } from '@playwright/test';

async function preview(page: Page, components: unknown[], filters: unknown[] = []) {
  await page.goto('/preview');
  await page.getByRole('textbox', { name: 'Page JSON 编辑器' }).fill(JSON.stringify({
    schemaVersion: '6.81', id: 'header-scroll-test', layout: 'dashboard',
    meta: { title: '标题栏滚动回归' }, dataSources: {}, filters,
    sections: [{ id: 'main', container: 'plain', components }]
  }));
  await expect(page.getByText('契约有效', { exact: true })).toBeVisible();
  // Give the runtime the full preview width, including its desktop breakpoint.
  await page.locator('.workspace').evaluate(element => { element.style.gridTemplateColumns = 'minmax(0, 1fr)'; });
  await page.locator('.editor-panel').evaluate(element => { element.style.display = 'none'; });
}

async function horizontalOnly(strip: Locator) {
  const facts = await strip.evaluate(element => {
    const style = getComputedStyle(element);
    element.scrollLeft = element.scrollWidth;
    return { vertical: style.overflowY,
      width: element.clientWidth, scrollWidth: element.scrollWidth, left: element.scrollLeft };
  });
  expect(facts.vertical).toBe('hidden');
  expect(facts.scrollWidth).toBeGreaterThan(facts.width);
  expect(facts.left).toBeGreaterThan(0);
}

test('Tab title strips keep full button height and horizontal navigation', async ({ page }) => {
  const components = ['compact', 'analysisStack'].map(variant => ({
    id: variant.toLowerCase(), type: 'tabContainer', layout: { span: 12 },
    props: { variant, tabs: Array.from({ length: 12 }, (_, index) => ({
      id: `tab-${index}`, label: `业务分析页签 ${index}`,
      component: { id: `${variant.toLowerCase()}-text-${index}`, type: 'text', layout: { span: 12 }, props: { body: `内容 ${index}` } }
    })) }
  }));
  await preview(page, components);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const variant of ['compact', 'analysis-stack']) {
      const container = page.locator(`.tab-container.${variant}`), strip = container.getByRole('tablist');
      await horizontalOnly(strip);
      const height = await strip.evaluate(element => ({ available: element.clientHeight, button: element.querySelector('button')!.getBoundingClientRect().height }));
      expect(height.button).toBeLessThanOrEqual(height.available);
      await container.getByRole('tab', { name: '业务分析页签 11', exact: true }).click();
      await expect(container.getByRole('tabpanel')).toContainText('内容 11');
    }
  }
});

test('compact IOC header wraps without scrollbars and keeps selection popovers usable', async ({ page }) => {
  const filters = Array.from({ length: 10 }, (_, index) => ({
    id: `filter-${index}`, type: 'dimension', dimension: `dimension-${index}`, label: `业务筛选 ${index}`,
    selection: { mode: 'single' }, default: ['A'], options: [{ value: 'A', label: '选项甲' }, { value: 'B', label: '选项乙' }]
  }));
  await preview(page, [{ id: 'header', type: 'iocHeader', layout: { span: 12 }, props: {
    identity: { title: '经营概览' }, filterIds: filters.map(filter => filter.id),
    presentation: { layout: 'inline', density: 'compact', collapse: 'none' }
  } }], filters);
  const header = page.locator('[data-ioc-header]');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await header.evaluate(element => Array.from(element.querySelectorAll('[data-ioc-filter]')).every(control => control.getBoundingClientRect().right <= element.getBoundingClientRect().right))).toBe(true);
    const last = header.locator('[data-filter-id="filter-9"]');
    await last.getByRole('button', { name: '业务筛选 9', exact: true }).click();
    await expect(last.getByRole('option', { name: '选项乙', exact: true })).toBeVisible();
    await last.getByRole('option', { name: '选项乙', exact: true }).click();
    await expect(last.getByRole('button', { name: '业务筛选 9', exact: true })).toContainText('选项乙');
    expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await header.evaluate(element => Array.from(element.querySelectorAll('[data-ioc-filter]')).every(control => control.getBoundingClientRect().right <= element.getBoundingClientRect().right))).toBe(true);
  }
});
