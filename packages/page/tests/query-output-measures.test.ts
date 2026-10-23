import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePageDocument } from '../src';
import { parsePage, validate } from '../src/validate';
import { requiredMinorVersion,versionPolicy } from '../src/version';

function document() {
  return JSON.parse(readFileSync('packages/page/fixtures/contract-valid/stored-count-measures.json', 'utf8'));
}

describe('DQE 直接返回的数值显式作为度量', () => {
  it('保留查询、原始行粒度和数值维度，不自动聚合或提升字段角色', () => {
    const input = document();
    const before = structuredClone(input);
    const result = parsePage(input);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const source = result.page.dataSources.counts;
    expect(source.source).toMatchObject({ query: before.dataSources.counts.source.query });
    expect(source.fields.regionId.role).toBe('dimension');
    expect(source.fields.projects.role).toBe('measure');
    expect(source.source).toMatchObject({ initial: { rows: [
      { region: '东区', regionId: 101, projects: 12, completed: 9 },
      { region: '南区', regionId: 102, projects: 7, completed: 5 },
      { region: '零值区', regionId: 103, projects: 0, completed: 0 },
      { region: '缺失区', regionId: 104, projects: null, completed: 3 }
    ] } });
    expect(input).toEqual(before);
    const normalized = normalizePageDocument(input);
    if (!normalized.ok) throw new Error(JSON.stringify(normalized.errors));
    expect(normalized.document).toEqual({...input,schemaVersion:versionPolicy.current});
  });

  it('分组写法支持现成金额；缺失与数值字符串沿用查询度量归一化', () => {
    const input = document();
    const { region, regionId, projects, completed } = input.dataSources.counts.fields;
    delete region.role; delete regionId.role; delete projects.role; delete completed.role;
    projects.type = 'money'; projects.currency = 'CNY'; projects.unit = '元';
    input.dataSources.counts.fields = { dimensions: { region, regionId }, measures: { projects, completed } };
    input.dataSources.counts.source.initial.rows[0]['存量项目数量'] = '12';
    input.dataSources.counts.source.initial.rows[1]['存量项目数量'] = '--';
    expect(requiredMinorVersion(input)).toBe(56);
    const result = parsePage(input);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.page.dataSources.counts.source).toMatchObject({ initial: { rows: [
      { projects: 12 }, { projects: null }, { projects: 0 }, { projects: null }
    ] } });
  });

  it.each(['6.55', '5.4'])('旧版本 %s 不得借读取兼容通道使用新映射', schemaVersion => {
    const input = document(); input.schemaVersion = schemaVersion;
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: expect.stringContaining('由 6.56 引入') }));
  });

  it('时间粒度返回列的映射也必须遵守新能力版本下限', () => {
    const input = document();
    delete input.dataSources.counts.source.initial;
    input.dataSources.counts.fields.projects.queryField = '存量项目数量(month)';
    const item = input.dataSources.counts.source.query.body.dsl_list[0];
    item.output_dims = item.output_dims.filter((name: string) => name !== '存量已完成数量');
    item.output_metrics = ['存量已完成数量'];
    item.filter.time = { period: 'month', start: '2026-10', end: '2026-10' };
    expect(validate(input)).toEqual([]);
    input.schemaVersion = '6.55';
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: expect.stringContaining('由 6.56 引入') }));
  });

  it.each(['string', 'boolean', 'date', 'datetime'])('output_dims 的 %s 字段不得声明为度量', type => {
    const input = document(); delete input.dataSources.counts.source.initial;
    input.dataSources.counts.fields.projects.type = type;
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: 'DQE 维度 存量项目数量 的 role 必须为 dimension' }));
  });

  it('数值维度仍不能绑定系列，output_metrics 仍必须为度量', () => {
    const input = document();
    input.sections[0].components[0].props.series[0].field = 'regionId';
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: '字段 regionId 的 role 为 dimension，此处要求 measure' }));
    const query = input.dataSources.counts.source.query.body.dsl_list[0];
    query.output_dims = query.output_dims.filter((name: string) => name !== '存量区域编号');
    query.output_metrics = ['存量区域编号'];
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: 'DQE 度量 存量区域编号 的 role 必须为 measure' }));
  });

  it.each(['query-modes-page', 'time-modes-page'])('所有静态分支参与能力探测：%s', id => {
    const input = JSON.parse(readFileSync(`packages/page/fixtures/contract-valid/${id}.json`, 'utf8'));
    input.schemaVersion = versionPolicy.current;
    for (const source of Object.values(input.dataSources) as any[]) {
      const query = source.source.query;
      const selection = query.queryModes ?? query.timeModes;
      if (!selection) continue;
      for (const leaf of Object.values(selection.cases) as any[]) {
        const item = leaf.body.dsl_list[0];
        item.output_dims.push(...item.output_metrics.map((metric: any) => typeof metric === 'string' ? metric : metric.alias));
        item.output_metrics = [];
      }
    }
    expect(validate(input)).toEqual([]);
    expect(requiredMinorVersion(input)).toBe(id==='query-modes-page'?57:56);
    input.schemaVersion = '6.55';
    expect(validate(input)).toContainEqual(expect.objectContaining({ message: expect.stringContaining('由 6.56 引入') }));
  });
});
