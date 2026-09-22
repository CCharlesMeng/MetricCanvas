import { buildPublicationSchema } from '../../metriccanvas-authoring/contracts/authored/publication-contract.ts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  componentCatalog,
  normalizePageDocument,
  ERROR_TYPES,
  pageSchema,
  QUERY_ERROR_CODES,
  validate,
  versionPolicy
} from '../../packages/page/src/internal.ts';
import { buildPageReference, validateReferenceLinks } from './page-reference.ts';
import { invariants, type InvariantDefinition } from './page-conformance-vectors.ts';
import {extractPageParams,applyPageParamSelection,resolvePageParams} from '../../packages/page/src/index.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const pagePackage = JSON.parse(await readFile(path.join(repoRoot, 'packages/page/package.json'), 'utf8')) as { version: string };
const productContractVersion = pagePackage.version;
const productContractRoot = path.join(repoRoot, 'contracts/metriccanvas');
const bundleRoot = path.join(repoRoot, 'metriccanvas-authoring');
const authoringContractRoot = path.join(bundleRoot, 'contracts');
const authoredPageBuildSpec = path.join(
  authoringContractRoot,
  'authored/page-build-spec.schema.json'
);
const authoredPageBuildArtifact = path.join(
  authoringContractRoot,
  'authored/page-build-artifact.schema.json'
);
const authoredRelayPageArtifactEnvelope = path.join(
  authoringContractRoot,
  'authored/relay-page-artifact-envelope.schema.json'
);
const authoredBusinessTermResolution = path.join(
  authoringContractRoot,
  'authored/business-term-resolution.schema.json'
);
const authoredAgentModelDecision = path.join(
  authoringContractRoot,
  'authored/agent-model-decision.schema.json'
);
const authoredAgentStepEvent = path.join(
  authoringContractRoot,
  'authored/agent-step-event.schema.json'
);
const authoredAgentConformance = path.join(
  authoringContractRoot,
  'authored/agent-conformance.schema.json'
);
const authoringContractVersion = '0.3.0';
const snapshotRoot = path.join(bundleRoot, 'contract-snapshot');
// 旧接口仅供退场中的客户端对照；提供方新接口以 #105 为准。
const legacyContractRoot = path.join(repoRoot, 'tools/fixtures/legacy-contracts');
const interfaceCopyRelative = 'page-assets/rest-services-page-assets.yaml';
const checkOnly = process.argv.includes('--check');

