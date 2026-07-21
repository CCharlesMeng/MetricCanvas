import { describe, expect, it } from 'vitest';
import { drillThroughSearch } from '../src/navigate';
import { createFilterState, type FilterValue, type FilterValues } from '../src/filter-state';

const current: FilterValues = new Map<string, FilterValue>([
  ['f-time', { type: 'timeRange', from: '2026-06-01', to: '2026-06-30' }],
  ['f-region', { type: 'dimension', dimension: 'region', values: ['华东'] }]
]);

/** 借 store 的 fromURL 还原查询串,断言"目标页按生命周期④能恢复出什么" */
function restore(search: string): FilterValues {
  const probe = createFilterState();
  probe.fromURL(search);
  let values: FilterValues = new Map();
  probe.subscribe((v) => {
    values = v;
  })();
  return values;
}

describe('drillThroughSearch:筛选值 + 点击上下文 → 目标页 URL 查询串', () => {
  it('carryFilters 携带当前筛选状态值,setFilters 用点击上下文写入,目标页可完整还原', () => {
    const search = drillThroughSearch(
      {
        page: 'sales-detail',
        carryFilters: ['f-time', 'f-region'],
        setFilters: { 'f-channel': 'channel' }
      },
      current,
      { channel: '线上', gmv: 1200 }
    );
    const restored = restore(search);
    expect(restored.get('f-time')).toEqual({ type: 'timeRange', from: '2026-06-01', to: '2026-06-30' });
    expect(restored.get('f-region')).toEqual({ type: 'dimension', dimension: 'region', values: ['华东'] });
    expect(restored.get('f-channel')).toEqual({ type: 'dimension', dimension: 'channel', values: ['线上'] });
    expect(restored.size).toBe(3);
  });

  it('carryFilters 中当前无值的筛选器不占位(缺席即不筛选)', () => {
    const search = drillThroughSearch(
      { page: 'sales-detail', carryFilters: ['f-time', 'f-unset'] },
      current,
      {}
    );
    const restored = restore(search);
    expect(restored.size).toBe(1);
    expect(restored.has('f-unset')).toBe(false);
  });

  it('点击行缺少占位维度的值时,该 setFilters 项跳过、其余照常', () => {
    const search = drillThroughSearch(
      { page: 'sales-detail', setFilters: { 'f-channel': 'channel' }, carryFilters: ['f-time'] },
      current,
      { region: '华东' }
    );
    const restored = restore(search);
    expect(restored.has('f-channel')).toBe(false);
    expect(restored.has('f-time')).toBe(true);
  });

  it('setFilters 与 carryFilters 指向同一筛选器时,点击上下文优先', () => {
    const search = drillThroughSearch(
      { page: 'sales-detail', carryFilters: ['f-region'], setFilters: { 'f-region': 'region' } },
      current,
      { region: '华南' }
    );
    expect(restore(search).get('f-region')).toEqual({
      type: 'dimension',
      dimension: 'region',
      values: ['华南']
    });
  });

  it('数值型点击值转为字符串写入(URL 载体只有字符串)', () => {
    const search = drillThroughSearch(
      { page: 'sales-detail', setFilters: { 'f-year': 'year' } },
      new Map(),
      { year: 2026 }
    );
    expect(restore(search).get('f-year')).toEqual({
      type: 'dimension',
      dimension: 'year',
      values: ['2026']
    });
  });

  it('无可携带内容时返回空字符串(目标页回落到自身 default)', () => {
    expect(drillThroughSearch({ page: 'sales-detail' }, new Map(), {})).toBe('');
  });
});
