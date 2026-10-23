import { describe, expect, it } from 'vitest';
import fixture from '../../../../pages/capabilities/ai-summary/report-ai-summary-regions.json';
import { parsePage } from '@metriccanvas/page';
import { aiSummaryRelatedData, flattenPageComponents, type AiSummaryComponent, type DataSnapshot, type Page } from '@metriccanvas/page/internal';
import { assembleGenerationInput, type AiSummaryRuntimeContext } from '../src/ai-summary/runtime/input';
import { compilePresentation } from '../../runtime/src/presentation';
import { activeSourceIds, visibleSourceIds } from '../../../data-execution/src/source-program/compiler';

function setup() {
  const result = parsePage(fixture);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  const page = result.page;
  const snapshots = new Map<string, DataSnapshot>(Object.entries(page.dataSources).map(([id, data]) => {
    if (data.source.type !== 'inline') throw Error('Inline fixture required');
    return [id, { status: 'ready', rows: data.source.rows }];
  }));
  const runtime: AiSummaryRuntimeContext = { page, documentKey: 'fixed-document', pageRevision: 'r1',
    filters: new Map(), queries: new Map(), tabs: {} };
  return { page, snapshots, runtime };
}
function summary(page: Page, id: string): AiSummaryComponent {
  const component = flattenPageComponents(page).find(component => component.id === id);
  if (component?.type !== 'aiSummary') throw Error('Summary required');
  return component;
}

describe('frozen region inputs and execution demand', () => {
  it('sends only referenced data fields, omitting displayed text, unused data and other summary bodies', () => {
    const { page, snapshots, runtime } = setup();
    const ai = summary(page, 'section-ai');
    const source = page.dataSources.usage!;
    source.fields.note = { type: 'semanticHtml', role: 'detail' };
    snapshots.set('usage', { status: 'ready', rows: [{ month: '2026-09', tokens: 42, note: 'DETAIL_MUST_STAY_LOCAL' }] });
    const input = assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!;
    expect(input.contextInfo.region).toEqual({ kind: 'section', id: 'full-region', sectionId: 'full-region' });
    expect(input.contextInfo.dataSources.map(source => source.id)).toEqual(['usage']);
    expect(input.contextInfo.dataSources[0]!.result).toMatchObject({ rows: [{ month: '2026-09', tokens: 42 }] });
    const serialized = JSON.stringify(input.contextInfo);
    expect(serialized).not.toContain('区域说明文字');
    expect(serialized).not.toContain('DETAIL_MUST_STAY_LOCAL');
    expect(serialized).not.toContain('comparison');
    expect(serialized).not.toContain('unreferenced');
  });
  it('invalidates cache identity when the owning card changes even with identical data', () => {
    const { page, snapshots, runtime } = setup();
    const ai = summary(page, 'left-card-summary');
    const initial = assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!;
    const owner = page.sections[3]!.components[0]!;
    owner.id = 'renamed-card';
    const changed = assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!;
    expect(changed.contextInfo.dataSources).toEqual(initial.contextInfo.dataSources);
    expect(changed.key).not.toBe(initial.key);
    owner.id = 'left-card';
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!.key).toBe(initial.key);
  });
  it('uses existing visibility projection and active Tab selection without modifying the declared page', () => {
    const { page } = setup();
    const table = page.sections[2]!.components[2]!;
    table.visibleWhen = { permission: 'hidden' };
    const projected = compilePresentation(page).evaluate({ filters: new Map() });
    const rendered = { ...page, sections: projected.sections };
    const sectionAi = summary(rendered, 'section-ai');
    expect(aiSummaryRelatedData(rendered, sectionAi.props, {}, sectionAi.id)).toEqual({});
    expect(page.sections[2]!.components).toHaveLength(3);
    const tabs = page.sections[4]!.components[0]!;
    const ai: AiSummaryComponent = { id: 'outer-ai', type: 'aiSummary', layout: { span: 12 },
      props: { scope: 'container', promptTemplate: 'Summarize active content' } };
    const outer: Page = { ...page, sections: [{ id: 'outer', components: [ai, tabs] }] };
    expect(Object.keys(aiSummaryRelatedData(outer, ai.props, { 'analysis-tabs': 'usage' }, ai.id))).toEqual(['usage']);
    expect(Object.keys(aiSummaryRelatedData(outer, ai.props, { 'analysis-tabs': 'comparison' }, ai.id))).toEqual(['comparison']);
    expect([...activeSourceIds(outer, { 'analysis-tabs': 'usage' })]).toEqual(['usage']);
    expect([...visibleSourceIds(outer)].sort()).toEqual(['comparison', 'usage']);
  });
  it('resolves a card within a Tab to the card, and a direct Tab summary to that tab only', () => {
    const { page, snapshots, runtime } = setup();
    const tabs = page.sections[4]!.components[0]!;
    if (tabs.type !== 'tabContainer') throw Error('Tabs required');
    const firstTab = tabs.props.tabs[0]!;
    if (!('components' in firstTab)) throw Error('Tab children required');
    const nestedCard = page.sections[3]!.components[1]!;
    if (nestedCard.type !== 'compositeCard') throw Error('Card required');
    firstTab.components.push(nestedCard);
    page.sections = [{ id: 'tab-owner', components: [tabs] }];
    const ai = summary(page, 'right-card-summary');
    const input = assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!;
    expect(input.contextInfo.region).toEqual({ kind: 'compositeCard', id: 'right-card', sectionId: 'tab-owner' });
    expect(input.contextInfo.dataSources.map(source => source.id)).toEqual(['comparison']);
    expect(Object.keys(aiSummaryRelatedData(page, summary(page, 'tab-usage-ai').props, {}, 'tab-usage-ai'))).toEqual(['comparison', 'usage']);
  });
  it('waits for scoped loading only, and preserves empty/error results for the adapter', () => {
    const { page, snapshots, runtime } = setup();
    const ai = summary(page, 'left-card-summary');
    snapshots.set('comparison', { status: 'loading' });
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)).toBeDefined();
    snapshots.set('usage', { status: 'loading' });
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)).toBeUndefined();
    snapshots.set('usage', { status: 'empty' });
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!.contextInfo.dataSources[0]!.result.status).toBe('empty');
    snapshots.set('usage', { status: 'error', error: { code: 'DQE_TRANSPORT_ERROR', message: 'failed' } });
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)!.contextInfo.dataSources[0]!.result.status).toBe('error');
  });
  it('does not schedule an empty analysis when its owner disappears from the visibility projection', () => {
    const { page, snapshots, runtime } = setup();
    const ai = summary(page, 'left-card-summary');
    const owner = page.sections[3]!.components[0]!;
    owner.visibleWhen = { permission: 'hidden' };
    runtime.page = { ...page, sections: compilePresentation(page).evaluate({ filters: new Map() }).sections };
    expect(assembleGenerationInput(ai.props, ai.id, snapshots, runtime)).toBeUndefined();
  });
});
