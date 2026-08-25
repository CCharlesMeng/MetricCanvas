import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import { createFilterState, drillThroughSearch, initialFilterValues } from '../src';

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../pages/ioc-opportunity-list.json', import.meta.url)),
    'utf8'
  )
) as Record<string, unknown>;

function loadPage(): Page {
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

describe('ioc-opportunity-list 骨架', () => {
  it('声明看板布局形态，页头与明细表各自成模块，没有报表渐变面板', () => {
    const page = loadPage();
    expect(page.layoutForm).toBe('dashboard');
    expect(page.sections.map((section) => section.container)).toEqual(['plain', 'card']);
    expect(page.sections.map((section) => section.id)).toEqual(['header', 'list']);
  });

  // 规格 002 §2 的结构图里 `list` 分区没有分区标题，页面标题由 §2.1 的
  // `headerOpt.title`（reportHeader）承担；聚合口径属另一个屏，不在本页。
  it('明细分区不带分区标题，只有一个明细数据源', () => {
    const page = loadPage();
    const list = page.sections.find((section) => section.id === 'list');
    expect(list?.title).toBeUndefined();
    expect(Object.keys(page.dataSources)).toEqual(['opportunity-list']);
  });

  it('页面通过解析，筛选状态可往返', () => {
    const page = loadPage();
    expect(page.schemaVersion).toBe('5.1');
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
    restored.fromURL(state.toURL());
    let values: ReturnType<typeof initialFilterValues> = new Map();
    restored.subscribe((next) => {
      values = new Map(next);
    })();
    expect(values.get('keyword')).toEqual({ type: 'search', query: '云迁移' });
    expect(values.get('key-office')).toEqual({ type: 'boolean', value: true });
    expect(values.get('region')).toMatchObject({ level: 'region-dept', values: ['R01'] });
    expect(values.get('mtime')).toMatchObject({ value: '2026-04' });
  });

  it('行点击 navigate 用 setParams 带上详情页参数，不进筛选状态', () => {
    const page = loadPage();
    const table = page.sections
      .flatMap((section) => section.components)
      .find((component) => component.type === 'table');
    if (!table || table.type !== 'table') throw new Error('缺少清单表格');
    const action = table.props.actions?.[0];
    if (!action || !('navigate' in action)) throw new Error('缺少 navigate');

    const row = page.dataSources['opportunity-list']?.source.type === 'inline'
      ? page.dataSources['opportunity-list'].source.rows[0]!
      : {};
    const search = drillThroughSearch(action.navigate, new Map(), row);
    const params = new URLSearchParams(search);
    expect(action.navigate.page).toBe('ioc-project-detail');
    expect(params.get('opportunity-code')).toBe('p:OPP202604001');
    expect(params.get('mtime')).toBe('p:202604');
    expect(params.get('page-title')).toBe(`p:${encodeURIComponent('XX 云迁移项目')}`);
    expect(params.get('ati-status-label')).toBe(`p:${encodeURIComponent('已立项')}`);
    expect(params.get('party-number')).toBe('p:PN10001');
    const filterState = createFilterState();
    filterState.fromURL(search);
    let size = 0;
    filterState.subscribe((values) => {
      size = values.size;
    })();
    expect(size).toBe(0);
  });
});