type OutputMap = Map<string, string>;

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function manifestFiles(outputs: OutputMap): Array<{ file: string; sha256: string }> {
  return [...outputs.entries()]
    .map(([file, content]) => ({ file, sha256: sha256(content) }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

async function buildProductOutputs(): Promise<OutputMap> {
  const outputs: OutputMap = new Map();
  outputs.set('page/schema.json', json(pageSchema));
  outputs.set('authoring/publication.schema.json', json(buildPublicationSchema(pageSchema)));
  outputs.set('authoring/publication-conformance.json', await readFile(path.join(authoringContractRoot, 'authored/publication-conformance.json'), 'utf8'));
  outputs.set('page/component-catalog.json', json(componentCatalog));
  const maps: Record<string, { regions: string[]; source: { file: string; sha256: string } }> = {};
  for (const name of ['china', 'world']) {
    const file = `packages/engine/widgets/src/components/map-chart/maps/${name}.json`;
    const content = await readFile(path.join(repoRoot, file), 'utf8');
    const geo = JSON.parse(content) as { features: Array<{ properties: { name?: unknown } }> };
    const regions = [...new Set(geo.features.map(f => f.properties.name).filter((n): n is string => typeof n === 'string' && n.length > 0))].sort();
    if (!regions.length) throw new Error(`底图 ${name} 缺少区域名称`);
    maps[name] = { regions, source: { file, sha256: sha256(content) } };
  }
  outputs.set('page/map-regions.json', json({ contractVersion: '1', maps }));
  outputs.set('query/error-codes.json', json({ codes: QUERY_ERROR_CODES }));
  outputs.set('page/error-types.json', json({ types: ERROR_TYPES }));
  outputs.set(
    'data-context/schema.json',
    await readFile(path.join(repoRoot, 'docs/schema-metadata.schema.json'), 'utf8')
  );

  const validFixtureRoot = path.join(repoRoot, 'packages/page/fixtures/contract-valid');
  const fixtures = new Map<string, unknown>();
  for (const fileName of (await readdir(validFixtureRoot)).sort()) {
    if (!fileName.endsWith('.json')) continue;
    const content = await readFile(path.join(validFixtureRoot, fileName), 'utf8');
    const document = JSON.parse(content) as unknown;
    const errors = validate(document);
    if (errors.length > 0) {
      throw new Error(`合法样例 ${fileName} 未通过校验:\n${JSON.stringify(errors, null, 2)}`);
    }
    fixtures.set(fileName.slice(0, -'.json'.length), document);
    outputs.set(`page/conformance/valid/${fileName}`, content);
  }

  const { layout: _currentLayout, layoutForm: _currentLegacyLayout, ...layoutBase } = fixtures.get('inline-report') as Record<string, unknown>;
  const layoutCases = [];
  for (const schemaVersion of ['5.0', '5.4', '6.0', '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '7.0']) {
    for (const declaration of [
      {}, { layoutForm: 'report' }, { layoutForm: 'dashboard' },
      { layout: 'report' }, { layout: 'dashboard' },
      { layout: 'dashboard', layoutForm: 'dashboard' },
      { layout: 'dashboard', layoutForm: 'report' },
      { layout: 'kiosk' }
    ]) {
      const input = { ...layoutBase, schemaVersion, ...declaration };
      layoutCases.push({ input, expected: normalizePageDocument(input) });
    }
  }
  outputs.set('page/conformance/layout-compatibility.json', json({ cases: layoutCases }));

  const groupedCases: Array<{name: string; input: unknown; expected: unknown}> = [];
  function groupedCase(name: string, change: (page: any) => void) {
    const input = structuredClone(fixtures.get('grouped-params-page'));
    change(input);
    groupedCases.push({name, input, expected: normalizePageDocument(input)});
  }
  groupedCase('range-and-derived', () => {});
  groupedCase('unfilled-template', p => {
    delete p.params.query.dimensions[0].dim_value_list;
    for (const t of p.params.query.times) { delete t.start; delete t.end; }
  });
  groupedCase('old-version', p => { p.schemaVersion = '6.5'; });
  groupedCase('duplicate-id', p => { p.params.query.times[0].id = 'region'; });
  groupedCase('legacy-flat-groups', p => { p.params = {dimensions: p.params.query.dimensions, times: p.params.query.times}; });
  groupedCase('partial-range', p => { delete p.params.query.times[0].end; });
  groupedCase('reversed-range', p => { p.params.query.times[0].start = '2027-01'; });
  groupedCase('invalid-calendar', p => { p.params.query.times[0].start = '2026-13'; });
  groupedCase('duplicate-dim-values', p => { p.params.query.dimensions[0].dim_value_list = ['A','A']; });
  groupedCase('dimension-mismatch', p => { p.params.query.dimensions[0].dim_name = 'other'; });
  groupedCase('retired-endpoint-form', p => {
    p.dataSources.current.source.query.body.dsl_list[0].filter.time = {
      period: 'month', is_aggregate: true,
      start: {param: 'report-period', part: 'start'}, end: {param: 'report-period', part: 'end'}
    };
  });
  groupedCase('reference-with-literal-range', p => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.start = '2026-01'; });
  groupedCase('window-precision-mismatch', p => { p.dataSources.rolling.source.query.body.dsl_list[0].filter.time.window = {kind:'lastN',unit:'day',n:7}; });
  groupedCase('window-on-range', p => { p.dataSources.rolling.source.query.body.dsl_list[0].filter.time.param = 'report-period'; });
  groupedCase('display-input-in-query', p => {
    p.params.display = [{id:'note', type:'string', value:'中国地区部'}];
    p.dataSources.current.source.query.body.dsl_list[0].filter.dims[0].dim_value_list = {param:'note'};
  });
  groupedCase('uncontrolled-reference', p => { p.dataSources.current.source.query.body.dsl_list[0].output_dims = [{param:'region'}]; });
  groupedCase('filter-conflict', p => { p.dataSources.current.source.query.filterBindings = {other:{target:'time'}}; });
  outputs.set('page/conformance/grouped-params.json', json({cases: groupedCases}));

  const parameterTemplate = fixtures.get('dimension-params-page');
  const parameterCases: Array<{name: string; input: unknown; expected: unknown}> = [];
  const parameterCase = (name: string, change: (page: any) => void) => {
    const input = structuredClone(parameterTemplate);
    change(input);
    parameterCases.push({ name, input, expected: normalizePageDocument(input) });
  };
  parameterCase('multiple-partial-sharing', () => {});
  parameterCase('single-dimension', p => { p.params[0].multiple = false; p.params[0].default = 'APAC'; });
  parameterCase('required-no-default', p => { delete p.params[0].default; });
  parameterCase('old-version-floor', p => { p.schemaVersion = '6.1'; });
  parameterCase('wrong-default-shape', p => { p.params[0].default = 'APAC'; });
  parameterCase('duplicate-default', p => { p.params[0].default = ['APAC','APAC']; });
  parameterCase('filter-two-defaults', p => { p.filters[0].default = ['EU']; });
  parameterCase('unknown-initial-param', p => { p.filters[0].initialParam = 'unknown'; });
  parameterCase('query-two-defaults', p => { p.dataSources.sales.source.query.body.dsl_list[0].filter.dims = [{dim_name:'region',dim_value_list:['EU']}]; });
  parameterCase('mismatched-filter-target', p => { p.dataSources.sales.source.query.paramBindings.regions.queryField = 'different'; });
  parameterCase('duplicate-target', p => { p.dataSources.shared.source.query.paramBindings.segment.queryField = 'region'; });
  parameterCase('scalar-query-binding', p => { p.params[1].type = 'string'; });
  parameterCase('unknown-query-param', p => { p.dataSources.shared.source.query.paramBindings.unknown = {target:'dimension',queryField:'other'}; });
  outputs.set('page/conformance/param-bindings.json', json({ cases: parameterCases }));

  const timeCases: Array<{name: string; input: unknown; expected: unknown}> = [];
  const timeCase = (name: string, change: (page: any) => void) => {
    const input = structuredClone(fixtures.get('time-params-page'));
    change(input);
    timeCases.push({name, input, expected: normalizePageDocument(input)});
  };
  timeCase('month-windows', () => {});
  timeCase('named-window-old-version', p => { p.schemaVersion = '6.3'; });
  timeCase('month-to-date', p => { p.dataSources.current.source.query.paramBindings['report-month'].window = {kind:'monthToDate'}; });
  timeCase('named-window-extra-unit', p => { p.dataSources.current.source.query.paramBindings['report-month'].window = {kind:'yearToDate',unit:'year'}; });
  timeCase('legacy-to-date', p => {
    p.schemaVersion = '6.3';
    for (const source of Object.values(p.dataSources) as any[]) {
      const binding = source.source.query.paramBindings['report-month'];
      if (binding.window.kind === 'yearToDate' || binding.window.kind === 'monthToDate') binding.window = {kind:'toDate',unit:binding.window.kind === 'yearToDate' ? 'year' : 'month'};
    }
  });
  timeCase('required-no-default', p => { delete p.params[0].default; });
  timeCase('date-windows', p => {
    p.params[0].granularity = 'date'; p.params[0].default = '2024-02-29';
    for (const source of Object.values(p.dataSources) as any[]) {
      source.source.query.body.dsl_list[0].filter.time.period = 'day';
      const window = source.source.query.paramBindings['report-month'].window;
      if (window.kind === 'lastN') window.unit = 'day';
    }
  });
  timeCase('old-version-floor', p => { p.schemaVersion = '6.2'; });
  timeCase('invalid-month', p => { p.params[0].default = '2026-13'; });
  timeCase('optional-time', p => { p.params[0].required = false; });
  timeCase('unknown-param', p => { p.params[0].id = 'other'; });
  timeCase('scalar-time', p => { p.params[0].type = 'string'; delete p.params[0].granularity; });
  timeCase('duplicate-time', p => { p.params.push({...p.params[0],id:'other'}); p.dataSources.current.source.query.paramBindings.other = {target:'time',window:{kind:'period',unit:'month'}}; });
  timeCase('static-boundary', p => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.start = '2026-01'; });
  timeCase('missing-period', p => { delete p.dataSources.current.source.query.body.dsl_list[0].filter.time; });
  timeCase('wrong-period', p => { p.dataSources.current.source.query.body.dsl_list[0].filter.time.period = 'day'; });
  timeCase('wrong-window-unit', p => { p.dataSources.current.source.query.paramBindings['report-month'].window.unit = 'day'; });
  timeCase('window-out-of-range', p => { p.params[0].default = '0001-01'; });
  timeCase('filter-conflict', p => { p.filters = [{id:'date-filter',type:'timeRange'}]; p.dataSources.current.source.query.filterBindings = {'date-filter':{target:'time'}}; });
  outputs.set('page/conformance/time-param-bindings.json', json({cases:timeCases}));

  const inlineCases: Array<{name:string;input:unknown;expected:unknown}>=[];
  function inlineCase(name:string, change:(p:any)=>void) {
    const input=structuredClone(fixtures.get('inline-params-page'));
    change(input);inlineCases.push({name,input,expected:normalizePageDocument(input)});
  }
  inlineCase('unfilled-template',()=>{});
  inlineCase('filled-range',p=>{p.params.query.dimensions[0].dim_value_list=['中国区'];p.params.query.times[0].start='2026-01';p.params.query.times[0].end='2026-06';});
  inlineCase('old-version',p=>{p.schemaVersion='6.4';});
  inlineCase('optional-query-input',p=>{p.params.query.dimensions[0].required=false;});
  inlineCase('value-default-conflict',p=>{p.params.query.dimensions[0].default='全球';});
  inlineCase('duplicate-values',p=>{p.params.query.dimensions[0].dim_value_list=['中国区','中国区'];});
  inlineCase('invalid-day',p=>{p.params.query.times[0].granularity='date';p.params.query.times[0].start='2026-02-29';p.params.query.times[0].end='2026-03-01';});
  inlineCase('reversed-range',p=>{p.params.query.times[0].start='2026-06';p.params.query.times[0].end='2026-01';});
  inlineCase('uncontrolled-reference',p=>{p.dataSources.tokens.source.query.body.dsl_list[0].output_metrics=[{param:'region'}];});
  inlineCase('wrong-reference-key',p=>{p.dataSources.tokens.source.query.body.dsl_list[0].filter.dims[0].dim_value_list={param:'report_period'};});
  inlineCase('extra-reference-key',p=>{p.dataSources.tokens.source.query.body.dsl_list[0].filter.dims[0].dim_value_list.extra=1;});
  inlineCase('mixed-time-endpoints',p=>{p.dataSources.tokens.source.query.body.dsl_list[0].filter.time.end='2026-06';});
  inlineCase('mixed-binding-model',p=>{p.dataSources.tokens.source.query.paramBindings={region:{target:'dimension',queryField:'other'}};});
  const anchorReference=(p:any)=>{p.params.query.times[0]={id:'report-period',granularity:'month',start:'2026-03',end:'2026-03'};const t=p.dataSources.tokens.source.query.body.dsl_list[0].filter.time;t.window={kind:'lastN',unit:'month',n:12};};
  inlineCase('anchor-window',anchorReference);
  inlineCase('mismatched-windows',p=>{anchorReference(p);p.dataSources.tokens.source.query.body.dsl_list[0].filter.time.end={param:'report-period',part:'end',window:{kind:'lastN',unit:'month',n:6}};});
  outputs.set('page/conformance/inline-params.json',json({cases:inlineCases}));

  const tokensInput=JSON.parse(await readFile(path.join(repoRoot,'packages/page/fixtures/parameter-extraction/tokens-parameter-source.json'),'utf8'));
  const extractionContext={baseline:'tokens-local-verified-fixture',dimensionIdentities:Object.fromEntries(Object.keys(tokensInput.dataSources).map(id=>[id,{'区域':'region'}]))};
  const extraction=extractPageParams(tokensInput,extractionContext);
  if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
  const selection=extraction.candidates.map(c=>c.id);
  const selected=applyPageParamSelection(extraction,selection);
  if(!selected.ok)throw Error(JSON.stringify(selected.issues));
  const resolved=resolvePageParams(selected.document,selected.originalValues);
  if(!resolved.ok)throw Error(JSON.stringify(resolved.issues));
  outputs.set('page/conformance/parameter-extraction.json',json({input:tokensInput,context:extractionContext,candidates:extraction.candidates,selectedIds:selection,template:selected.document,originalValues:selected.originalValues,filled:resolved.document,execution:resolved.resolvedPage}));

  const conformance = buildPageConformance(fixtures, invariants);
  for (const vector of conformance.vectors) {
    outputs.set(`page/conformance/invalid/${vector.case}.json`, json(vector));
  }
  outputs.set('page/conformance/coverage.json', json(conformance.coverage));
  const reference = await buildPageReference(repoRoot, pageSchema, componentCatalog, outputs, versionPolicy.current);
  for (const [file, content] of reference) outputs.set(`page/reference/${file}`, content);

  outputs.set(
    'manifest.json',
    json({
      productContractVersion,
      pageSchemaVersion: versionPolicy.current,
      source: 'TypeScript/Zod single-way export',
      files: manifestFiles(outputs)
    })
  );
  return outputs;
}

interface PageConformanceVector {
  case: string;
  invariant: string;
  input: unknown;
  expected: unknown;
}

interface PageConformanceCoverage {
  invariants: Array<{
    id: string;
    description: string;
    valid: string[];
    invalid: string[];
  }>;
}

/**
 * 页面校验 conformance：逐条不变式各有正例（行使它的合法样例）与反例（单点破坏）。
 * 反例的 expected 由 TypeScript 校验器产出，Java 在同一输入上必须逐条相同；
 * 每个反例还要命中自己声明的 expect，防止因别的原因失败而被误记为覆盖。
 */
function buildPageConformance(
  fixtures: ReadonlyMap<string, unknown>,
  definitions: readonly InvariantDefinition[]
): { vectors: PageConformanceVector[]; coverage: PageConformanceCoverage } {
  const vectors: PageConformanceVector[] = [];
  const seenCases = new Set<string>();
  const seenInvariants = new Set<string>();
  const coverage: PageConformanceCoverage = { invariants: [] };

  for (const definition of definitions) {
    if (seenInvariants.has(definition.id)) {
      throw new Error(`不变式 id 重复:${definition.id}`);
    }
    seenInvariants.add(definition.id);
    if (definition.valid.length === 0 || definition.cases.length === 0) {
      throw new Error(`不变式 ${definition.id} 必须同时有正例与反例`);
    }
    for (const fixture of definition.valid) {
      if (!fixtures.has(fixture)) {
        throw new Error(`不变式 ${definition.id} 引用了不存在的合法样例:${fixture}`);
      }
    }
    for (const vectorCase of definition.cases) {
      if (seenCases.has(vectorCase.case)) {
        throw new Error(`反例名重复:${vectorCase.case}`);
      }
      seenCases.add(vectorCase.case);
      const input = conformanceInput(fixtures, vectorCase.base, vectorCase.mutate);
      const expected = validate(input);
      if (expected.length === 0) {
        throw new Error(`反例 ${vectorCase.case} 未产生任何错误`);
      }
      if (!expected.some((error) => vectorCase.expect.test(error.message))) {
        throw new Error(
          `反例 ${vectorCase.case} 没有命中 ${vectorCase.expect}:\n${JSON.stringify(expected, null, 2)}`
        );
      }
      vectors.push({ case: vectorCase.case, invariant: definition.id, input, expected });
    }
    coverage.invariants.push({
      id: definition.id,
      description: definition.description,
      valid: [...definition.valid],
      invalid: definition.cases.map((vectorCase) => vectorCase.case)
    });
  }
  return { vectors, coverage };
}

function conformanceInput(
  fixtures: ReadonlyMap<string, unknown>,
  base: string,
  mutate: (document: unknown) => void
): unknown {
  // 唯一一个没有合法基底的反例：连 schemaVersion 都没有的裸文档。
  if (base === '__missing-schema-version__') {
    return { id: 'missing-schema-version', dataSources: {}, sections: [] };
  }
  const fixture = fixtures.get(base);
  if (fixture === undefined) {
    throw new Error(`反例引用了不存在的合法样例:${base}`);
  }
  const input = structuredClone(fixture);
  mutate(input);
  return input;
}

async function buildAuthoringOutputs(): Promise<OutputMap> {
  const outputs: OutputMap = new Map();
  const authoredSchema = await readFile(authoredPageBuildSpec, 'utf8');
  const authoredPublishRequest = await readFile(path.join(authoringContractRoot, 'authored/publish-request.schema.json'), 'utf8');
  const authoredLifecycleRequest = await readFile(path.join(authoringContractRoot, 'authored/lifecycle-request.schema.json'), 'utf8');
  const authoredEditRequest = await readFile(path.join(authoringContractRoot, 'authored/page-edit-request.schema.json'), 'utf8');
  const authoredArtifactSchema = await readFile(authoredPageBuildArtifact, 'utf8');
  const authoredRelayArtifactEnvelopeSchema = await readFile(
    authoredRelayPageArtifactEnvelope,
    'utf8'
  );
  const authoredBusinessTermSchema = await readFile(authoredBusinessTermResolution, 'utf8');
  const authoredModelDecisionSchema = await readFile(authoredAgentModelDecision, 'utf8');
  const authoredStepEventSchema = await readFile(authoredAgentStepEvent, 'utf8');
  const authoredConformanceSchema = await readFile(authoredAgentConformance, 'utf8');
  const analysisIntents = await readFile(path.join(authoringContractRoot, 'authored/analysis-intents.json'), 'utf8');
  // 历史预期仍冻结并核验摘要；当前契约只派生版本/布局升级，
  // 不从 Python 或浏览器构造器的输出反向更新业务预期。
  const buildPageVector = JSON.parse(await legacyContract('build-page-conformance.json'));
  const normalizedBuildPage = normalizePageDocument({ ...buildPageVector.expected.document, schemaVersion: versionPolicy.current });
  if (!normalizedBuildPage.ok) throw new Error(`历史页面期望无法升级: ${JSON.stringify(normalizedBuildPage.errors)}`);
  buildPageVector.expected.document = { ...normalizedBuildPage.document, schemaVersion: versionPolicy.current };
  const buildPageConformance = json(buildPageVector);
  const agentConformance = await legacyContract('agent-conformance.json');
  outputs.set('exported/analysis-intents.json', analysisIntents);
  outputs.set('exported/agent-conformance.json', agentConformance);
  outputs.set('exported/build-page-conformance.json', buildPageConformance);
  outputs.set(
    'manifest.json',
    json({
      authoringContractVersion,
      files: [
        ...await Promise.all(['platform-v2-protocol.md', 'publication-contract.ts', 'publication-conformance.json', 'authoring-turn.schema.json', 'authoring-turn.conformance.json', 'authoring-turn-contract.ts', 'authoring-turn-protocol.md', 'authoring-turn.bytes.json', 'authoring-candidate.schema.json', 'authoring-candidate-protocol.md', 'authoring-candidate.conformance.json', 'authoring-recovery-protocol.md', 'authoring-ui-recovery-protocol.md', 'source-description.schema.json', 'add-data-component.schema.json', 'authoring-data-mapping-protocol.md', 'source-format.conformance.json', 'section-patterns.json', 'page-structure-plan.schema.json', 'structure-revision.schema.json'].map(async name => ({file: `authored/${name}`, sha256: sha256(await readFile(path.join(authoringContractRoot, 'authored', name), 'utf8'))}))),
        { file: 'authored/analysis-intents.json', sha256: sha256(analysisIntents) },
        { file: 'authored/page-edit-request.schema.json', sha256: sha256(authoredEditRequest) },
        { file: 'authored/lifecycle-request.schema.json', sha256: sha256(authoredLifecycleRequest) },
        { file: 'authored/publish-request.schema.json', sha256: sha256(authoredPublishRequest) },
        {
          file: 'authored/agent-conformance.schema.json',
          sha256: sha256(authoredConformanceSchema)
        },
        {
          file: 'authored/agent-model-decision.schema.json',
          sha256: sha256(authoredModelDecisionSchema)
        },
        {
          file: 'authored/agent-step-event.schema.json',
          sha256: sha256(authoredStepEventSchema)
        },
        {
          file: 'authored/business-term-resolution.schema.json',
          sha256: sha256(authoredBusinessTermSchema)
        },
        {
          file: 'authored/page-build-artifact.schema.json',
          sha256: sha256(authoredArtifactSchema)
        },
        {
          file: 'authored/relay-page-artifact-envelope.schema.json',
          sha256: sha256(authoredRelayArtifactEnvelopeSchema)
        },
        {
          file: 'authored/page-build-spec.schema.json',
          sha256: sha256(authoredSchema)
        },
        {
          file: 'exported/analysis-intents.json',
          sha256: sha256(analysisIntents)
        },
        {
          file: 'exported/agent-conformance.json',
          sha256: sha256(agentConformance)
        },
        {
          file: 'exported/build-page-conformance.json',
          sha256: sha256(buildPageConformance)
        }
      ]
    })
  );
  return outputs;
}

function buildContractLock(productOutputs: OutputMap, authoringOutputs: OutputMap): string {
  const productManifest = requiredOutput(productOutputs, 'manifest.json');
  const authoringManifest = requiredOutput(authoringOutputs, 'manifest.json');
  return json({
    productContractVersion,
    productManifest: 'contract-snapshot/manifest.json',
    productManifestSha256: sha256(productManifest),
    authoringContractVersion,
    authoringManifest: 'contracts/manifest.json',
    authoringManifestSha256: sha256(authoringManifest),
    pageSchemaVersion: versionPolicy.current
  });
}

/** 历史迁移期望固定到原始提交；生成命令不得覆盖来源或摘要。 */
async function legacyContract(file: string): Promise<string> {
  const provenance = JSON.parse(await readFile(path.join(legacyContractRoot, 'provenance.json'), 'utf8')) as {
    sourceCommit: string;
    files: Array<{ file: string; sha256: string }>;
  };
  const expected = provenance.files.find((entry) => entry.file === file);
  const content = await readFile(path.join(legacyContractRoot, file), 'utf8');
  if (!expected || sha256(content) !== expected.sha256) {
    throw new Error(`Frozen legacy vector changed: ${file} (source ${provenance.sourceCommit}); review the migration expectation explicitly`);
  }
  return content;
}

async function buildInterfaceOutputs(): Promise<OutputMap> {
  const outputs: OutputMap = new Map();
  outputs.set(interfaceCopyRelative, await legacyContract('rest-services-page-assets.yaml'));
  return outputs;
}

async function writeOutputs(
  productOutputs: OutputMap,
  authoringOutputs: OutputMap,
  interfaceOutputs: OutputMap
): Promise<void> {
  const skills = await buildSkillProjections(productOutputs);
  await writeTree(productContractRoot, productOutputs);
  for (const [relativePath, content] of interfaceOutputs) {
    const target = path.join(productContractRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  await writeTree(snapshotRoot, productOutputs);
  for (const skill of skills) await writeTree(path.join(bundleRoot, skill.directory, 'references/page-metadata'), skill.outputs);
  await rm(path.join(authoringContractRoot, 'exported'), { recursive: true, force: true });
  for (const [relativePath, content] of authoringOutputs) {
    const target = path.join(authoringContractRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  await writeFile(
    path.join(bundleRoot, 'contract-lock.json'),
    buildContractLock(productOutputs, authoringOutputs),
    'utf8'
  );
  await writeFile(path.join(bundleRoot, 'bundle.lock.json'), await buildBundleLock(), 'utf8');
}

function referenceProjection(outputs: OutputMap): OutputMap {
  return new Map([...outputs].filter(([file]) => file.startsWith('page/reference/')).map(([file, content]) => [file.slice('page/reference/'.length), content]));
}

/** Registry is a distribution index, not a Relay router or tool allowlist. */
async function buildSkillProjections(productOutputs: OutputMap): Promise<Array<{directory: string; outputs: OutputMap}>> {
  const bundle = JSON.parse(await readFile(path.join(bundleRoot, 'bundle.json'), 'utf8'));
  const legacy = 'skill/metriccanvas-page-builder/SKILL.md';
  if (bundle.skill?.entrypoint !== legacy) throw new Error('Legacy Skill entrypoint changed');
  const entries = 'skills' in bundle ? bundle.skills : [{id:'metriccanvas-page-builder',entrypoint:legacy}];
  if (!Array.isArray(entries) || !entries.length) throw new Error('Invalid Skill registry');
  const actualBundleRoot = await realpath(bundleRoot);
  const seen = new Set<string>();
  const projections: Array<{directory: string; outputs: OutputMap}> = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) ||
        entry.entrypoint !== `skill/${entry.id}/SKILL.md` || seen.has(entry.id)) throw new Error('Invalid or duplicate Skill entry');
    if (entry.id === 'metriccanvas-platform-authoring' &&
        (entry.mcpServer !== 'metriccanvas-platform-content' ||
         bundle.toolServices?.['metriccanvas-platform-content']?.module !== 'metriccanvas_authoring.platform_server' ||
         bundle.toolServices?.['metriccanvas-platform-content']?.platformProtocolVersion !== '2.0')) {
      throw new Error('Unified Platform deployment requires gated content service');
    }
    seen.add(entry.id);
    const directory = path.posix.dirname(entry.entrypoint);
    if (await realpath(path.join(bundleRoot,directory)) !== path.join(actualBundleRoot,directory) ||
        await realpath(path.join(bundleRoot,entry.entrypoint)) !== path.join(actualBundleRoot,entry.entrypoint)) throw new Error('Skill entrypoint must be an independent file');
    // The registry declares the only generated subtree. Everything else belongs
    // to the Skill author and must survive regeneration, including references.
    const mode = entry.referenceProjection ?? (entry.id === 'metriccanvas-page-builder' ? 'page-metadata' : 'none');
    if (!['none', 'page-metadata'].includes(mode)) throw new Error('Unknown Skill reference projection');
    if (entry.id.startsWith('metriccanvas-platform-') && entry.id !== 'metriccanvas-platform-authoring') {
      throw new Error('Retired Platform Skill entry');
    }
    if (entry.id === 'metriccanvas-platform-authoring' && mode !== 'none') throw new Error('Platform Skill must use authored references');
    const documents: OutputMap = new Map();
    for (const file of await listFiles(path.join(bundleRoot, directory))) {
      if (mode === 'page-metadata' && file.startsWith('references/page-metadata/')) continue;
      documents.set(file, await readFile(path.join(bundleRoot, directory, file), 'utf8'));
    }
    const outputs = mode === 'page-metadata' ? referenceProjection(productOutputs) : new Map<string, string>();
    for (const [file, content] of outputs) documents.set(`references/page-metadata/${file}`, content);
    validateReferenceLinks(documents);
    if (mode === 'page-metadata') projections.push({directory, outputs});
  }
  if (!seen.has('metriccanvas-page-builder')) throw new Error('Skill registry missing legacy entrypoint');
  return projections;
}

async function writeTree(root: string, outputs: OutputMap): Promise<void> {
  await rm(root, { recursive: true, force: true });
  for (const [relativePath, content] of outputs) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}

async function buildBundleLock(): Promise<string> {
  const bundle = JSON.parse(await readFile(path.join(bundleRoot, 'bundle.json'), 'utf8')) as {
    bundleVersion: string;
  };
  // 本机工具产物不是 Bundle 的一部分:虚拟环境、缓存目录只在开发机存在,进锁文件会让 CI 判定漂移。
  const localOnlyDirectories = new Set(['.venv', 'venv', '.pytest_cache', '.mypy_cache', '.ruff_cache']);
  const artifactPaths = (await listFiles(bundleRoot)).filter(
    (file) =>
      file !== 'bundle.lock.json' &&
      !file.startsWith('test-harness/model-evals/local-runs/') &&
      !file.includes('__pycache__') &&
      !file.endsWith('.pyc') &&
      !file.split('/').some((segment) => localOnlyDirectories.has(segment))
  );
  const artifacts = await Promise.all(
    artifactPaths.map(async (file) => {
      const content = await readFile(path.join(bundleRoot, file));
      return { file, sha256: sha256(content) };
    })
  );
  return json({
    bundleVersion: bundle.bundleVersion,
    pageSchemaVersion: versionPolicy.current,
    artifacts: artifacts.sort((left, right) => left.file.localeCompare(right.file))
  });
}

async function assertCurrent(
  productOutputs: OutputMap,
  authoringOutputs: OutputMap,
  interfaceOutputs: OutputMap
): Promise<void> {
  const drift: string[] = [];
  for (const file of [
    'contracts/metriccanvas/manifest.json',
    'metriccanvas-authoring/contract-snapshot/manifest.json',
    'metriccanvas-authoring/contract-lock.json'
  ]) {
    const actual = JSON.parse(await readFile(path.join(repoRoot, file), 'utf8')) as { productContractVersion?: string };
    if (actual.productContractVersion !== productContractVersion) {
      drift.push(`${file}: productContractVersion=${actual.productContractVersion ?? '<missing>'}; @metriccanvas/page version=${productContractVersion}`);
    }
  }
  await collectTreeDrift(
    productContractRoot,
    new Map([...productOutputs, ...interfaceOutputs]),
    'contracts/metriccanvas',
    drift
  );
  await collectTreeDrift(snapshotRoot, productOutputs, 'contract-snapshot', drift);
  for (const skill of await buildSkillProjections(productOutputs)) {
    await collectTreeDrift(path.join(bundleRoot,skill.directory,'references/page-metadata'),skill.outputs,`${skill.directory}/references/page-metadata`,drift);
  }
  const generatedAuthoringOutputs = new Map(
    [...authoringOutputs].filter(
      ([file]) => file === 'manifest.json' || file.startsWith('exported/')
    )
  );
  for (const [relativePath, expected] of generatedAuthoringOutputs) {
    await collectFileDrift(
      path.join(authoringContractRoot, relativePath),
      expected,
      `metriccanvas-authoring/contracts/${relativePath}`,
      drift
    );
  }
  const actualExported = await listFilesIfPresent(path.join(authoringContractRoot, 'exported'));
  const expectedExported = new Set(
    [...generatedAuthoringOutputs.keys()]
      .filter((file) => file.startsWith('exported/'))
      .map((file) => file.slice('exported/'.length))
  );
  for (const file of actualExported) {
    if (!expectedExported.has(file)) {
      drift.push(`metriccanvas-authoring/contracts/exported/${file}: unexpected`);
    }
  }

  const expectedContractLock = buildContractLock(productOutputs, authoringOutputs);
  await collectFileDrift(
    path.join(bundleRoot, 'contract-lock.json'),
    expectedContractLock,
    'metriccanvas-authoring/contract-lock.json',
    drift
  );

  const expectedBundleLock = await buildBundleLock();
  await collectFileDrift(
    path.join(bundleRoot, 'bundle.lock.json'),
    expectedBundleLock,
    'metriccanvas-authoring/bundle.lock.json',
    drift
  );

  if (drift.length > 0) {
    throw new Error(`authoring contract export drifted:\n${drift.join('\n')}`);
  }
}

async function collectTreeDrift(
  root: string,
  outputs: OutputMap,
  label: string,
  drift: string[]
): Promise<void> {
  for (const [relativePath, expected] of outputs) {
    await collectFileDrift(
      path.join(root, relativePath),
      expected,
      `${label}/${relativePath}`,
      drift
    );
  }
  const expectedFiles = new Set(outputs.keys());
  for (const file of await listFilesIfPresent(root)) {
    if (!expectedFiles.has(file)) drift.push(`${label}/${file}: unexpected`);
  }
}

async function collectFileDrift(
  target: string,
  expected: string,
  label: string,
  drift: string[]
): Promise<void> {
  let actual: string;
  try {
    actual = await readFile(target, 'utf8');
  } catch {
    drift.push(`${label}: missing`);
    return;
  }
  if (actual !== expected) drift.push(`${label}: stale`);
}

function requiredOutput(outputs: OutputMap, file: string): string {
  const content = outputs.get(file);
  if (content === undefined) throw new Error(`${file} was not generated`);
  return content;
}

async function listFilesIfPresent(root: string): Promise<string[]> {
  try {
    return await listFiles(root);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw cause;
  }
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(path.join(root, entry.name), relative)));
    } else result.push(relative);
  }
  return result.sort();
}

const productOutputs = await buildProductOutputs();
const authoringOutputs = await buildAuthoringOutputs();
const interfaceOutputs = await buildInterfaceOutputs();
if (checkOnly) await assertCurrent(productOutputs, authoringOutputs, interfaceOutputs);
else await writeOutputs(productOutputs, authoringOutputs, interfaceOutputs);

console.log(
  checkOnly
    ? `authoring contract export current (${productOutputs.size} product, ` +
        `${authoringOutputs.size} authoring, ${interfaceOutputs.size} interface files)`
    : `exported authoring contracts (${productOutputs.size} product, ` +
        `${authoringOutputs.size} authoring, ${interfaceOutputs.size} interface files)`
);
