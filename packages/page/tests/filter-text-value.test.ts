import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/report-date-filters-page.json';
import { applyPageParamSelection, extractPageParams, parsePage, resolvePageParams } from '../src';
import { collectFilterTextValueReferences } from '../src/filter-text-value';
import { resolveTextValues } from '../src/text-value';

function document() {
  const raw = structuredClone(fixture) as any;
  raw.schemaVersion = '6.15';
  raw.sections[0].components[0].props.asOf = {
    label: '报告期间', value: { filter: 'period-filter', format: 'period' }
  };
  raw.sections[0].components[0].props.subtitle = { filter: 'period-filter', format: 'period' };
  return raw;
}

describe('explicit filter text and period contracts', () => {
  it('gates the capability at 6.15 and continues reading legacy reports', () => {
    expect(parsePage(document()).ok).toBe(true);
    expect(parsePage(fixture).ok).toBe(true);
    const legacy = parsePage(fixture);
    if (legacy.ok) expect(legacy.page.schemaVersion).toBe('6.13');
    for (const schemaVersion of ['6.13', '6.14']) {
      const raw = document(); raw.schemaVersion = schemaVersion;
      const result = parsePage(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some(error => error.message.includes('6.15'))).toBe(true);
    }
  });
  it.each([
    { filter: 'missing', format: 'period' },
    { filter: 'period-filter', param: 'period', format: 'period' },
    { filter: 'period-filter', format: 'period-compact' },
    { filter: 'period-filter', rangeSeparator: '～' },
    { filter: 'period-filter', format: 'number-2' }
  ])('rejects broken or ambiguous declarations: %j', value => {
    const raw = document(); raw.sections[0].components[0].props.asOf.value = value;
    expect(parsePage(raw).ok).toBe(false);
  });
  it('allows period only on time inputs, including immutable time parameters', () => {
    const raw = document();
    raw.sections[0].components[0].props.subtitle = { param: 'period', format: 'period' };
    expect(parsePage(raw).ok).toBe(true);
    raw.filters[0] = { id: 'period-filter', type: 'dimension', dimension: 'region' };
    expect(parsePage(raw).ok).toBe(false);
    delete raw.params; delete raw.dataSources.sales.source.query.filterBindings;
    delete raw.sections[0].components[0].props.filterIds;
    raw.sections[0].components[0].props.subtitle = { filter: 'period-filter' };
    raw.sections[0].components[0].props.asOf.value = { filter: 'period-filter' };
    expect(parsePage(raw).ok).toBe(true);
  });
  it('materializes supplied parameter seeds while preserving explicit references in the document', () => {
    const raw = document(); raw.sections[0].components[0].props.subtitle = { param: 'period', format: 'period' };
    const filled = resolvePageParams(raw, { period: { start: '2026-02', end: '2026-05' } });
    if (!filled.ok) throw Error(JSON.stringify(filled.issues));
    const header = filled.resolvedPage.sections[0].components[0];
    if (header.type !== 'reportHeader') throw Error('header');
    expect(header.props.asOf?.value).toBe('2026-02 至 2026-05');
    expect(header.props.subtitle).toBe('2026-02 至 2026-05');
    expect((filled.document.sections[0].components[0].props as any).asOf.value).toEqual({ filter: 'period-filter', format: 'period' });
    expect(raw.params.query.times[0].start).toBe('2026-01');
  });
  it('keeps DQE and initial business objects outside the text scope', () => {
    const raw = document();
    raw.dataSources.sales.source.initial = { rows: [{ filter: 'opaque', format: 'period' }] };
    expect(collectFilterTextValueReferences(raw)).toHaveLength(2);
    const resolved = resolveTextValues(raw, { values: new Map(), filterValues: new Map([['period-filter', { start: '2026-01', end: '2026-05' }]]) }) as any;
    expect(resolved.dataSources).toBe(raw.dataSources);
    expect(resolved.sections[0].components[0].props.asOf.value).toBe('2026-01 至 2026-05');
  });
  it('keeps filter reference paths aligned when optional parameter array items disappear', () => {
    const raw = document();
    raw.params.display = [{ id: 'optional-tag', type: 'string', required: false }];
    raw.sections[0].components[0].props.tags = [{ param: 'optional-tag' }, { filter: 'period-filter', format: 'period' }];
    const filled = resolvePageParams(raw);
    if (!filled.ok) throw Error(JSON.stringify(filled.issues));
    const header = filled.resolvedPage.sections[0].components[0];
    if (header.type !== 'reportHeader') throw Error('header');
    expect(header.props.tags).toEqual(['2026-01 至 2026-06']);
  });
  it('adds explicit period binding after extraction without deleting authored static captions', () => {
    for (const staticCaption of [false, true]) {
      const raw = structuredClone(fixture) as any;
      delete raw.params; delete raw.filters; delete raw.sections[0].components[0].props.filterIds;
      delete raw.dataSources.sales.source.query.filterBindings;
      Object.assign(raw.dataSources.sales.source.query.body.dsl_list[0].filter.time, { start: '2026-01', end: '2026-06' });
      if (staticCaption) raw.sections[0].components[0].props.asOf = { label: '版本', value: '年度初稿' };
      const extracted = extractPageParams(raw, { baseline: 'verified' });
      if (!extracted.ok) throw Error(JSON.stringify(extracted.issues));
      const applied = applyPageParamSelection(extracted, extracted.candidates.map(candidate => candidate.id));
      if (!applied.ok) throw Error(JSON.stringify(applied.issues));
      const props = applied.document.sections[0].components[0].props as any;
      expect(props.asOf.value).toEqual(staticCaption ? '年度初稿' : { filter: props.filterIds[0], format: 'period' });
      expect(raw.filters).toBeUndefined();
    }
  });
});
