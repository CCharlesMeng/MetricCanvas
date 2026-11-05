import { expect, test } from '@playwright/test';
import { drawingCount, presentationFixtures } from './presentation-fixtures';

test('modular chart runtime retains declared chart variants and map overlays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/examples/inline.html');
  await page.waitForFunction(() => Boolean(window.runtime));
  const names = [
    'barChart', 'barChart-reportForecast', 'lineChart', 'pieChart', 'pieChart-compactRing',
    'mapChart', 'mapChart-regionalOverview'
  ];
  const fixtures = presentationFixtures('dashboard').filter(fixture => names.includes(fixture.name));
  expect(fixtures).toHaveLength(names.length);
  for (const fixture of fixtures) await test.step(fixture.name, async () => {
    await page.evaluate(json => {
      const document = JSON.parse(json);
      window.runtime.destroy();
      window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: MetricCanvas.createDqeGateway() });
    }, JSON.stringify(fixture.document));
    const expected = fixture.document.sections.flatMap(section => section.components)
      .reduce((count, component) => count + drawingCount(component), 0);
    await expect(page.locator('.echart')).toHaveCount(expected);
    await expect.poll(() => page.locator('.echart').evaluateAll(charts => charts.filter(chart => {
      const canvas = chart.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }).length)).toBe(expected);
  });
  expect(errors).toEqual([]);
});
