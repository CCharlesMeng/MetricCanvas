import { expect, test } from '@playwright/test';

test('column selection writes the configured field and reruns only the bound query', async ({ page }) => {
  const requests: unknown[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') requests.push(request.postDataJSON());
  });
  await page.goto('/pages/table-cell-selection');
  const source = page.locator('[data-component="main/regions"]');
  const details = page.locator('[data-component="main/details"]');
  await expect(source.locator('tbody tr')).toHaveCount(8);
  await expect(details.locator('tbody tr')).toHaveCount(8);
  const region = source.getByRole('button', { name: '华南地区部', exact: true });
  await region.click();
  await expect(region).toHaveAttribute('aria-pressed', 'true');
  await expect(details.locator('tbody tr')).toHaveCount(1);
  await expect(details.getByRole('cell', { name: '深圳代表处', exact: true })).toBeVisible();
  await expect(source.locator('tbody tr')).toHaveCount(8);
  const count = requests.length;
  await region.click();
  await expect(region).toHaveAttribute('aria-pressed', 'true');
  expect(requests).toHaveLength(count);
  await source.getByRole('button', { name: '华东地区部', exact: true }).press('Enter');
  await expect(details.getByRole('cell', { name: '杭州代表处', exact: true })).toBeVisible();
});

test('selection and navigation cells advertise clicks with an underline in each table variant', async ({ page }) => {
  await page.goto('/pages/table-cell-selection');
  await expect(page.locator('.selectable-cell').first()).toBeVisible();
  for (const variant of [undefined, 'forecastMatrix', 'embedded', 'reportCompact']) {
    await page.evaluate(variant => {
      const document = structuredClone(window.pageDocument);
      document.sections[0].components[1].props.variant = variant;
      window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() });
    }, variant);
    const source = page.locator('[data-component="main/regions"]');
    for (const selector of ['.selectable-cell', '.link-cell', '.selectable-cell .cell-primary-value', '.link-cell .cell-primary-value']) {
      await expect(source.locator(selector).first(), `${variant ?? 'default'} ${selector}`).toHaveCSS('text-decoration-line', 'underline');
    }
  }
});

test('an inline selection table can write observable filters for its downstream query', async ({ page }) => {
  await page.goto('/pages/table-cell-selection');
  await expect(page.locator('.selectable-cell').first()).toBeVisible();
  await page.evaluate(() => {
    const document = structuredClone(window.pageDocument);
    const source = document.dataSources.regions;
    for (const field of Object.values(source.fields) as Array<Record<string, unknown>>) delete field.queryField;
    const row = Object.fromEntries(Object.keys(source.fields).map(key => [key,
      key === 'region-dept-name' ? '华南地区部' : source.fields[key].type === 'number' ? 1 : '代表处']));
    document.sections[0].components[1].props.columns = [document.sections[0].components[1].props.columns[0]];
    source.source = { type: 'inline', rows: [row] };
    window.queryEvents = [];
    window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() });
  });
  const button = page.getByRole('button', { name: '华南地区部', exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-component="main/details"] tbody tr')).toHaveCount(1);
  await expect(page.locator('[data-component="main/details"]')).toContainText('深圳代表处');
});

test('selection cells keep ordinary colors before clicking and after keyboard selection', async ({ page }) => {
  await page.goto('/pages/table-cell-selection');
  await expect(page.locator('.selectable-cell').first()).toBeVisible();
  for (const variant of [undefined, 'forecastMatrix', 'embedded', 'reportCompact']) {
    await page.evaluate(variant => {
      const document = structuredClone(window.pageDocument);
      document.sections[0].components[1].props.variant = variant;
      window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() });
    }, variant);
    const source = page.locator('[data-component="main/regions"]');
    const button = source.getByRole('button', { name: '华南地区部', exact: true });
    const cell = source.locator('td.selectable').filter({ hasText: '华南地区部' });
    const skin = { forecastMatrix: 'forecast-matrix', embedded: 'embedded', reportCompact: 'report-compact' }[variant ?? 'forecastMatrix'];
    if (variant) await expect(source.locator('.table-widget')).toHaveClass(new RegExp(`\\b${skin}\\b`));
    await expect(button).toBeVisible();
    const normal = await source.locator('td:not(.selectable)').first().evaluate(element => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    await expect(cell).toHaveCSS('background-color', normal.background);
    await expect(button).toHaveCSS('color', normal.color);
    await button.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(cell).toHaveCSS('background-color', normal.background);
    await expect(cell).toHaveCSS('box-shadow', 'none');
    await expect(button).toHaveCSS('color', normal.color);
    await expect(button).toHaveCSS('outline-color', normal.color);
    await expect(button).toHaveCSS('text-decoration-line', 'underline');
    await expect(page.locator('[data-component="main/details"] tbody tr')).toHaveCount(1);
  }
});

test('writing a filter does not refetch queries without a matching binding', async ({ page }) => {
  await page.goto('/pages/table-cell-selection');
  await expect(page.locator('.selectable-cell').first()).toBeVisible();
  await page.evaluate(() => {
    const document = structuredClone(window.pageDocument);
    delete document.dataSources.details.source.query.filterBindings;
    window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() });
  });
  const details = page.locator('[data-component="main/details"]');
  await expect(details.locator('tbody tr')).toHaveCount(8);
  const button = page.getByRole('button', { name: '华南地区部', exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(details.locator('tbody tr')).toHaveCount(8);
});
