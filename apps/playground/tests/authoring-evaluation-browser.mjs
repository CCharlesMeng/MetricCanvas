import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5191';
const output = process.argv[2] ?? '/tmp/metriccanvas-authoring-evaluation';
const document = JSON.parse(await readFile(new URL('../../../pages/capabilities/authoring/evaluation-context/authoring-evaluation-context.json', import.meta.url), 'utf8'));
const validationModule = `/@fs/${path.resolve('packages/page/src/validate.ts')}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], receipts = [];
try {
  for (const timezoneId of ['UTC', 'Pacific/Honolulu']) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(`${base}/pages/${document.id}`);
      const date = page.getByRole('combobox', { name: '日期', exact: true });
      const month = page.getByRole('combobox', { name: '月份', exact: true });
      const selectedDate = page.locator('[data-component="current-selection/selected-date"]');
      const selectedMonth = page.locator('[data-component="current-selection/selected-month"]');
      await expect(date).toHaveValue('2020-01-01', { timeout: 30_000 });
      await expect(month).toHaveValue('2020-01');
      await expect(selectedDate).toContainText('2020-01-01');
      await date.fill('2020-01-02');
      await date.press('Enter');
      await expect(selectedDate).toContainText('2020-01-02');
      await expect(selectedMonth).toContainText('2020-01');
      await month.fill('2020-02');
      await month.press('Enter');
      await expect(selectedMonth).toContainText('2020-02');
      await expect(selectedDate).toContainText('2020-01-02');
      await page.screenshot({ path: path.join(output, `${timezoneId.replaceAll('/', '-')}-${width}.png`), fullPage: true });
      receipts.push({ timezoneId, width, date: await selectedDate.innerText(), month: await selectedMonth.innerText() });
    }
    const boundary = await page.evaluate(async ({ document, validationModule }) => {
      const { parsePage } = await import(validationModule);
      const candidate = structuredClone(document);
      candidate.filters[0].default = '2027-01-01';
      const instant = '2026-12-31T16:30:00Z';
      return ['Asia/Shanghai', 'America/Los_Angeles'].map(timeZone => {
        const result = parsePage(candidate, { evaluation: { instant, timeZone } });
        return { timeZone, ok: result.ok, errors: result.errors };
      });
    }, { document, validationModule });
    expect(boundary[0]).toEqual({ timeZone: 'Asia/Shanghai', ok: true, errors: [] });
    expect(boundary[1].ok).toBe(false);
    expect(boundary[1].errors).toContainEqual(expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/filters/0/default', message: '时间点不得晚于当前日期' }));
    receipts.push({ timezoneId, boundary });
    await context.close();
  }
  expect(receipts[2].boundary).toEqual(receipts[5].boundary);
  expect(errors).toEqual([]);
  expect(document.filters[0].default).toBe('2020-01-01');
  await writeFile(path.join(output, 'browser.json'), JSON.stringify({ base, pageId: document.id, receipts, errors,
    evidence: 'Actual Playground controls plus same-source parsePage with explicit evaluation; no real DQE/Relay/save' }, null, 2));
  console.log('Authoring evaluation browser acceptance passed');
} finally { await browser.close(); }
