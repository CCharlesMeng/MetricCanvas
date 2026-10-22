import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolvePageParams, validate } from '../src/internal';

const load = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/time-point-min-page.json', import.meta.url), 'utf8'));
describe('timePoint.min', () => {
  it('accepts both inclusive month/date bounds and preserves older unbounded pages', () => {
    const page = load();
    page.filters[0].default = '2020-06';
    expect(validate(page)).toEqual([]);
    delete page.filters[0].min; delete page.filters[1].min;
    page.schemaVersion = '6.23';
    expect(validate(page)).toEqual([]);
  });
  it.each([
    ['min', '2020-13', '有效月份'], ['min', '2020-06-01', 'YYYY-MM'],
    ['default', '2020-05', '不得早于'], ['default', '2019-12', '不得早于']
  ])('rejects month %s=%s', (key, value, message) => {
    const page = load(); page.filters[0][key] = value;
    expect(validate(page)).toEqual(expect.arrayContaining([expect.objectContaining({ path: `/filters/0/${key}`, message: expect.stringContaining(message) })]));
  });
  it('rejects invalid date minima and defaults before the day boundary', () => {
    const page = load(); page.filters[1].min = '2020-02-30';
    expect(validate(page).some(e => e.path === '/filters/1/min')).toBe(true);
    page.filters[1].min = '2020-06-15'; page.filters[1].default = '2020-06-14';
    expect(validate(page).some(e => e.path === '/filters/1/default' && e.message.includes('不得早于'))).toBe(true);
  });
  it('gates the new declaration at 6.24', () => {
    const page = load(); page.schemaVersion = '6.23';
    expect(validate(page).some(e => e.message.includes('由 6.24 引入'))).toBe(true);
  });
  it('rejects lower initialParam values through public initialization', () => {
    const page = JSON.parse(readFileSync(new URL('../../../pages/business/report/sdt/business-sdt-report-monthly.json', import.meta.url), 'utf8'));
    delete page.filters[0].default;
    page.filters[0].initialParam = 'month';
    page.params = { query: { times: [{ id: 'month', granularity: 'month', start: '2020-05', end: '2020-05' }] } };
    const result = resolvePageParams(page);
    expect(result.ok).toBe(false);
    expect(resolvePageParams(page, { month: { start: '2020-06', end: '2020-06' } }).ok).toBe(true);
  });
});
