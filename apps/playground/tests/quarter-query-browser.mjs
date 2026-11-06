import {chromium, expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QUARTER_QUERY_BASE_URL ?? 'http://127.0.0.1:5208';
const output = process.argv[2] ?? '/tmp/metriccanvas-quarter-query';
const fixture = JSON.parse(await readFile(new URL('../../../pages/capabilities/filters/quarter-query-period.json', import.meta.url), 'utf8'));
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const requests = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/dsl/execute', async route => {
  requests.push(route.request().postDataJSON());
  await route.fulfill({json: {retCode: 'CBC.0000', results: [{code: 'SUCCESS', data: [{'区域': '合成地区', 'Tokens消耗量': 30}], total_count: 1}]}});
});
const times = () => requests.flatMap(request => request.dsl_list.map(item => item.filter.time));
try {
  await page.goto(`${base}/pages/${fixture.id}`);
  const selected = fixture.filters[0].default.value;
  await expect.poll(times).toContainEqual({period: 'quarter', start: selected, end: selected, is_aggregate: true});
  await expect(page.getByText('合成地区', {exact: true})).toBeVisible();
  await page.screenshot({path: path.join(output, 'quarter.png'), fullPage: true});
  await page.getByRole('button', {name: '月', exact: true}).click();
  await expect.poll(() => times().some(time => time.period === 'month')).toBe(true);
  await page.getByRole('button', {name: '年', exact: true}).click();
  await expect.poll(() => times().some(time => time.period === 'year')).toBe(true);
  await page.getByRole('button', {name: '季', exact: true}).click();
  await expect(page.getByRole('button', {name: '季', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: '近一年', exact: true}).click();
  await expect.poll(() => times().some(time => time.period === 'month' && time.start !== time.end)).toBe(true);
  await expect(page.getByText('合成地区', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({page: fixture.id, data: 'synthetic HTTP response', requests, errors}, null, 2));
  console.log('Quarter query browser acceptance passed');
} finally {
  await browser.close();
}
