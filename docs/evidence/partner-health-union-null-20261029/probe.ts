import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parsePage, versionPolicy, type PageDocument} from '../../../packages/page/src/index';
import {flattenPageComponents, isQueryDataSource, resolveDataSourceFields, tableColumnLeaves,
  type DataSnapshot, type EffectiveQuery, type QueryDataSource, type TableComponent,
  type ComputeOperator} from '../../../packages/page/src/internal';
import {createDqeGateway} from '../../../packages/data-execution/src/dqe/dqe';
import {createSourceProgram, initialFilterValues} from '../../../packages/data-execution/src/runtime';
import {applyComputation} from '../../../packages/data-execution/src/compute';
import type {RuntimeDataGateway} from '../../../packages/data-execution/src/ports';
import {alignTableRows, alignedCellText} from '../../../packages/engine/widgets/src/components/table/rows';
import type {NamedDataSlots} from '../../../packages/engine/widgets/src/shared/component-data';
import {hostRenderSnapshot} from '../../../packages/engine/runtime-ui/src/widget-host-state';

const directory = new URL('.', import.meta.url);
const pageBytes = readFileSync(new URL('baseline-page.json', directory));
const document: PageDocument = JSON.parse(pageBytes.toString());
const parsed = parsePage(document);
assert(parsed.ok, JSON.stringify(parsed.errors));
const page = parsed.page;
interface MockRow {region: string; value: number | string | null}
interface Fixture {expectedOrganizations: string[]; sources: Record<string, MockRow[]>; expectedSelectedTotals: Record<string, number>}
const fixture: Fixture = JSON.parse(readFileSync(new URL('mock.json', directory), 'utf8'));
const selectedSources = Object.keys(fixture.sources);

function tableFor(grain: string): TableComponent {
  const table = flattenPageComponents(page).find(c => c.id === `${grain}-table`);
  assert(table?.type === 'table');
  return table;
}

function querySource(id: string): QueryDataSource {
  const definition = page.dataSources[id];
  assert(isQueryDataSource(definition), id);
  return definition;
}

function scoreField(source: QueryDataSource): string {
  const field = Object.keys(source.fields).find(id => source.fields[id].role === 'measure');
  assert(field);
  return field;
}

function rawRows(id: string, rows: MockRow[]): Record<string, unknown>[] {
  const source = querySource(id);
  return rows.map(row => Object.fromEntries(Object.entries(source.fields).map(([field, mapping]) => {
    assert('queryField' in mapping);
    return [mapping.queryField, field === 'region' ? row.region : row.value];
  })));
}

function mockGateway(emptyMain = false): RuntimeDataGateway {
  return {async fetchData(query, context, signal) {
    const id = context?.dataSourceIds?.[0];
    assert(id);
    const prefix = selectedSources.find(name => id.startsWith(`${name}-`));
    let rows = prefix ? fixture.sources[prefix] : [];
    if (emptyMain && prefix === selectedSources[0]) rows = [];
    const result = rawRows(id, rows);
    return createDqeGateway({fetchImpl: async () => Response.json({retCode: 'CBC.0000',
      results: [{code: 'SUCCESS', data: result, total_count: result.length}]})}).fetchData(query, context, signal);
  }};
}

async function readSlots(grain: string, emptyMain = false) {
  const table = tableFor(grain);
  const program = createSourceProgram(page, {gateway: mockGateway(emptyMain)});
  const snapshots = new Map<string, DataSnapshot>();
  try {
    for await (const update of program.read({roots: Object.values(table.data),
      conditions: initialFilterValues(page.filters ?? []), freshness: 'refresh'})) snapshots.set(update.sourceId, update.snapshot);
  } finally {program.dispose();}
  const slots: NamedDataSlots = {};
  for (const [slot, id] of Object.entries(table.data)) {
    const snapshot = snapshots.get(id);
    assert(snapshot?.status === 'ready' || snapshot?.status === 'empty', `${id}: ${JSON.stringify(snapshot)}`);
    slots[slot] = {fields: resolveDataSourceFields(page.dataSources[id]),
      snapshot: snapshot.status === 'ready' ? snapshot : {status: 'ready', rows: []}};
  }
  return {table, slots};
}

function keysOf(slots: NamedDataSlots): string[] {
  return [...new Set(Object.values(slots).flatMap(slot => slot?.snapshot.rows.map(row => String(row.region)) ?? []))].sort();
}

