import { describe, expect, it } from 'vitest';
import type { FilterDeclaration } from '@metriccanvas/page';
import { dashboardFilterGroups } from '../src/dashboard/filter-groups';

const dimension = (id: string, visible?: boolean): FilterDeclaration => ({
  id,
  type: 'dimension',
  dimension: id,
  label: id,
  ...(visible === undefined ? {} : { visible })
});

const search = (id: string): FilterDeclaration => ({ id, type: 'search', label: id });

const ids = (declarations: readonly FilterDeclaration[]) =>
  declarations.map((declaration) => declaration.id);

describe('dashboard 工具栏筛选分组', () => {
  it('标准工具栏不超过五项时全部常驻', () => {
    const declarations = Array.from({ length: 5 }, (_, index) =>
      dimension(`filter-${index + 1}`)
    );

    const groups = dashboardFilterGroups(declarations);

    expect(ids(groups.primary)).toEqual(ids(declarations));
    expect(groups.overflow).toEqual([]);
    expect(groups.content).toEqual([]);
  });

  it('密集标准工具栏保留前四项、收纳其余条件，并把搜索放回内容区', () => {
    const declarations = [
      ...Array.from({ length: 10 }, (_, index) => dimension(`filter-${index + 1}`)),
      search('keyword')
    ];

    const groups = dashboardFilterGroups(declarations);

    expect(ids(groups.primary)).toEqual([
      'filter-1',
      'filter-2',
      'filter-3',
      'filter-4'
    ]);
    expect(ids(groups.overflow)).toEqual([
      'filter-5',
      'filter-6',
      'filter-7',
      'filter-8',
      'filter-9',
      'filter-10'
    ]);
    expect(ids(groups.content)).toEqual(['keyword']);
  });

  it('隐藏项不进入控件组，compact 工具栏不执行收纳', () => {
    const declarations = [
      dimension('one'),
      dimension('hidden', false),
      ...Array.from({ length: 6 }, (_, index) => dimension(`visible-${index + 2}`))
    ];

    const standard = dashboardFilterGroups(declarations);
    const compact = dashboardFilterGroups(declarations, 'compact');

    expect(ids(standard.primary)).toEqual(['one', 'visible-2', 'visible-3', 'visible-4']);
    expect(ids(standard.overflow)).toEqual(['visible-5', 'visible-6', 'visible-7']);
    expect(standard.content).toEqual([]);
    expect(ids(compact.primary)).toEqual([
      'one',
      'visible-2',
      'visible-3',
      'visible-4',
      'visible-5',
      'visible-6',
      'visible-7'
    ]);
    expect(compact.overflow).toEqual([]);
    expect(compact.content).toEqual([]);
  });
});
