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
    expect(page.schemaVersion).toBe('6.1');
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

  // 层级维度筛选器不绑定：composeEffectiveQuery 只读 filterBindings 里的静态
  // queryField，不跟随当前层级，绑上去在地区部/代表处层会发出错误的查询条件。
  it('明细走受控查询，扁平维度筛选器绑定到 DQE 字段', () => {
    const page = loadPage();
    const source = page.dataSources['opportunity-list'];
    if (source?.source.type !== 'query') throw new Error('明细数据源应为受控查询');
    expect(source.source.query.language).toBe('dqe');
    expect(Object.keys(source.source.query.filterBindings ?? {})).toEqual([
      'industry-type',
      'na-type',
      'industry-l1',
      'industry-l2',
      'overdue',
      'opportunity-stage'
    ]);
    expect(source.source.query.filterBindings?.['industry-l2']).toEqual({
      target: 'dimension',
      queryField: 'sub_industry_level2'
    });
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
