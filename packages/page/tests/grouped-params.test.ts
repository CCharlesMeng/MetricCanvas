import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage, validate, normalizePageDocument } from '../src';
const document = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/grouped-params-page.json', 'utf8'));

it('分层参数校验、读写规范化保留原结构，运行态共用声明，原文不变', () => {
  const raw = document(), before = JSON.stringify(raw);
  const parsed = parsePage(raw);
  expect(parsed.errors).toEqual([]);
  if (!parsed.ok) throw new Error('invalid');
  expect(parsed.page.params?.map(p => p.id)).toEqual(['region', 'report-period', 'report-month']);
  expect(JSON.stringify(parsed.page.sections)).toContain('2026-01 至 2026-06');
  const normalized = normalizePageDocument(raw);
  expect(normalized.ok).toBe(true);
  if (normalized.ok) expect(normalized.document.params).toEqual(raw.params);
  const dimension = parsed.page.params?.[0].value;
  if (Array.isArray(dimension)) dimension.push('运行态修改');
  expect(JSON.stringify(raw)).toBe(before);
});

it('同一页面同时写「区间原样用」与「点 + window 派生」', () => {
  const parsed = parsePage(document());
  if (!parsed.ok) throw new Error('invalid');
  const time = (id: string) => {
    const source = parsed.page.dataSources[id].source;
    if (source.type !== 'query') throw new Error('not a query');
    return (source.query.body.dsl_list[0].filter as Record<string, unknown>).time;
  };
  // 校验产物保留引用原样,派生发生在取值期;这里只确认两种写法共存且各自完整。
  expect(time('current')).toEqual({ period: 'month', is_aggregate: true, param: 'report-period' });
  expect(time('rolling')).toEqual({
    period: 'month', is_aggregate: false, param: 'report-month',
    window: { kind: 'lastN', unit: 'month', n: 12 }
  });
});

it('未填值模板可校验，纯展示输入支持实际 value', () => {
  const raw = document();
  delete raw.params.query.dimensions[0].dim_value_list;
  for (const time of raw.params.query.times) { delete time.start; delete time.end; }
  raw.params.display = [{ id: 'heading', type: 'string', value: '对比报告' }];
  raw.sections[0].components[0].props.title = { param: 'heading' };
  expect(validate(raw)).toEqual([]);
});

it.each([
  ['旧版本不能使用新结构', (p: any) => { p.schemaVersion = '6.5'; }],
  ['跨层ID重复', (p: any) => { p.params.query.times[0].id = 'region'; }],
  ['单数time不接受', (p: any) => { p.params.query.time = p.params.query.times[0]; delete p.params.query.times; }],
  ['分组不能留在顶层', (p: any) => { p.params = { dimensions: p.params.query.dimensions, times: p.params.query.times }; }],
  ['重复维度值', (p: any) => { p.params.query.dimensions[0].dim_value_list = ['A', 'A']; }],
  ['空维度值', (p: any) => { p.params.query.dimensions[0].dim_value_list = []; }],
  ['时间半填', (p: any) => { delete p.params.query.times[0].end; }],
  ['时间逆序', (p: any) => { p.params.query.times[0].start = '2027-01'; }],
  ['非法日历', (p: any) => { Object.assign(p.params.query.times[0], { granularity: 'date', start: '2026-02-29', end: '2026-03-01' }); }],
  ['禁止聚合设置进入参数', (p: any) => { p.params.query.times[0].is_aggregate = true; }],
  ['旧default不能充当实际值', (p: any) => { p.params.query.times[0].default = '2026-01'; }],
  ['引用未知参数', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.param = 'missing'; }],
  ['两端点写法已退役', (p: any) => {
    p.dataSources.current.source.query.body.dsl_list[0].filter.time = {
      period: 'month', is_aggregate: true,
      start: { param: 'report-period', part: 'start' }, end: { param: 'report-period', part: 'end' }
    };
  }],
  ['引用不能与字面量起止并存', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.start = '2026-01'; }],
  ['窗口与参数精度不相容', (p: any) => { p.dataSources.rolling.source.query.body.dsl_list[0].filter.time.window = { kind: 'lastN', unit: 'day', n: 7 }; }],
  ['窗口派生要求基准为单点', (p: any) => { p.dataSources.rolling.source.query.body.dsl_list[0].filter.time.param = 'report-period'; }],
  ['展示输入不能进查询', (p: any) => {
    p.params.display = [{ id: 'note', type: 'string', value: '中国地区部' }];
    p.dataSources.current.source.query.body.dsl_list[0].filter.dims[0].dim_value_list = { param: 'note' };
  }],
  ['禁止引用字段名', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].output_dims = [{ param: 'region' }]; }],
  ['目标维度必须一致', (p: any) => { p.params.query.dimensions[0].dim_name = 'office'; }],
  ['不允许可选查询时间', (p: any) => { p.params.query.times[0].required = false; }],
  ['聚合精度不兼容', (p: any) => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.period = 'day'; }],
  ['原位与筛选不能双控', (p: any) => { p.dataSources.current.source.query.filterBindings = { period: { target: 'time' } }; }]
])('%s', (_, mutate) => {
  const raw = document(); mutate(raw);
  expect(validate(raw).length).toBeGreaterThan(0);
});
