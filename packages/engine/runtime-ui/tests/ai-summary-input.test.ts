import { describe, expect, it } from 'vitest';
import fixture from '../../../../pages/capabilities/ai-summary/report-ai-summary.json';
import { parsePage, type Page } from '@metriccanvas/page';
import { aiSummaryRelatedData, type AiSummaryProps, type DataSnapshot } from '@metriccanvas/page/internal';
import { assembleGenerationInput } from '../src/ai-summary/runtime/input';
import type { FilterValue } from '../../runtime/src';
import type { AiSummaryRuntimeContext } from '../src/ai-summary/runtime/input';
import { activeSourceIds } from '../../../data-execution/src/source-program/compiler';

function setup() {
  const parsed = parsePage(fixture);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page;
  const component = page.sections[2]!.components[1]!;
  if (component.type !== 'aiSummary') throw Error('fixture');
  const filters = new Map<string, FilterValue>([['month', { type: 'timeRange', from: '2026-09', to: '2026-09' }]]);
  const context: AiSummaryRuntimeContext = { page, pageRevision: 'r1', documentKey: 'declared-document',
    filters,
    queries: new Map(), tabs: {} };
  const snapshots = new Map<string, DataSnapshot>([['usage', { status: 'ready', rows: [{ month: '2026-09', tokens: 42 }] }]]);
  return { page, props: component.props, context, snapshots, filters };
}

describe('summary input scopes and identity', () => {
  it('normalizes the legacy spelling into the same scope, frozen context and cache input', () => {
    const { props, context, snapshots } = setup();
    const current = assembleGenerationInput({ ...props, relatedDataSources: ['usage'] }, 'summary', snapshots, context)!;
    const legacy = assembleGenerationInput({ ...props, relatedDataSource: ['usage'] }, 'summary', snapshots, context)!;
    expect(legacy.contextInfo).toEqual(current.contextInfo);
    expect(legacy.key).toBe(current.key);
    expect(current.contextInfo.sectionIds).toEqual([]);
  });
  it('uses direct source IDs ahead of sections and derives non-detail fields and labels', () => {
    const { page, props, context, snapshots } = setup();
    page.dataSources.comparison!.fields = { month: { type: 'string', role: 'dimension', queryField: 'month', label: '月份' },
      tokens: { type: 'number', role: 'measure', queryField: 'tokens', label: '消耗量', unit: '个' },
      detail: { type: 'recordList', role: 'detail', queryField: 'detail', items: { fields: { value: { type: 'string', role: 'dimension', queryField: 'value' } } } } };
    snapshots.set('comparison', { status: 'ready', rows: [{ month: '2026-09', tokens: 7, detail: [{ value: 'excluded' }] }] });
    const direct = { ...props, relatedDataSources: ['comparison'] };
    const before = structuredClone({ direct, snapshots });
    const input = assembleGenerationInput(direct, 'summary', snapshots, context)!;
    expect(input.contextInfo.sectionIds).toEqual([]);
    expect(input.contextInfo.dataSources).toMatchObject([{ id: 'comparison',
      fields: { month: { label: '月份' }, tokens: { label: '消耗量', unit: '个' } },
      result: { rows: [{ month: '2026-09', tokens: 7 }] } }]);
    expect(input.contextInfo.dataSources[0]!.fields).not.toHaveProperty('detail');
    expect(JSON.stringify(input.contextInfo)).not.toContain('excluded');
    expect({ direct, snapshots }).toEqual(before);
  });

  it('normalizes multiple source IDs for caching and executes sources without visible data slots', () => {
    const { page, props, context, snapshots } = setup();
    snapshots.set('comparison', { status: 'empty', totalCount: 0 });
    const direct = { ...props, relatedDataSources: ['usage', 'comparison'] };
    const input = assembleGenerationInput(direct, 'summary', snapshots, context)!;
    expect(input.contextInfo.dataSources.map(source => source.id)).toEqual(['comparison', 'usage']);
    expect(assembleGenerationInput({ ...direct, relatedDataSources: ['comparison', 'usage'] }, 'summary', snapshots, context)!.key).toBe(input.key);
    const summary = page.sections[2]!.components[1]!;
    if (summary.type !== 'aiSummary') throw Error('fixture summary');
    summary.props = direct;
    const summaryOnly: Page = { ...page, sections: [{ id: 'summary-only', components: [summary] }] };
    expect([...activeSourceIds(summaryOnly)].sort()).toEqual(['comparison', 'usage']);
    snapshots.delete('comparison');
    expect(assembleGenerationInput(direct, 'summary', snapshots, context)).toBeUndefined();
  });

  it('collects only the selected section, deduplicates and honors explicit field scope', () => {
    const { page, props, context, snapshots } = setup();
    expect(Object.keys(aiSummaryRelatedData(page, props))).toEqual(['usage']);
    const explicit: AiSummaryProps = { ...props, relatedData: { only: { source: 'usage',
      description: '用量', fields: [{ field: 'tokens', term: 'Tokens' }] } } };
    const result = assembleGenerationInput(explicit, 'summary', snapshots, context)!;
    expect(result.contextInfo.dataSources).toHaveLength(1);
    expect(result.contextInfo.dataSources[0]!.result).toMatchObject({ rows: [{ tokens: 42 }] });
    expect(JSON.stringify(result.contextInfo)).not.toContain('comparison');
  });

  it('includes time conditions even when data is unchanged, but not unrelated filters', () => {
    const { props, context, snapshots, filters } = setup();
    const first = assembleGenerationInput(props, 'summary', snapshots, context)!;
    filters.set('unused', { type: 'dimension', dimension: 'unused', values: ['hidden'] });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)!.key).toBe(first.key);
    filters.set('month', { type: 'timeRange', from: '2026-10', to: '2026-10' });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)!.key).not.toBe(first.key);
    filters.set('month', { type: 'timeRange', from: '2026-09', to: '2026-09' });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)!.key).toBe(first.key);
  });

  it('passes empty and failed results to the analysis implementation, waiting only for loading', () => {
    const { props, context, snapshots } = setup();
    snapshots.set('usage', { status: 'loading' });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)).toBeUndefined();
    snapshots.set('usage', { status: 'empty', totalCount: 0 });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)!.contextInfo.dataSources[0]!.result.status).toBe('empty');
    snapshots.set('usage', { status: 'error', error: { code: 'DQE_FIELD_MAPPING_ERROR', message: '字段未映射' } });
    expect(assembleGenerationInput(props, 'summary', snapshots, context)!.contextInfo.dataSources[0]!.result.status).toBe('error');
  });

  it('takes only the active nested Tab from an already visibility-projected section', () => {
    const { page, props } = setup();
    const [usage, comparison] = [page.sections[2]!.components[0]!, page.sections[3]!.components[0]!];
    if (usage.type !== 'table' || comparison.type !== 'table') throw Error('fixture tables');
    const projected: Page = { ...page, sections: [{ id: 'usage-region', components: [{ id: 'tabs', type: 'tabContainer',
      layout: { span: 12 }, props: { tabs: [{ id: 'usage', label: '用量', component: usage },
        { id: 'comparison', label: '对照', component: comparison }] } }] }] };
    expect(Object.keys(aiSummaryRelatedData(projected, props, { tabs: 'usage' }))).toEqual(['usage']);
    expect(Object.keys(aiSummaryRelatedData(projected, props, { tabs: 'comparison' }))).toEqual(['comparison']);
    expect(aiSummaryRelatedData({ ...projected, sections: [] }, props)).toEqual({});
  });
});
