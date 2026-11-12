import { readFileSync } from 'node:fs';
import { pageSchema } from '../packages/page/src/schema';
import { scanPresentationBindings } from '../metriccanvas-authoring/core/page/data-scan';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../packages/page/src/index';
import { runPresentationOperation } from '../metriccanvas-authoring/core/presentation/operation';
import { inspectAuthoringPresentation } from '../metriccanvas-authoring/core/presentation/audit';
import { chartPresentationProbes } from './authoring-presentation-probes';
import type { MainDataSlots } from '../packages/engine/widgets/src/shared/component-data';

function document(format = 'compact-million-1', unit = 'Tokens') {
  return { schemaVersion: '6.82', layout: 'dashboard', id: 'presentation-test', dataSources: {
    values: { fields: { dimension: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure', unit, defaultFormat: format } },
      source: { type: 'inline', rows: [{ dimension: 'a', amount: 1000000 }] } } }, sections: [{ id: 'main', components: [
        { id: 'chart', type: 'barChart', data: { main: 'values' }, layout: { span: 12 }, props: {
          categoryField: 'dimension', series: [{ field: 'amount' }], showValueLabels: true } },
        { id: 'table', type: 'table', data: { main: 'values' }, layout: { span: 12 }, props: { columns: [{ field: 'amount', title: '量' }] } }
      ] }] };
}

describe('AI authoring presentation policy, not page legality', () => {
  it('retains general engine support while reporting non-Tokens authoring scale conflict', () => {
    const parsed = parsePage(document('compact-million-1', '元'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('fixture invalid');
    expect(inspectAuthoringPresentation(parsed.page).findings.map(f => f.code)).toEqual([
      'PRESENTATION_TOKENS_SCALE_CONFLICT', 'PRESENTATION_TOKENS_SCALE_CONFLICT']);
  });
  it('uses final explicit binding, retaining compatible source defaults', () => {
    const raw = document('percent-2', '%');
    raw.sections[0]!.components[0]!.props.series![0]!.field = { data: 'main', field: 'amount', format: 'number-1' } as never;
    const parsed = parsePage(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('fixture invalid');
    const findings = inspectAuthoringPresentation(parsed.page).findings;
    expect(findings.map(f => f.code)).toEqual(['PRESENTATION_PERCENT_UNIT_CONFLICT']);
    expect(findings[0]!.path).toContain('/series/0/field');
  });
  it('never scales already scaled declared units again', () => {
    const parsed = parsePage(document('compact-million-1', '百万Tokens'));
    if (!parsed.ok) throw new Error('fixture invalid');
    expect(inspectAuthoringPresentation(parsed.page).findings.map(f => f.code)).toEqual([
      'PRESENTATION_DOUBLE_SCALE', 'PRESENTATION_DOUBLE_SCALE']);
  });
  it('actual chart axes separate scale units while labels and tooltips retain scalar formatting', () => {
    for (const type of ['barChart', 'lineChart'] as const) {
      const raw = document(); const chart = raw.sections[0]!.components[0]!;
      const data = { main: { fields: raw.dataSources.values.fields, snapshot: { status: 'ready', rows: [{ dimension: 'a', amount: 1000000 }] } } } as MainDataSlots;
      const props = type === 'barChart' ? chart.props : { xField: 'dimension', series: [{ field: 'amount' }], showValueLabels: true };
      const probes = chartPresentationProbes(type, props as never, data);
      expect(probes[0]!.axis.matches).toBe(true);
      expect(probes[0]!.label.matches).toBe(true);
      expect(probes[0]!.tooltip.matches).toBe(true);
      expect(probes[0]!.axis.actual).toBe('1');
      expect(probes[0]!.unit).toEqual({ actual: '百万Tokens', expected: '百万Tokens', matches: true });
      expect(probes[0]!.label.actual).toBe('1百万');
      expect(probes[0]!.tooltip.actual).toBe('1百万');
    }
  });
});

describe('scoped authoring review preserves old independent views', () => {
  it('title and width edits do not rewrite or report old money million settings', () => {
    const raw = document('compact-million-1', '元');
    const prior = parsePage(raw); if (!prior.ok) throw new Error('invalid baseline');
    raw.sections[0]!.components[1]!.props.columns![0]!.title = '只改标题';
    Object.assign(raw.sections[0]!.components[1]!.props.columns![0]!, { width: 180 });
    const current = parsePage(raw); if (!current.ok) throw new Error('invalid candidate');
    expect(inspectAuthoringPresentation(current.page, { baseline: prior.page }).findings).toEqual([]);
    expect(raw.dataSources.values.fields.amount.defaultFormat).toBe('compact-million-1');
  });
  it('new conflicting number view is reported and explicit raw intent is honored', () => {
    const raw = document('percent-2', '%');
    const prior = parsePage(raw); if (!prior.ok) throw new Error('invalid baseline');
    raw.sections[0]!.components[0]!.props.series![0]!.field = { data: 'main', field: 'amount', format: 'number-1' } as never;
    const current = parsePage(raw); if (!current.ok) throw new Error('invalid candidate');
    const findings = inspectAuthoringPresentation(current.page, { baseline: prior.page }).findings;
    expect(findings.map(f => f.code)).toEqual(['PRESENTATION_PERCENT_UNIT_CONFLICT']);
    expect(inspectAuthoringPresentation(current.page, { baseline: prior.page, rawValuePaths: [findings[0]!.path] }).findings).toEqual([]);
  });
  it('changed shared numeric contracts review every real consumer', () => {
    const raw = document('compact-million-1', 'Tokens');
    const prior = parsePage(raw); if (!prior.ok) throw new Error('invalid baseline');
    raw.dataSources.values.fields.amount.unit = '元';
    const current = parsePage(raw); if (!current.ok) throw new Error('invalid candidate');
    expect(inspectAuthoringPresentation(current.page, { baseline: prior.page }).findings).toHaveLength(2);
  });
});

it('preserves preexisting percentage raw views on unrelated title edits', () => {
  const raw = document('number-1', '%');
  const prior = parsePage(raw); if (!prior.ok) throw new Error('invalid baseline');
  raw.sections[0]!.components[1]!.props.columns![0]!.title = '新标题';
  const next = parsePage(raw); if (!next.ok) throw new Error('invalid candidate');
  expect(inspectAuthoringPresentation(next.page, { baseline: prior.page }).findings).toEqual([]);
  expect(raw.dataSources.values.fields.amount.defaultFormat).toBe('number-1');
});

it('raw intent never exempts scaled compact or adaptive currency formats', () => {
  for (const format of ['compact-wan-1', 'cny-adaptive']) {
    const raw = document('percent-2', '%');
    raw.sections[0]!.components[0]!.props.series![0]!.field = { data: 'main', field: 'amount', format } as never;
    const first = runPresentationOperation({ document: raw });
    expect(first.status).not.toBe('ok');
    const intended = runPresentationOperation({ document: raw, presentationIntent: {
      rawValuePaths: ['/sections/0/components/0/props/series/0/field'] } });
    expect(intended.status).toBe(first.status);
    expect(intended.diagnostics).toEqual(first.diagnostics);
  }
});

it('uses real Schema bindings for arrays, secondary, pinned and escaped byFilter cases', () => {
  const binding = { data: 'main', field: 'amount', format: 'number-1' };
  const table = { id: 'table', type: 'table', props: { columns: [{ field: binding, secondaryField: binding, badgeField: binding,
    pinnedTop: { field: { byFilter: { filterId: 'choice', cases: { 'a/b': binding } } }, secondaryField: binding, badgeField: binding } }] } };
  const paths = scanPresentationBindings(table, pageSchema, '/component').map(use => use.path);
  expect(paths).toContain('/component/props/columns/0/secondaryField');
  expect(paths).toContain('/component/props/columns/0/pinnedTop/field/byFilter/cases/a~1b');
  expect(paths).toContain('/component/props/columns/0/pinnedTop/badgeField');
  const ranking = { id: 'ranking', type: 'rankingDetailCard', props: { nameField: 'dimension', valueField: binding,
    changeField: binding, badgeFields: [binding] } };
  const rankingPaths = scanPresentationBindings(ranking, pageSchema, '/ranking').map(use => use.path);
  expect(rankingPaths).toContain('/ranking/props/badgeFields/0');
  expect(rankingPaths).toContain('/ranking/props/changeField');
});

it('detects actual secondary binding overrides and row-expansion private fields', () => {
  const raw = document('percent-2', '%');
  Object.assign(raw.sections[0]!.components[1]!.props.columns![0]!, {
    secondaryField: { data: 'main', field: 'amount', format: 'number-1' } });
  const parsed = parsePage(raw); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  expect(inspectAuthoringPresentation(parsed.page).findings.map(f => f.path)).toEqual([
    '/sections/0/components/1/props/columns/0/secondaryField']);
  const expansion = JSON.parse(readFileSync('pages/capabilities/table/table-row-expansion-inline.json', 'utf8'));
  expansion.dataSources.customers.fields.orders.items.fields.amount.defaultFormat = 'compact-million-1';
  for (const section of expansion.sections) for (const component of section.components) {
    const columns = component.props.rowExpansion?.table.columns;
    if (columns) columns[2].field.format = 'compact-million-1';
  }
  const expanded = parsePage(expansion); if (!expanded.ok) throw new Error(JSON.stringify(expanded.errors));
  expect(inspectAuthoringPresentation(expanded.page).findings.some(f => f.path.includes('/props/rowExpansion/table/columns/'))).toBe(true);
});

it('component moves and JSON object key order keep existing numeric settings stable', () => {
  const raw = document('compact-million-1', '元');
  const baseline = parsePage(raw); if (!baseline.ok) throw new Error('invalid baseline');
  raw.sections[0]!.components.reverse();
  const field = raw.dataSources.values.fields.amount;
  raw.dataSources.values.fields.amount = Object.fromEntries(Object.entries(field).reverse()) as typeof field;
  const candidate = parsePage(raw); if (!candidate.ok) throw new Error('invalid candidate');
  expect(inspectAuthoringPresentation(candidate.page, { baseline: baseline.page }).findings).toEqual([]);
});

it('shares declaration and recommendation boundary vectors with the Python authoring profile', async () => {
  const vectors = JSON.parse(readFileSync('metriccanvas-authoring/core/presentation/conformance.json', 'utf8'));
  const { formatApplicability } = await import('../metriccanvas-authoring/core/presentation/audit');
  for (const vector of vectors) {
    expect(formatApplicability({ type: 'number', role: 'measure', unit: vector.unit }, vector.expectedFormat) ?? null).toBe(vector.expectedFinding);
  }
});
