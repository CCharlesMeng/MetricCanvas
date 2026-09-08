import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  componentCatalog,
  ERROR_TYPES,
  pageSchema,
  QUERY_ERROR_CODES,
  validate,
  versionPolicy
} from '../../packages/page/src/internal.ts';
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
const authoringContractVersion = '0.2.0';
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
  const authoredRelayArtifactEnvelopeSchema = await readFile(
    authoredRelayPageArtifactEnvelope,
    'utf8'
  );
  const authoredBusinessTermSchema = await readFile(authoredBusinessTermResolution, 'utf8');
  const authoredModelDecisionSchema = await readFile(authoredAgentModelDecision, 'utf8');
  const authoredStepEventSchema = await readFile(authoredAgentStepEvent, 'utf8');
  const authoredConformanceSchema = await readFile(authoredAgentConformance, 'utf8');
  const analysisIntents = await readFile(path.join(authoringContractRoot, 'authored/analysis-intents.json'), 'utf8');
  const buildPageConformance = await legacyContract('build-page-conformance.json');
  const agentConformance = await legacyContract('agent-conformance.json');
  outputs.set('exported/analysis-intents.json', analysisIntents);
  outputs.set('exported/agent-conformance.json', agentConformance);
  outputs.set('exported/build-page-conformance.json', buildPageConformance);
  outputs.set(
    'manifest.json',
    json({
      authoringContractVersion,
      files: [
        { file: 'authored/analysis-intents.json', sha256: sha256(analysisIntents) },
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
    productContractVersion: '0.1.0',
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
  await writeTree(productContractRoot, productOutputs);
  for (const [relativePath, content] of interfaceOutputs) {
    const target = path.join(productContractRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  await writeTree(snapshotRoot, productOutputs);
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
