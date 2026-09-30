import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';
const fixture = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/cross-source-page.json', import.meta.url), 'utf8'));

describe('6.12 跨源计算协议', () => {
  it('完整样例可校验，6.11 仍可读但不得行使新能力', () => {
    const page = fixture();
    expect(validate(page)).toEqual([]);
    page.schemaVersion = '6.11';
    expect(validate(page).some(error => error.message.includes('6.12'))).toBe(true);
    delete page.dataSources.customers.compute;
    page.dataSources.customers.source.rows.forEach((row: Record<string, unknown>) => row.revenue = null);
    expect(validate(page)).toEqual([]);
  });
  it.each([
    ['未知源', (page: ReturnType<typeof fixture>) => page.dataSources.customers.compute[0].source = 'missing'],
    ['自循环', (page: ReturnType<typeof fixture>) => page.dataSources.customers.compute[0].source = 'customers'],
    ['不可折叠', (page: ReturnType<typeof fixture>) => delete page.dataSources.revenue.fields.amount.collapsible],
    ['不同单位', (page: ReturnType<typeof fixture>) => page.dataSources.revenue.fields.amount.unit = '美元'],
    ['非空产出', (page: ReturnType<typeof fixture>) => page.dataSources.customers.fields.revenue.nullable = false],
    ['类型不同', (page: ReturnType<typeof fixture>) => page.dataSources.revenue.fields.partyNumber.type = 'number'],
    ['重复产出', (page: ReturnType<typeof fixture>) => page.dataSources.customers.compute.push(page.dataSources.customers.compute[0])],
    ['输入伪造产出', (page: ReturnType<typeof fixture>) => page.dataSources.customers.source.rows[0].revenue = 100]
  ])('拒绝%s', (_, change) => { const page = fixture(); change(page); expect(validate(page).length).toBeGreaterThan(0); });
  it('跨源链不可提前读取后续产出', () => {
    const page = fixture();
    page.dataSources.customers.fields.gap = { type: 'number', role: 'measure' };
    page.dataSources.customers.compute.unshift({ op: 'delta', minuend: 'revenue', subtrahend: 'revenue', output: 'gap' });
    expect(validate(page).some(error => error.message.includes('尚不可用'))).toBe(true);
  });
});

it('查询依赖必须声明完整结果且不允许显式分页窗口', () => {
  const page = fixture();
  page.dataSources.revenue.fields.partyNumber.queryField = 'partyNumber';
  page.dataSources.revenue.fields.amount.queryField = 'amount';
  page.dataSources.revenue.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['partyNumber'], output_metrics: ['amount'], filter: { dims: [], metrics: [] }, order: {} }] } } };
  expect(validate(page).some(error => error.message.includes('完整行集'))).toBe(true);
  page.dataSources.revenue.source.resultScope = 'complete';
  expect(validate(page)).toEqual([]);
  page.dataSources.revenue.source.query.body.dsl_list[0].order = { limit: 10, offset: 0 };
  expect(validate(page).some(error => error.message.includes('完整行集'))).toBe(true);
});

it('字段合计与 CAGR 为6.12增量，缺失允许为空、单位一致且算子有序', () => {
  const page = fixture();
  page.dataSources = { values: {
    fields: { a: { type: 'number', role: 'measure', unit: '元' }, b: { type: 'number', role: 'measure', unit: '元' },
      n: { type: 'number', role: 'measure' }, total: { type: 'number', role: 'measure', unit: '元' }, rate: { type: 'number', role: 'measure' } },
    source: { type: 'inline', rows: [{ a: 100, b: 200, n: 6 }] },
    compute: [{ op: 'sumFields', fields: ['a', 'b'], output: 'total', onMissing: 'null' },
      { op: 'cagr', beginning: 'a', ending: 'b', periods: 'n', output: 'rate', scale: 100 }]
  } };
  page.sections[0].components[0].data.main = 'values';
  page.sections[0].components[0].props.columns = [{ field: 'total' }, { field: 'rate' }];
  expect(validate(page)).toEqual([]);
  page.dataSources.values.fields.rate.nullable = false;
  expect(validate(page).some(error => error.message.includes('允许为空'))).toBe(true);
});
