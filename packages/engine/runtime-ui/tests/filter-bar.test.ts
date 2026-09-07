import { describe, expect, it } from 'vitest';
import type { FilterDeclaration } from '@metriccanvas/page';
import { hasVisibleFilters, visibleFilterDeclarations } from '../src/filters/filter-bar';

const dimension = (id: string, visible?: boolean): FilterDeclaration => ({
  id,
  type: 'dimension',
  dimension: id,
  label: id,
  ...(visible === undefined ? {} : { visible })
});

describe('筛选栏可见性', () => {
  it('缺省可见，visible: false 只从控件区消失', () => {
    const declarations = [dimension('region'), dimension('hidden', false), dimension('team', true)];

    expect(visibleFilterDeclarations(declarations).map((d) => d.id)).toEqual([
      'region',
      'team'
    ]);
  });

  it('全部隐藏时整条筛选栏不渲染', () => {
    expect(hasVisibleFilters([dimension('hidden', false)])).toBe(false);
    expect(hasVisibleFilters([])).toBe(false);
    expect(hasVisibleFilters([dimension('region')])).toBe(true);
  });
});
