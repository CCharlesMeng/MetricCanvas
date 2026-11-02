import { describe, expect, it } from 'vitest';
import document from '../../../../pages/capabilities/filters/ioc-region-url-demo.json';
import { parsePage } from '@metriccanvas/page';
import { filterURLKeys } from '@metriccanvas/page/internal';
import { createFilterState, initialFilterValues, parseFilterSearch, filterSearch, type FilterValue } from '../src/filter-state';
import { filterInputIssue, navigationInputIssue, projectNavigationInputs } from '../src/navigation-inputs';
import { resolveNavigationTarget } from '../src/navigate';
import { createSharedFilterBridge } from '../../../embed/examples/shared-filter-bridge';

const parsed = parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const filters = parsed.page.filters!;
const contract = projectNavigationInputs(document);

describe('Region URL 参数名表示层级', () => {
  it.each([
    ['region-dept=中国地区部', 'region-dept', 'demo_region', '中国地区部'],
    ['rep-office=上海代表处', 'office', 'demo_office', '上海代表处'],
    ['region-dept=中国地区部&rep-office=上海代表处', 'office', 'demo_office', '上海代表处'],
    ['rep-office=上海代表处&region-dept=欧洲地区部', 'region-dept', 'demo_region', '欧洲地区部'],
    ['rep-office=北京代表处&rep-office=上海代表处', 'office', 'demo_office', '上海代表处'],
    ['region=中国地区部&region.level=region-dept&rep-office=上海代表处', 'office', 'demo_office', '上海代表处'],
    ['rep-office=上海代表处&region=欧洲地区部&region.level=unknown', 'office', 'demo_office', '上海代表处'],
    ['region=上海代表处&region.level=office', 'office', 'demo_office', '上海代表处']
  ])('解析 %s', (search, level, dimension, value) => {
    expect(parseFilterSearch(search, filters, undefined, contract.iocRegion).get('region')).toEqual({ type: 'dimension', level, dimension, values: [value] });
    expect(filterInputIssue(search, filters, undefined, contract.iocRegion)).toBeUndefined();
    expect(navigationInputIssue(`/pages/ioc-region-url-demo?${search}`, contract)).toBeUndefined();
  });

  it('候选稳定值含中文、连接符及 URL 特殊字符，原样往返', () => {
    const value: FilterValue = { type: 'dimension', level: 'office', dimension: 'demo_office', values: ['上海-代表处&甲+乙/%'] };
    const state = createFilterState(new Map([['region', value]]), filters, new Map(), {iocRegion:contract.iocRegion});
    const search = state.toURL();
    expect([...new URLSearchParams(search)]).toEqual([['rep-office', '上海-代表处&甲+乙/%']]);
    expect(parseFilterSearch(search, filters, undefined, contract.iocRegion).get('region')).toEqual(value);
  });

  it('fromURL 使用同一最后值规则，回写只保留选中层级', () => {
    const state = createFilterState(initialFilterValues(filters), filters, new Map(), {iocRegion:contract.iocRegion});
    state.fromURL('region=A&region=B&rep-office=上海代表处', filters);
    expect([...new URLSearchParams(state.toURL())]).toEqual([['rep-office', '上海代表处']]);
    state.fromURL('rep-office=上海代表处&region-dept=欧洲地区部', filters);
    expect([...new URLSearchParams(state.toURL())]).toEqual([['region-dept', '欧洲地区部']]);
  });

  it('可选树清空后保留空选层级，刷新不重新套用默认节点', () => {
    const state = createFilterState(initialFilterValues(filters), filters, new Map(), {iocRegion:contract.iocRegion});
    state.write('region', { type: 'dimension', level: 'office', dimension: 'demo_office', values: [] });
    expect([...new URLSearchParams(state.toURL())]).toEqual([['region.level', 'office']]);
    expect(parseFilterSearch(state.toURL(), filters, undefined, contract.iocRegion).get('region')).toEqual({ type: 'dimension', level: 'office', dimension: 'demo_office', values: [] });
    expect(filterInputIssue(state.toURL(), filters, undefined, contract.iocRegion)).toBeUndefined();
  });

  it('空的最后值不得恢复先前候选，严格模式明确拒绝', () => {
    expect(parseFilterSearch('region-dept=中国地区部&rep-office=', filters, undefined, contract.iocRegion).has('region')).toBe(false);
    expect(filterInputIssue('region-dept=中国地区部&rep-office=', filters, undefined, contract.iocRegion)).toBe('目标筛选输入为空：region');
    expect(filterInputIssue('rep-office=&region-dept=中国地区部', filters, undefined, contract.iocRegion)).toBeUndefined();
  });

  it('未提供参数保留页面默认值；新 URL 不绕过候选门禁', () => {
    const state = createFilterState(initialFilterValues(filters), filters, new Map(), { iocRegion:contract.iocRegion, candidates: true });
    expect(new URLSearchParams(state.toURL()).get('region-dept')).toBe('中国地区部');
    state.fromURL('rep-office=无权限代表处', filters);
    expect(state.blocked().has('region')).toBe(true);
    state.candidate('region', 'ready', ['上海代表处', '北京代表处']);
    expect(state.blocked().has('region')).toBe(true);
  });

  it('非 IOC 页面不读取组织专用键，不改变既有多值 URL', () => {
    const ordinary = [{ id: 'region', type: 'dimension' as const, dimension: 'region' }];
    expect(parseFilterSearch('region-dept=中国地区部&rep-office=上海代表处', ordinary).size).toBe(0);
    const values = parseFilterSearch('region=甲&region=乙', ordinary);
    expect(new URLSearchParams(filterSearch(values, ordinary)).getAll('region')).toEqual(['甲', '乙']);
    expect(Object.values(filterURLKeys(filters[0]!,contract.iocRegion))).toEqual(['region', 'region.level', 'region-dept', 'rep-office']);
  });

  it('旧 IOC 地区部层级 ID department 无需页面映射也按标准参数读取', () => {
    const old = structuredClone(filters);
    const region = old[0]!;
    if (region.type !== 'dimension') throw Error('region');
    region.hierarchy![0]!.id = 'department';
    region.defaultLevel = 'department';
    expect(parseFilterSearch('region-dept=中国地区部', old, undefined, true).get('region')).toMatchObject({ level: 'department', values: ['中国地区部'] });
    expect(parseFilterSearch('region-dept=中国地区部&rep-office=上海代表处', old).size).toBe(0);
  });

  it('导航校验使用参数名推导层级，拒绝把代表处值送进地区部参数', () => {
    const values = parseFilterSearch('rep-office=上海代表处', filters, undefined, contract.iocRegion);
    const target = { href: '/pages/ioc-region-url-demo', validateTargetInputs: true as const, query: { 'rep-office': { source: 'filter' as const, id: 'region' } } };
    expect(resolveNavigationTarget(target, values, new Map(), {}, contract).ok).toBe(true);
    const bad = { ...target, query: { 'region-dept': { source: 'filter' as const, id: 'region' } } };
    expect(resolveNavigationTarget(bad, values, new Map(), {}, contract)).toMatchObject({ ok: false, code: 'NAVIGATION_INPUT_INVALID' });
  });

  it('宿主共享状态保留最后节点，显式新参数优先于共享状态', () => {
    const bridge = createSharedFilterBridge(), bindings = { region: 'region' };
    bridge.recordSearch(contract, 'rep-office=上海代表处&region-dept=欧洲地区部', bindings);
    const inherited = bridge.initialSearch(contract, '', bindings);
    expect(parseFilterSearch(inherited, filters, undefined, contract.iocRegion).get('region')).toMatchObject({ level: 'region-dept', values: ['欧洲地区部'] });
    const explicit = bridge.initialSearch(contract, 'rep-office=北京代表处', bindings);
    expect([...new URLSearchParams(explicit)]).toEqual([['rep-office', '北京代表处']]);
  });
});
