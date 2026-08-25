import { describe, expect, it } from 'vitest';
import type { FilterDeclaration } from '@metriccanvas/page';
import type { FilterValue } from '@metriccanvas/runtime';
import {
  cascadeConstraints,
  clearDependentUpdates,
  dependentFilterIds
} from '../src/filters/cascade';
import { applySearchFilters } from '../src/filters/inline-search';

const declarations: FilterDeclaration[] = [
  { id: 'industry-l1', type: 'dimension', dimension: 'sub-industry-level1' },
  {
    id: 'industry-l2',
    type: 'dimension',
    dimension: 'sub-industry-level2',
    dependsOn: 'industry-l1'
  }
];

describe('筛选器级联', () => {
  it('下游候选约束取上游当前选中值', () => {
    const values = new Map<string, FilterValue>([
      [
        'industry-l1',
        { type: 'dimension', dimension: 'sub-industry-level1', values: ['运营商'] }
      ]
    ]);
    expect(cascadeConstraints(declarations[1] as Extract<FilterDeclaration, { type: 'dimension' }>, declarations, values)).toEqual({
      'sub-industry-level1': ['运营商']
    });
  });

  it('上游变化时列出并清空下游', () => {
    expect(dependentFilterIds(declarations, 'industry-l1')).toEqual(['industry-l2']);
    expect(clearDependentUpdates(declarations, 'industry-l1')).toEqual([['industry-l2', null]]);
  });
});

describe('inline 搜索', () => {
  it('对字符串字段做不区分大小写包含', () => {
    const rows = applySearchFilters(
      [
        { 'opportunity-name': 'XX 云迁移项目', 'party-company-name': 'YY 政务' },
        { 'opportunity-name': '零售中台', 'party-company-name': 'BB 零售' }
      ],
      new Map([['keyword', { type: 'search', query: '云迁移' }]]),
      {
        'opportunity-name': { type: 'string', role: 'dimension' },
        'party-company-name': { type: 'string', role: 'dimension' }
      }
    );
    expect(rows).toEqual([
      { 'opportunity-name': 'XX 云迁移项目', 'party-company-name': 'YY 政务' }
    ]);
  });
});
