import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/capabilities/ai-summary/report-ai-summary-regions.json';
import legacy from '../../../pages/capabilities/ai-summary/report-ai-summary.json';
import { aiSummaryRelatedData, flattenPageComponents, normalizePageDocument, parsePage, validate,
  type Page } from '../src/internal';
import { automaticQueryTableSources } from '../../data-execution/src/source-program/table-pagination';

function setup(): Page {
  const result = parsePage(fixture);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.page;
}
function summary(page: Page, id: string) {
  const component = flattenPageComponents(page).find(component => component.id === id);
  if (component?.type !== 'aiSummary') throw Error(`Missing summary ${id}`);
  return component;
}
function sources(page: Page, id: string, tabs = {}) {
  return Object.keys(aiSummaryRelatedData(page, summary(page, id).props, tabs, id));
}
function card(page: Page, id = 'left-card') {
  const component = flattenPageComponents(page).find(component => component.id === id);
  if (component?.type !== 'compositeCard') throw Error('Missing card');
  return component;
}

describe('AI summary composition and explicit container scope', () => {
  it('accepts the same feature page used by Playground, with independent, section, card and Tab summaries', () => {
    expect(validate(fixture)).toEqual([]);
    const page = setup();
    expect(sources(page, 'page-ai')).toEqual(['comparison', 'usage']);
    expect(sources(page, 'section-ai')).toEqual(['usage']);
    expect(sources(page, 'left-card-summary')).toEqual(['usage']);
    expect(sources(page, 'right-card-summary')).toEqual(['comparison']);
    expect(sources(page, 'tab-usage-ai')).toEqual(['usage']);
    expect(sources(page, 'tab-comparison-ai')).toEqual(['comparison']);
  });
  it('deduplicates siblings, ignores other summaries and never infers scope from placement alone', () => {
    const page = setup();
    const ai = summary(page, 'left-card-summary');
    card(page).props.components.unshift({ ...ai, id: 'sibling-ai', props: { relatedDataSources: ['unreferenced'], promptTemplate: 'other' } });
    expect(sources(page, ai.id)).toEqual(['usage']);
    delete ai.props.scope;
    expect(aiSummaryRelatedData(page, ai.props, {}, ai.id)).toEqual({});
    expect(validate(page).some(error => error.message.includes('动态生成需要'))).toBe(true);
  });
  it('rejects ambiguous scope with a stable path, while body still bypasses generation configuration', () => {
    const page = setup();
    const ai = summary(page, 'left-card-summary');
    ai.props.relatedDataSources = ['missing'];
    expect(validate(page)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/props/components/0/props/scope', message: '所在区域 scope 不能与其他分析范围同时声明'
    }));
    ai.props.body = '已有正文';
    expect(validate(page)).toEqual([]);
    expect(sources(page, ai.id)).toEqual([]);
  });
  it('rejects the new contract below 6.58, including summaries with body in a composite card', () => {
    const page = setup();
    summary(page, 'left-card-summary').props = { body: '已有正文' };
    expect(validate({ ...page, schemaVersion: '6.55' }).some(error => error.message.includes('6.58'))).toBe(true);
  });
  it('keeps original nesting restrictions and disallows a container inside a composite card', () => {
    const page = setup();
    const parent = card(page);
    Object.assign(parent.props.components[1]!, { type: 'compositeCard', props: { components: [] } });
    expect(validate(page).some(error => error.message.includes('组合卡'))).toBe(true);
  });
  it('counts the summary as a query-table consumer and does not infer query pagination ownership', () => {
    const page = setup();
    const section = page.sections[2]!;
    const table = section.components.find(component => component.type === 'table');
    if (table?.type !== 'table') throw Error('Missing table');
    page.sections = [section];
    const source = page.dataSources.usage!;
    source.fields = { month: { type: 'string', role: 'dimension', queryField: 'month' }, tokens: { type: 'number', role: 'measure', queryField: 'tokens' } };
    source.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['month'], output_metrics: ['tokens'], order: { offset: 0, limit: 20 } }] } } };
    table.props.pagination = { mode: 'query' };
    expect(validate(page)).toContainEqual(expect.objectContaining({
      path: '/sections/0/components/2/data/main', message: '查询分页表格必须独占页面数据源 usage，当前引用 2 次'
    }));
    delete table.props.pagination;
    expect(automaticQueryTableSources(page).has('usage')).toBe(false);
    summary(page, 'section-ai').props.body = '已有正文';
    expect(automaticQueryTableSources(page).has('usage')).toBe(true);
  });
});

describe('top-first summary structure', () => {
  it('rejects summaries below content without mutating or reordering the source', () => {
    const page = setup();
    card(page).props.components.reverse();
    const before = structuredClone(page);
    expect(validate(page)).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/props/components/2', message: expect.stringContaining('区域内容顶部')
    }));
    expect(page).toEqual(before);
  });
  it('rejects independent summaries after page content, and preserves header placement', () => {
    const page = setup();
    const summarySection = page.sections.splice(1, 1)[0]!;
    page.sections.push(summarySection);
    expect(validate(page).some(error => error.message.includes('页面正文顶部'))).toBe(true);
  });
  it('requires full width, supports weighted section tracks, and rejects a summary backdrop', () => {
    const page = setup();
    const section = page.sections[2]!;
    page.sections = [section];
    section.columnTracks = [1, 2, 1];
    section.components.forEach(component => { component.layout.span = 3; });
    expect(validate(page)).toEqual([]);
    section.components[0]!.layout.span = 2;
    expect(validate(page).some(error => error.message.includes('占满所属区域 3 列'))).toBe(true);
    section.components[0]!.layout = { span: 3, layer: 'backdrop' };
    expect(validate(page).some(error => error.message.includes('不能声明铺底层'))).toBe(true);
  });
  it('keeps legacy order readable but refuses to write a new-version document with that order', () => {
    const unordered = structuredClone(legacy);
    unordered.sections[2]!.components.reverse();
    unordered.sections[3]!.components.reverse();
    expect(validate(unordered)).toEqual([]);
    expect(normalizePageDocument(unordered).ok).toBe(false);
    const ordered = structuredClone(legacy);
    const result = normalizePageDocument(ordered);
    expect(result.ok).toBe(true);
    if (result.ok) expect(validate(result.document)).toEqual([]);
  });
  it('accepts consecutive summaries at the top of one container', () => {
    const page = setup();
    const ai = summary(page, 'left-card-summary');
    card(page).props.components.unshift({ ...ai, id: 'second-summary', props: { body: '另一份正文' } });
    expect(validate(page)).toEqual([]);
  });
});