function projectedCandidate(slots: NamedDataSlots, grain: string) {
  // Candidate preparation only: the current protocol has no union-key operator.
  // This explicit, test-only union must not be mistaken for an implemented engine capability.
  const domain = keysOf(slots).map(region => ({region}));
  const bindings = selectedSources.map((name, index) => ({name, slot: Object.keys(tableFor(grain).data)
    .find(slot => tableFor(grain).data[slot] === `${name}-${grain}`)!, field: scoreField(querySource(`${name}-${grain}`)), output: `score-${index}`}));
  const dependencies = new Map(bindings.map(binding => [binding.name, slots[binding.slot]!.snapshot.rows]));
  const operators: ComputeOperator[] = bindings.map(binding => ({op: 'joinAggregate', source: binding.name,
    keys: [{local: 'region', foreign: 'region'}], values: [{field: binding.field, output: binding.output, aggregate: 'unique'}], onMissing: 'null'}));
  operators.push({op: 'sumFields', fields: bindings.map(binding => binding.output), output: 'total', onMissing: 'zero'});
  return applyComputation(operators, domain, dependencies);
}

async function probeRowDomain(grain: string) {
  const {table, slots} = await readSlots(grain);
  const aligned = alignTableRows(slots, table.props.rowKey);
  const columns = tableColumnLeaves(table.props.columns);
  const total = columns.find(c => c.title === '伙伴健康度得分');
  assert(total);
  const union = keysOf(slots);
  const candidate = projectedCandidate(slots, grain);
  assert.deepEqual(union, fixture.expectedOrganizations);
  assert.equal(union.length, 15);
  assert.equal(aligned.length, 1);
  assert.equal(candidate.length, 15);
  for (const [key, expected] of Object.entries(fixture.expectedSelectedTotals)) {
    assert.equal(candidate.find(row => row.region === key)?.total, expected, key);
  }
  const noMain = await readSlots(grain, true);
  assert.equal(alignTableRows(noMain.slots, table.props.rowKey).length, 0);
  assert.equal(projectedCandidate(noMain.slots, grain).length, 14);
  return {grain, responseCounts: Object.fromEntries(selectedSources.map(name => [name, fixture.sources[name].length])),
    expectedUnionRows: union.length, actualRows: aligned.length, currentTotalText: alignedCellText(total.field, slots, aligned[0]),
    candidateRows: candidate.length, candidateTotals: Object.fromEntries(candidate.map(row => [row.region, row.total])),
    emptyMain: {expectedUnionRows: 14, actualRows: 0}, slots, candidate};
}

async function normalizeCase(label: string, rawValue: number | string | null | undefined, omitField = false) {
  const row: Record<string, unknown> = {组织: label};
  if (!omitField) row.得分 = rawValue;
  const query: EffectiveQuery = {language: 'dqe', body: {dsl_list: [{output_dims: ['组织'], output_metrics: ['得分']}]},
    fieldMappings: {region: {type: 'string', role: 'dimension', queryField: '组织'}, score: {type: 'number', role: 'measure', queryField: '得分'}}, filterValues: []};
  const gateway = createDqeGateway({fetchImpl: async () => Response.json({retCode: 'CBC.0000',
    results: [{code: 'SUCCESS', data: [row], total_count: 1}]})});
  try {
    const result = await gateway.fetchData(query);
    const fields = {region: {type: 'string', role: 'dimension'}, score: {type: 'number', role: 'measure'}} as const;
    const slots: NamedDataSlots = {main: {fields, snapshot: {status: 'ready', ...result}}};
    const aligned = alignTableRows(slots, 'region')[0];
    const binding = {data: 'main', field: 'score', format: 'number-1', missingText: '--'} as const;
    const computed = applyComputation([{op: 'sumFields', fields: ['score', 'other'], output: 'total', onMissing: 'zero'}], result.rows.map(row => ({...row, other: 5})));
    const direct = applyComputation([{op: 'sumFields', fields: ['score', 'other'], output: 'total', onMissing: 'zero'}], [{region: label, score: rawValue ?? null, other: 5}]);
    return {label, status: 'ready', normalized: result.rows[0].score, display: alignedCellText(binding, slots, aligned), total: computed[0].total,
      directUnnormalizedTotal: direct[0].total};
  } catch (error) {return {label, status: 'error', errorCode: (error as {code?: string}).code};}
}

