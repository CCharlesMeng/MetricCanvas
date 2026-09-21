import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import { createFilterState, navigationHref, initialFilterValues } from '../src';

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../pages/ioc-opportunity-list.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

function loadPage(): Page {
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

describe('ioc-opportunity-list 骨架', () => {
  it('声明标准看板工具栏标题，内容区只保留明细卡片', () => {
    const page = loadPage();
    expect(page.layout).toBe('dashboard');
    expect(page.meta?.title).toBe('机会点清单');
    expect(page.sections.map((section) => section.container)).toEqual(['card']);
    expect(page.sections.map((section) => section.id)).toEqual(['list']);
    expect(
      page.sections
        .flatMap((section) => section.components)
        .some((component) => component.type === 'reportHeader')
    ).toBe(false);
  });

  // 规格 002 §2 的结构图里 `list` 分区没有分区标题；dashboard 页面标题由
  // 标准工具栏读取 meta.title，聚合口径属另一个屏，不在本页。
  it('明细分区不带分区标题，只有一个明细数据源', () => {
    const page = loadPage();
    const list = page.sections.find((section) => section.id === 'list');
    expect(list?.title).toBeUndefined();
    expect(Object.keys(page.dataSources)).toEqual(['opportunity-list']);
  });

  it('页面通过解析，筛选状态可往返', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe('6.9');
    expect(page.filters).toHaveLength(11);
    const table = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'table');
    if (!table || table.type !== 'table') throw new Error('缺少清单表格');
    expect(table.props.columns).toHaveLength(40);
    expect(table.props.pagination).toEqual({ mode: 'none' });
    const initial = initialFilterValues(page.filters ?? []);
    expect(initial.get('mtime')).toEqual({
      type: 'timePoint',
      granularity: 'month',
      value: '2026-04'
    });

    const state = createFilterState(initial);
    state.write('keyword', { type: 'search', query: '云迁移' });
    state.write('key-office', { type: 'boolean', value: true });
    state.write('region', {
      type: 'dimension',
      dimension: 'region-dept-code',
      values: ['R01'],
      level: 'region-dept'
    });
    const restored = createFilterState();
    restored.fromURL(state.toURL(page.filters), page.filters ?? []);
    let values: ReturnType<typeof initialFilterValues> = new Map();
    restored.subscribe((next) => {
      values = new Map(next);
    })();
    expect(values.get('keyword')).toEqual({ type: 'search', query: '云迁移' });
    expect(values.get('key-office')).toEqual({ type: 'boolean', value: true });
    expect(values.get('region')).toMatchObject({ level: 'region-dept', values: ['R01'] });
    expect(values.get('mtime')).toMatchObject({ value: '2026-04' });
  });

  // 十一个筛选器里十个下推到查询；只剩 search 没有绑定目标，仍走客户端。
  it('明细走受控查询，各类筛选器按各自的谓词形状绑定', () => {
    const page = loadPage();
    const source = page.dataSources['opportunity-list'];
    if (source?.source.type !== 'query') throw new Error('明细数据源应为受控查询');
    expect(source.source.query.language).toBe('dqe');
    const bindings = source.source.query.filterBindings ?? {};
    expect(Object.keys(bindings)).toEqual([
      'mtime',
      'key-office',
      'industry-type',
      'region',
      'na-type',
      'industry-l1',
      'industry-l2',
      'overdue',
      'opportunity-stage',
      'bidding-amount'
    ]);
    expect((page.filters ?? []).filter((f) => !(f.id in bindings)).map((f) => f.id)).toEqual([
      'keyword'
    ]);
    expect(bindings['industry-l2']).toEqual({
      target: 'dimension',
      queryField: 'sub_industry_level2'
    });
    // 数据列写的是 202604，筛选状态写的是 2026-04：格式必须显式声明。
    expect(bindings.mtime).toEqual({
      target: 'timePoint',
      queryField: 'mtime',
      valueFormat: 'compact'
    });
    // 勾选才加条件，没有 whenFalse 就是不勾等于无条件。
    expect(bindings['key-office']).toEqual({
      target: 'boolean',
      queryField: 'is_key_office',
      whenTrue: ['true']
    });
    expect(bindings['bidding-amount']).toEqual({
      target: 'numberRange',
      metric: 'bidding_amount'
    });
  });

  // 层级区域筛选器逐级声明谓词字段(ADR-0084)：三层各自一个 DQE 字段，
  // 与 hierarchy 的层级 id 一一对应；少一级会被页面校验拒绝。
  it('层级区域筛选器逐级绑定，覆盖 hierarchy 声明的全部层级', () => {
    const page = loadPage();
    const source = page.dataSources['opportunity-list'];
    if (source?.source.type !== 'query') throw new Error('明细数据源应为受控查询');
    const binding = source.source.query.filterBindings?.region;
    expect(binding).toEqual({
      target: 'dimension',
      levelQueryFields: {
        geo: 'geo_pc_code',
        'region-dept': 'region_dept_code',
        office: 'rep_office_code'
      }
    });
    const region = page.filters?.find((filter) => filter.id === 'region');
    if (region?.type !== 'dimension') throw new Error('region 应为维度筛选器');
    expect(Object.keys(binding && 'levelQueryFields' in binding ? binding.levelQueryFields : {}))
      .toEqual(region.hierarchy?.map((level) => level.id));
  });

  it('行点击 navigate 用 query 带上详情页参数，不进筛选状态', () => {
    const page = loadPage();
    const table = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'table');
    if (!table || table.type !== 'table') throw new Error('缺少清单表格');
    const action = table.props.actions?.[0];
    if (!action || !('navigate' in action)) throw new Error('缺少 navigate');

    const source = page.dataSources['opportunity-list'];
    const row = source?.source.type === 'query' ? (source.source.initial?.rows[0] ?? {}) : {};
    const search = new URL(navigationHref(action.navigate, new Map(), new Map(), row), 'https://host.example').search;
    const params = new URLSearchParams(search);
    expect(action.navigate.href).toBe('/pages/ioc-project-detail');
    expect(params.get('opportunity-code')).toBe('OPP202604001');
    expect(params.get('mtime')).toBe('202604');
    expect(params.get('page-title')).toBe('XX 云迁移项目');
    expect(params.get('ati-status-label')).toBe('已立项');
    expect(params.get('party-number')).toBe('PN10001');
    const filterState = createFilterState();
    filterState.fromURL(search, []);
    let size = 0;
    filterState.subscribe((values) => {
      size = values.size;
    })();
    expect(size).toBe(0);
  });
});
