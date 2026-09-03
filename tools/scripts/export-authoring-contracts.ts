import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  componentCatalog,
  ERROR_TYPES,
  pageSchema,
  QUERY_ERROR_CODES,
  validate,
  versionPolicy,
  type DataRow
} from '../../packages/page/src/index.ts';
import {
  parseDataContextSnapshot,
  semanticSurfaceOf
} from '../../packages/mcp/src/data-context.ts';
import {
  assembleTransientPage,
  type ExecutedDataRequestUnit
} from '../../packages/mcp/src/authoring/assemble-page.ts';
import type { ComponentCandidate } from '../../packages/mcp/src/authoring/auto-visualize.ts';
import { validateUnitManifest } from '../../packages/mcp/src/authoring/unit-verification.ts';
import {
  ANALYSIS_INTENTS,
  type AnalysisIntent
} from '../../apps/platform/src/lib/server/session/step-event.ts';
import type { AskDataRequestUnitState } from '../../apps/platform/src/lib/server/ask/ports.ts';
import {
  canonicalizeUnit,
  deriveExecutableUnit
} from '../../apps/platform/src/lib/server/ask/unit-derivation.ts';
import {
  createSnapshotAskRetrieval,
  disambiguateCandidates
} from '../../apps/platform/src/lib/server/ask/retrieval.ts';
import { createModelBackedAskModel } from '../../apps/platform/src/lib/server/ask/model-port.ts';
import type { ModelProvider } from '../../apps/platform/src/lib/server/agent/types.ts';
import { ANALYSIS_INTENT_TO_VISUALIZE } from '../../apps/platform/src/lib/server/ask/visualization-intent.ts';
import { invariants, type InvariantDefinition } from './page-conformance-vectors.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
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
const authoringContractVersion = '0.2.0';
const snapshotRoot = path.join(bundleRoot, 'contract-snapshot');
// Java 页面资产 module 组的只读快照（ADR-0062）：同一份产品契约，构建时嵌入 JAR。
const javaRoot = path.join(repoRoot, 'metriccanvas-page-assets');
const javaSnapshotRoot = path.join(javaRoot, 'contract-snapshot');
// 反向单向导出：Java 是 Interface 作者（Swagger 2.0，公司 codegen 输入），仓根只放副本供 Python /
// TypeScript consumer 校验各自 client；不进产品 manifest（那是 TypeScript 导出的产品契约）。
const interfaceAuthorFile = path.join(
  javaRoot,
  'page-assets-model/src/main/resources/rest-services-page-assets.yaml'
);
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
  outputs.set('page/component-catalog.json', json(componentCatalog));
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

  const conformance = buildPageConformance(fixtures, invariants);
  for (const vector of conformance.vectors) {
    outputs.set(`page/conformance/invalid/${vector.case}.json`, json(vector));
  }
  outputs.set('page/conformance/coverage.json', json(conformance.coverage));

  outputs.set(
    'manifest.json',
    json({
      productContractVersion: '0.1.0',
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
  const authoredArtifactSchema = await readFile(authoredPageBuildArtifact, 'utf8');
  const authoredBusinessTermSchema = await readFile(authoredBusinessTermResolution, 'utf8');
  const authoredModelDecisionSchema = await readFile(authoredAgentModelDecision, 'utf8');
  const authoredStepEventSchema = await readFile(authoredAgentStepEvent, 'utf8');
  const authoredConformanceSchema = await readFile(authoredAgentConformance, 'utf8');
  const analysisIntents = json({
    intents: ANALYSIS_INTENTS,
    visualizationIntentByAnalysisIntent: ANALYSIS_INTENT_TO_VISUALIZE
  });
  const buildPageConformance = json(await buildPageConformanceVector());
  const agentConformance = json(await buildAgentConformanceVector());
  outputs.set('exported/analysis-intents.json', analysisIntents);
  outputs.set('exported/agent-conformance.json', agentConformance);
  outputs.set('exported/build-page-conformance.json', buildPageConformance);
  outputs.set(
    'manifest.json',
    json({
      authoringContractVersion,
      files: [
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

async function buildAgentConformanceVector(): Promise<unknown> {
  const dataContextRelative = 'docs/examples/schema-metadata.example.json';
  const rawSnapshot = JSON.parse(
    await readFile(path.join(repoRoot, dataContextRelative), 'utf8')
  ) as unknown;
  const parsed = parseDataContextSnapshot(rawSnapshot);
  if (!parsed.ok) {
    throw new Error(`agent conformance Data Context is invalid: ${JSON.stringify(parsed.errors)}`);
  }
  const retrieval = createSnapshotAskRetrieval({
    current: async () => parsed.snapshot
  });
  const definitions = [
    {
      case: 'canonical-name-hit',
      question: '上个月的 Tokens消耗量是多少?',
      businessDomains: ['运营分析']
    },
    {
      case: 'alias-hit',
      question: '上个月的调用次数是多少?',
      businessDomains: ['运营分析']
    },
    {
      case: 'longest-name-hit',
      question: '各模型的新增客户数是多少?',
      businessDomains: ['运营分析', '客户经营']
    },
    {
      case: 'ambiguous-canonical-name',
      question: '6 月份的客户数是多少?',
      businessDomains: ['运营分析', '客户经营']
    },
    {
      case: 'longest-alias-hit',
      question: '上个月各区域的在用客户数是多少?',
      businessDomains: ['运营分析', '客户经营']
    }
  ];
  const cases = await Promise.all(
    definitions.map(async (definition) => {
      const input = {
        question: definition.question,
        businessDomains: definition.businessDomains,
        limit: 5
      };
      const candidates = await retrieval.searchMetricCandidates(input);
      const disambiguated = disambiguateCandidates(candidates);
      return {
        case: definition.case,
        kind: 'business_term_resolution',
        input,
        expected: {
          candidates,
          selected: disambiguated.selected,
          ambiguousTerms: disambiguated.ambiguousTerms
        }
      };
    })
  );
  const modelDecisionCases = await buildModelDecisionConformanceCases(
    semanticSurfaceOf(parsed.snapshot)
  );
  return {
    formatVersion: '1.0',
    source: {
      implementation: 'typescript',
      module: 'ask/retrieval+ask/model-port',
      dataContext: dataContextRelative
    },
    dataContext: rawSnapshot,
    cases: [...cases, ...modelDecisionCases]
  };
}

async function buildModelDecisionConformanceCases(
  surfaces: ReturnType<typeof semanticSurfaceOf>
): Promise<unknown[]> {
  const unit: AskDataRequestUnitState = {
    businessDomain: '运营分析',
    metrics: [{ kind: 'metric', name: 'Tokens请求量' }],
    groupBy: ['区域'],
    filters: [],
    time: {
      granularity: 'month',
      start: '2026-08',
      end: '2026-08',
      providedBy: 'user'
    },
    title: '按区域查看 Tokens 请求量'
  };
  const invoke = async (
    caseName: string,
    stage: 'route_business_domains' | 'submit_data_request_units' | 'submit_analysis_intent',
    currentToolName: string,
    rawOutput: Record<string, unknown>,
    hasPreviousUnits: boolean,
    run: (model: ReturnType<typeof createModelBackedAskModel>) => Promise<unknown>
  ): Promise<unknown> => {
    const provider: ModelProvider = {
      async complete(request) {
        if (!request.tools.some((tool) => tool.name === currentToolName)) {
          throw new Error(`${caseName} did not advertise ${currentToolName}`);
        }
        return {
          content: '',
          toolCalls: [
            {
              id: `conformance-${caseName}`,
              name: currentToolName,
              input: rawOutput
            }
          ]
        };
      }
    };
    const decision = await run(createModelBackedAskModel(provider));
    return {
      case: caseName,
      kind: 'model_decision',
      input: {
        stage,
        rawOutput,
        ...(stage === 'submit_data_request_units' ? { hasPreviousUnits } : {})
      },
      expected: { decisionType: stage, ...(decision as object) }
    };
  };

  const domains = surfaces.map((surface) => ({
    name: surface.businessDomain,
    description: surface.description
  }));
  const targetSurface = surfaces.filter((surface) => surface.businessDomain === '运营分析');
  const formInput = {
    question: '上个月按区域看 Tokens 请求量',
    surfaces: targetSurface,
    candidates: [],
    selectedMetrics: [{ businessDomain: '运营分析', metricName: 'Tokens请求量' }],
    previousUnits: [],
    targetDataSourceId: null
  };
  return Promise.all([
    invoke(
      'model-route-one-domain',
      'route_business_domains',
      'route_business_domains',
      { businessDomains: ['运营分析'] },
      false,
      (model) => model.routeDomains({ question: 'Tokens 请求量', domains })
    ),
    invoke(
      'model-form-one-unit',
      'submit_data_request_units',
      'submit_data_request_unit',
      { outcome: 'unit', unit },
      false,
      (model) => model.formUnit(formInput)
    ),
    invoke(
      'model-add-unit-operation',
      'submit_data_request_units',
      'submit_data_request_unit',
      { outcome: 'operations', operations: [{ op: 'add', unit }] },
      false,
      (model) => model.formUnit(formInput)
    ),
    invoke(
      'model-modify-unit-operation',
      'submit_data_request_units',
      'submit_data_request_unit',
      {
        outcome: 'operations',
        operations: [
          { op: 'modify', dataSourceId: 'unit-1', patch: { groupBy: ['统计周期'] } }
        ]
      },
      true,
      (model) =>
        model.formUnit({
          ...formInput,
          previousUnits: [{ dataSourceId: 'unit-1', unit }],
          targetDataSourceId: 'unit-1'
        })
    ),
    invoke(
      'model-analysis-intent',
      'submit_analysis_intent',
      'submit_analysis_intent',
      { intent: 'trend' },
      false,
      (model) => model.decideIntent({ question: unit.title ?? '', unit, previousIntent: null })
    )
  ]);
}

type ConformanceUnit = AskDataRequestUnitState & {
  intent: AnalysisIntent;
  pinnedComponent?: ComponentCandidate['type'];
};

interface ConformanceSpec {
  question: string;
  description?: string;
  units: ConformanceUnit[];
}

interface ConformanceExecution {
  rows: DataRow[];
  totalCount?: number;
  capturedAt: string;
}

async function buildPageConformanceVector(): Promise<unknown> {
  const fixtureRoot = path.join(bundleRoot, 'test-harness/fixtures');
  const spec = JSON.parse(
    await readFile(path.join(fixtureRoot, 'page-build-spec.json'), 'utf8')
  ) as ConformanceSpec;
  const dataContext = JSON.parse(
    await readFile(path.join(fixtureRoot, 'data-context.json'), 'utf8')
  ) as unknown;
  const execution = JSON.parse(
    await readFile(path.join(fixtureRoot, 'page-build-execution.json'), 'utf8')
  ) as ConformanceExecution;
  const parsed = parseDataContextSnapshot(dataContext);
  if (!parsed.ok) {
    throw new Error(`conformance Data Context is invalid: ${JSON.stringify(parsed.errors)}`);
  }
  const surfaces = semanticSurfaceOf(parsed.snapshot);
  const effectiveQueries: unknown[] = [];
  const units: ExecutedDataRequestUnit[] = spec.units.map((rawUnit, index) => {
    const unit = canonicalizeUnit(rawUnit, surfaces);
    const derived = deriveExecutableUnit(unit, surfaces);
    effectiveQueries.push({
      language: 'dqe',
      body: derived.body,
      fieldMappings: derived.fields,
      filterValues: []
    });
    return {
      dataSourceId: `unit-${index + 1}`,
      ...(unit.title === undefined ? {} : { title: unit.title }),
      fields: derived.fields,
      query: { language: 'dqe', body: derived.body },
      initial: {
        capturedAt: execution.capturedAt,
        rows: execution.rows,
        ...(execution.totalCount === undefined
          ? {}
          : { totalCount: execution.totalCount })
      },
      intent: ANALYSIS_INTENT_TO_VISUALIZE[rawUnit.intent],
      ...(rawUnit.pinnedComponent === undefined
        ? {}
        : { pinnedComponent: rawUnit.pinnedComponent }),
      scope: {
        businessDomain: unit.businessDomain,
        ...derived.scope
      }
    };
  });
  const command = {
    pageId: 'tokens-by-region',
    idempotencyKey: 'build:tokens-by-region:conformance',
    pageIdConfirmed: true
  };
  const assembled = assembleTransientPage({
    pageId: command.pageId,
    ...(spec.description === undefined ? {} : { description: spec.description }),
    units
  });
  if (!assembled.ok) {
    throw new Error(`conformance page assembly failed: ${JSON.stringify(assembled.issues)}`);
  }
  const errorCases = buildManifestErrorCases(spec, dataContext, parsed.snapshot, surfaces);
  const pageValidationErrorCases = buildPageValidationErrorCases(
    spec,
    execution,
    units,
    command
  );
  return {
    case: 'single-bar-page',
    input: {
      command,
      spec,
      dataContext,
      executions: [execution]
    },
    expected: {
      effectiveQueries,
      document: assembled.document
    },
    errorCases,
    pageValidationErrorCases
  };
}

function buildPageValidationErrorCases(
  spec: ConformanceSpec,
  validExecution: ConformanceExecution,
  validUnits: ExecutedDataRequestUnit[],
  command: { pageId: string }
): unknown[] {
  const definitions: Array<{
    case: string;
    mutate(execution: ConformanceExecution): void;
  }> = [
    {
      case: 'result-row-missing-field',
      mutate: (execution) => {
        delete execution.rows[0]!.Tokens请求量;
      }
    },
    {
      case: 'result-row-null-not-allowed',
      mutate: (execution) => {
        execution.rows[0]!.Tokens请求量 = null;
      }
    },
    {
      case: 'result-row-type-mismatch',
      mutate: (execution) => {
        execution.rows[0]!.Tokens请求量 = '18';
      }
    }
  ];
  return definitions.map((definition) => {
    const execution = structuredClone(validExecution);
    definition.mutate(execution);
    const units = structuredClone(validUnits);
    units[0]!.initial = {
      capturedAt: execution.capturedAt,
      rows: execution.rows,
      ...(execution.totalCount === undefined
        ? {}
        : { totalCount: execution.totalCount })
    };
    const assembled = assembleTransientPage({
      pageId: command.pageId,
      ...(spec.description === undefined ? {} : { description: spec.description }),
      units
    });
    if (assembled.ok) {
      throw new Error(`expected ${definition.case} page validation to fail`);
    }
    const validationIssue = assembled.issues.find(
      (issue) => issue.code === 'PAGE_VALIDATION_FAILED'
    );
    if (validationIssue?.errors === undefined || validationIssue.errors.length === 0) {
      throw new Error(
        `expected ${definition.case} page validation errors, got ${JSON.stringify(assembled.issues)}`
      );
    }
    return {
      case: definition.case,
      execution,
      expectedIssues: validationIssue.errors
    };
  });
}

function buildManifestErrorCases(
  validSpec: ConformanceSpec,
  dataContext: unknown,
  snapshot: Parameters<typeof validateUnitManifest>[0],
  surfaces: ReturnType<typeof semanticSurfaceOf>
): unknown[] {
  const definitions: Array<{
    case: string;
    path: string;
    mutate(spec: ConformanceSpec): void;
  }> = [
    {
      case: 'unknown-metric',
      path: '/units/0/metrics/0/name',
      mutate: (spec) => {
        const metric = spec.units[0]!.metrics[0];
        if (metric?.kind === 'metric') metric.name = '不存在的指标';
      }
    },
    {
      case: 'unknown-group-by-dimension',
      path: '/units/0/groupBy/0',
      mutate: (spec) => {
        spec.units[0]!.groupBy[0] = '不存在的维度';
      }
    },
    {
      case: 'unknown-filter-dimension',
      path: '/units/0/filters/0/dimension',
      mutate: (spec) => {
        spec.units[0]!.filters = [{ dimension: '不存在的筛选维度', values: ['华东'] }];
      }
    },
    {
      case: 'unknown-filter-value',
      path: '/units/0/filters/0/values/0',
      mutate: (spec) => {
        spec.units[0]!.filters = [{ dimension: '区域', values: ['东北'] }];
      }
    },
    {
      case: 'unknown-time-granularity',
      path: '/units/0/time/granularity',
      mutate: (spec) => {
        const time = spec.units[0]!.time;
        if (time !== null) time.granularity = 'quarter';
      }
    }
  ];
  return definitions.map((definition) => {
    const spec = structuredClone(validSpec);
    definition.mutate(spec);
    const unit = canonicalizeUnit(spec.units[0]!, surfaces);
    const derived = deriveExecutableUnit(unit, surfaces);
    const manifest = validateUnitManifest(snapshot, {
      dataSourceId: 'unit-1',
      fields: derived.fields,
      query: { language: 'dqe', body: derived.body },
      question: spec.question
    });
    if (manifest.violations.length !== 1) {
      throw new Error(
        `expected one ${definition.case} violation, got ${JSON.stringify(manifest.violations)}`
      );
    }
    return {
      case: definition.case,
      input: { spec, dataContext },
      expectedIssues: manifest.violations.map((violation) => ({
        code: violation.code,
        path: definition.path
      }))
    };
  });
}

function buildContractLock(productOutputs: OutputMap, authoringOutputs: OutputMap): string {
  const productManifest = requiredOutput(productOutputs, 'manifest.json');
  const authoringManifest = requiredOutput(authoringOutputs, 'manifest.json');
  return json({
    productContractVersion: '0.1.0',
    productManifest: 'contract-snapshot/manifest.json',
    productManifestSha256: sha256(productManifest),
    authoringContractVersion,
    authoringManifest: 'contracts/manifest.json',
    authoringManifestSha256: sha256(authoringManifest),
    pageSchemaVersion: versionPolicy.current
  });
}

/** Java module 组只消费产品契约；JAR 内的 ContractSnapshot 以此核对嵌入快照的摘要。 */
function buildJavaContractLock(productOutputs: OutputMap): string {
  const productManifest = requiredOutput(productOutputs, 'manifest.json');
  return json({
    productContractVersion: '0.1.0',
    productManifest: 'contract-snapshot/manifest.json',
    productManifestSha256: sha256(productManifest),
    pageSchemaVersion: versionPolicy.current
  });
}

async function buildInterfaceOutputs(): Promise<OutputMap> {
  const outputs: OutputMap = new Map();
  outputs.set(interfaceCopyRelative, await readFile(interfaceAuthorFile, 'utf8'));
  return outputs;
}

async function writeOutputs(
  productOutputs: OutputMap,
  authoringOutputs: OutputMap,
  interfaceOutputs: OutputMap
): Promise<void> {
  await writeTree(productContractRoot, productOutputs);
  for (const [relativePath, content] of interfaceOutputs) {
    const target = path.join(productContractRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  await writeTree(snapshotRoot, productOutputs);
  await writeTree(javaSnapshotRoot, productOutputs);
  await writeFile(
    path.join(javaRoot, 'contract-lock.json'),
    buildJavaContractLock(productOutputs),
    'utf8'
  );

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
  await collectTreeDrift(
    productContractRoot,
    new Map([...productOutputs, ...interfaceOutputs]),
    'contracts/metriccanvas',
    drift
  );
  await collectTreeDrift(snapshotRoot, productOutputs, 'contract-snapshot', drift);
  await collectTreeDrift(
    javaSnapshotRoot,
    productOutputs,
    'metriccanvas-page-assets/contract-snapshot',
    drift
  );
  await collectFileDrift(
    path.join(javaRoot, 'contract-lock.json'),
    buildJavaContractLock(productOutputs),
    'metriccanvas-page-assets/contract-lock.json',
    drift
  );

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
