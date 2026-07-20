import { describe, expect, it } from 'vitest';
import { parseApiQuery } from '../src/dialect';
import { executeQuery } from '../src/execute';

/** 期望值全部由 src/tables.ts 种子表手算推得(独立事实),见各测例注释 */
function run(apiQuery: string): Record<string, unknown> {
  return executeQuery(parseApiQuery(apiQuery));
}

const T = 'P001_ADS_T_IOC_SPD_METRIC_ACC_D';

describe('方言执行:@where 过滤 + 保留字段/@function 聚合', () => {
  it('按区域分组求和(gmv,7-20):华东 120+70=190、华北 90+45=135、华南 65+35=100', () => {
    const data = run(
      `{query{${T} @where(value:"metric_code = 'gmv' and mtime = '2026-07-20'"){region metric_value_sum}}}`
    );
    expect(data[T]).toEqual([
      { region: '华东', metric_value_sum: 190 },
      { region: '华北', metric_value_sum: 135 },
      { region: '华南', metric_value_sum: 100 }
    ]);
  });

  it('in 条件切行:channel in (线上) 的 gmv 总和 = 100+80+60+120+90+65 = 515', () => {
    const data = run(
      `{query{${T} @where(value:"metric_code = 'gmv' and channel in ('线上')"){metric_value_sum}}}`
    );
    expect(data[T]).toEqual([{ metric_value_sum: 515 }]);
  });

  it('between 条件:mtime between 两天,gmv 全量总和 = 360+425 = 785', () => {
    const data = run(
      `{query{${T} @where(value:"metric_code = 'gmv' and mtime between '2026-07-19' and '2026-07-20'"){metric_value_sum}}}`
    );
    expect(data[T]).toEqual([{ metric_value_sum: 785 }]);
  });

  it('cnt 保留字段计数:order-count 有 3 行', () => {
    const data = run(`{query{${T} @where(value:"metric_code = 'order-count'"){cnt}}}`);
    expect(data[T]).toEqual([{ cnt: 3 }]);
  });

  it('@function(value:"avg"):target-rate 平均 (82.5+64+47.5)/3 = 64.67', () => {
    const data = run(
      `{query{${T} @where(value:"metric_code = 'target-rate'"){metric_value @function(value:"avg")}}}`
    );
    expect(data[T]).toEqual([{ metric_value: 64.67 }]);
  });
});

describe('方言执行:@order 排序 + @limit/@offset 分页(响应无总条数)', () => {
  const grouped = `${T} @where(value:"metric_code = 'gmv' and mtime = '2026-07-20'"){region @order(type:"desc", priority:1) metric_value_sum}`;

  it('按 region 倒序:华南、华北、华东(字符串序)', () => {
    const data = run(`{query{${grouped}}}`);
    expect((data[T] as Array<{ region: string }>).map((r) => r.region)).toEqual(['华南', '华北', '华东']);
  });

  it('@limit(2)+@offset(1) 取中间两条,且响应不含总条数字段', () => {
    const data = run(`{query @limit(value:2) @offset(value:1){${grouped}}}`);
    const rows = data[T] as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.region)).toEqual(['华北', '华东']);
    expect(Object.keys(data)).toEqual([T]);
  });
});

describe('方言执行:现实怪癖与报错', () => {
  it('单请求超过 5 个表块报错(批量上限)', () => {
    const blocks = Array.from({ length: 6 }, () => `${T}{region}`).join(' ');
    expect(() => run(`{query{${blocks}}}`)).toThrow('上限 5');
  });

  it('@where 白名单外形态(or)报解析失败,不静默', () => {
    expect(() => run(`{query{${T} @where(value:"region = '华东' or region = '华北'"){region}}}`)).toThrow(
      '无法解析'
    );
  });

  it('@connect(DATA_PROCESS)不支持', () => {
    expect(() => run(`{query @connect(value:"a|b"){${T}{region}}}`)).toThrow('@connect');
  });

  it('未知服务与未知字段报错', () => {
    expect(() => run(`{query{NOT_A_TABLE{col}}}`)).toThrow('服务不存在');
    expect(() => run(`{query{${T}{no_such_col}}}`)).toThrow('字段不存在');
  });

  it('@where 引用不存在的列报错(配置错不化为静默空集)', () => {
    expect(() => run(`{query{${T} @where(value:"no_such_col = 'x'"){region}}}`)).toThrow(
      '不存在的列'
    );
  });
});

describe('内省与 MetricBaseInfo', () => {
  it('__type 内省返回列 + 保留聚合字段(带别名,响应以别名为 key)', () => {
    const data = run(`{${T}:__type(name:"${T}"){fields{name}}}`);
    const names = (data[T] as { fields: Array<{ name: string }> }).fields.map((f) => f.name);
    expect(names).toContain('region');
    expect(names).toContain('metric_value_sum');
    expect(names).toContain('cnt');
  });

  it('MetricBaseInfo 按 request 参数形状供数;缺参数报错', () => {
    const data = run(
      `{restQuery{MetricBaseInfo(request:{metric_type:"element", limit:-1, offset:0}){metric_code metric_name_zh scope}}}`
    );
    const list = (data as { restQuery: { MetricBaseInfo: Array<{ metric_code: string }> } }).restQuery
      .MetricBaseInfo;
    expect(list.map((m) => m.metric_code)).toContain('gmv');
    expect(() => run(`{restQuery{MetricBaseInfo(request:{limit:-1, offset:0}){metric_code}}}`)).toThrow(
      'metric_type'
    );
  });
});
