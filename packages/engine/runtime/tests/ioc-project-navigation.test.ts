import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import { flattenPageComponents, type Row } from '@metriccanvas/page/internal';
import { initialFilterValues, initializePageParams, navigationHref, resolvePageParams, type FilterValues } from '../src';

function load(name: string): Page {
  const document: unknown = JSON.parse(readFileSync(new URL(`../../../../pages/${name}.json`, import.meta.url), 'utf8'));
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

function component(page: Page, id: string) {
  const result = flattenPageComponents(page).find(value => value.id === id);
  if (!result) throw new Error(`缺少组件 ${id}`);
  return result;
}

function detailURL(page: Page, id: string, filters: FilterValues, row: Row) {
  const table = component(page, id);
  if (table.type !== 'table') throw new Error('不是表格');
  const action = table.props.actions?.find(candidate => 'navigate' in candidate);
  if (!action || !('navigate' in action)) throw new Error(`缺少详情导航 ${id}`);
  return new URL(navigationHref(action.navigate, filters, new Map(), row), 'https://example.test');
}

const row: Row = {
  'page-title': '不应采用的通用标题', 'project-initiation-name': '匿名立项项目',
  'opportunity-name': '匿名丢单机会点', 'opportunity-code': 'OPP-ONE', mtime: '202603',
  'ati-status-label': '无需立项', 'party-number': 'CUSTOMER-ONE',
  'project-initiation-level': 'L3', 'public-cloud-na-level-name': '普通客户',
  'sub-industry-level1-name': '互联网'
};

// Source report project-overview D7/D8/E3/E4 and opportunity-list E.
// Deliberately different page/row periods; no production query assertions.
describe('IOC 项目导航：按真实消费者区分日期与目标', () => {
  it.each(['initiated-table', 'lost-table'])('%s 使用当前页面月份，目标参数可解析', id => {
    const page = load('ioc-project-overview');
    const instance = initializePageParams(page, resolvePageParams('', page.params ?? []).values);
    const filters = initialFilterValues(instance.filters ?? []);
    filters.set('mtime', { type: 'timePoint', granularity: 'month', value: '2026-04' });
    const target = detailURL(page, id, filters, row);
    expect(target.pathname).toBe('/pages/ioc-project-detail');
    expect(target.searchParams.get('mtime')).toBe('2026-04');
    expect(target.searchParams.get('opportunity-code')).toBe('OPP-ONE');
    expect(target.searchParams.get('party-number')).toBe('CUSTOMER-ONE');
    expect(target.searchParams.get('page-title')).toBe(id === 'initiated-table' ? '匿名立项项目' : '匿名丢单机会点');
    expect(target.searchParams.get('ati-status-label')).toBe(id === 'initiated-table' ? '已立项' : '无需立项');
    const destination = load('ioc-project-detail');
    const resolved = resolvePageParams(target.search, destination.params ?? []);
    expect(resolved.missing).toEqual([]);
    expect(resolved.values.get('mtime')).toBe('2026-04');
    expect(resolved.values.get('opportunity-code')).toBe('OPP-ONE');

    // Selection after opening must use the new filter, not the saved report-month.
    filters.set('mtime', { type: 'timePoint', granularity: 'month', value: '2026-05' });
    expect(detailURL(page, id, filters, row).searchParams.get('mtime')).toBe('2026-05');
  });

  it('清单到详情仍使用行月份，页面月份不同也不覆盖', () => {
    const filters: FilterValues = new Map([['mtime', { type: 'timePoint', granularity: 'month', value: '2026-04' }]]);
    const target = detailURL(load('ioc-opportunity-list'), 'opportunity-table', filters, row);
    expect(target.searchParams.get('mtime')).toBe('202603');
    expect(target.searchParams.get('opportunity-code')).toBe('OPP-ONE');
  });

  it('已立项数量和预签金额分别绑定对应口径，不能显示全部机会点金额', () => {
    const card = component(load('ioc-project-overview'), 'initiation-summary');
    if (card.type !== 'metricCard') throw new Error('不是指标卡');
    expect(card.props.rows[0]).toMatchObject({
      label: '已立项', unit: '个',
      valueField: { field: 'initiated-cnt', format: 'number-grouped' },
      changes: [{ label: '预签金额', field: { field: 'initiated-amount', format: 'cny-adaptive' } }]
    });
  });
});