function diagnosticPage(result: Awaited<ReturnType<typeof probeRowDomain>>): PageDocument {
  const sources = Object.fromEntries(Object.entries(result.slots).map(([slot, value]) => {
    assert(value);
    const fields = Object.fromEntries(Object.entries(value.fields).map(([name, field]) => [name, {...field, nullable: true}]));
    return [slot, {fields, source: {type: 'inline', rows: value.snapshot.rows}}];
  }));
  const columns = [
    {field: 'region', title: '组织'},
    {field: {data: 'main', field: 'closure-rate', format: 'number-1', missingText: '--'}, title: '查询A（1行）'},
    {field: {data: 'customer-eval-score', field: 'customer-eval-rate', format: 'number-1', missingText: '--'}, title: '查询B（10行）'},
    {field: {data: 'perception-willingness-score', field: 'perception-willingness-rate', format: 'number-1', missingText: '--'}, title: '查询C（13行）'},
    {field: {data: 'pending', field: 'total-score', format: 'number-1', missingText: '--'}, title: '当前总分（尚未接计算）'}
  ];
  const candidateFields = Object.fromEntries(['region', 'score-0', 'score-1', 'score-2', 'total'].map(field => [field,
    {type: field === 'region' ? 'string' : 'number', role: field === 'region' ? 'dimension' : 'measure', nullable: true}]));
  return {schemaVersion: versionPolicy.current, id: 'partner-health-union-null-probe', layout: 'dashboard',
    meta: {title: '伙伴健康度：并集与缺项验证（Mock，非正式页面）'},
    dataSources: {...sources, candidate: {fields: candidateFields, source: {type: 'inline', rows: result.candidate}}},
    sections: [
      {id: 'baseline', title: '当前表格行为：并集15个组织，仅显示主查询的1行', components: [{id: 'baseline-table', type: 'table', layout: {span: 12}, data: Object.fromEntries(Object.keys(sources).map(slot => [slot, slot])), props: {rowKey: 'region', columns}}]},
      {id: 'candidate', title: '候选结果快照：测试脚本构造并集，现有算子计算总分（空文本呈现策略待实施）', components: [{id: 'candidate-table', type: 'table', layout: {span: 12}, data: {main: 'candidate'}, props: {rowKey: 'region', columns: Object.keys(candidateFields).map((field, index) => ({field: {data: 'main', field, format: index ? 'number-1' : 'text', missingText: '--'}, title: ['组织', '查询A', '查询B', '查询C', '候选总分'][index]})), pagination: {mode: 'local', pageSize: 20}}}]}
    ]} as PageDocument;
}

async function main() {
  const regions = await probeRowDomain('region');
  const representatives = await probeRowDomain('representative');
  const cases = await Promise.all([normalizeCase('真实0', 0), normalizeCase('null', null), normalizeCase('空字符串', ''),
    normalizeCase('空白字符串', '   '), normalizeCase('数字字符串0', '0'), normalizeCase('负数', -2), normalizeCase('字段完全省略', undefined, true)]);
  assert.deepEqual(cases.filter(row => row.status === 'ready').map(row => row.total), [5, 5, 5, 5, 5, 3]);
  assert.equal(cases.at(-1)?.errorCode, 'DQE_FIELD_MAPPING_ERROR');
  const table = tableFor('region');
  const hostSlots = new Map<string, DataSnapshot>(Object.keys(table.data).map(slot => [slot, {status: 'ready', rows: []}]));
  hostSlots.set('customer-eval-score', {status: 'error', error: {code: 'DQE_FIELD_MAPPING_ERROR', message: '合成响应省略了声明得分字段'}});
  const host = hostRenderSnapshot(table, hostSlots);
  assert.equal(host.status, 'error');
  const preview = diagnosticPage(regions);
  const valid = parsePage(preview);
  assert(valid.ok, JSON.stringify(valid.errors));
  writeFileSync(new URL('preview.json', directory), JSON.stringify(preview, null, 2) + '\n');
  const clean = ({slots, candidate, ...result}: typeof regions) => result;
  const report = {baseline: {sha: process.env.PROBE_BASE_SHA, pageSha256: createHash('sha256').update(pageBytes).digest('hex')},
    rowDomain: [clean(regions), clean(representatives)], numericCases: cases, omittedFieldHostStatus: host.status,
    proposalVerified: 'test-only union domain + existing joinAggregate/sumFields; no product union-key capability implemented'};
  writeFileSync(new URL('result.json', directory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert.equal(readFileSync(new URL('baseline-page.json', directory)).compare(pageBytes), 0);
  if (process.argv.includes('--expect-union')) assert.equal(regions.actualRows, 15, '当前正式页面未实现组织并集行域');
}

await main();
