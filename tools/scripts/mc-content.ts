import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { versionPolicy, supportedVersions, pageCapabilities } from '../../packages/page/src/version';
import { localValidatorOutputs } from './local-authoring-projection';
import { schemaCatalog } from './mc-content-schema-catalog';
import { addMcKnowledge, knowledgeDenominator } from './mc-content-knowledge';
import { checkMcCoverage } from './mc-content-coverage';

type Outputs = Map<string, string>;
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export async function copyTree(root: string, prefix = ''): Promise<Outputs> {
  const outputs: Outputs = new Map();
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue;
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) for (const pair of await copyTree(root, file)) outputs.set(...pair);
    else outputs.set(file, await readFile(path.join(root, file), 'utf8'));
  }
  return outputs;
}

function addAtoms(outputs: Outputs, raw: any, source: string): void {
  for (const [key, content] of Object.entries(raw.tools)) outputs.set(`tool-contracts/${key}.json`, json({ ...content as object, source,
    ...(raw.tools[key].inputSchema.properties.request ? { requestSchema: raw.tools[key].inputSchema.properties.request } : {}) }));
  const codes = new Set<string>([...raw.literalErrorCodes, ...raw.queryErrorCodes, ...raw.pageErrorTypes, ...Object.keys(raw.guidance)]);
  for (const code of codes) outputs.set(`errors/${code}.json`, json({ code,
    guidance: raw.guidance[code] ?? {message: 'Consume the structured type/code, path and message from the actual receipt; consult the product rule and source locations. No automatic repair or retry is implied.', action: null, owner: 'caller'},
    sourceLocations: raw.literalErrorSources[code] ?? [], coverage: {
      literalCallSite: raw.literalErrorCodes.includes(code), queryClosedSet: raw.queryErrorCodes.includes(code), pageErrorType: raw.pageErrorTypes.includes(code), authoredGuidance: Object.hasOwn(raw.guidance, code)
    },
    note: 'Dynamic codes and deployment errors may be returned at runtime. Consume structured issue fields; no retry or permission is granted by this reference.' }));
}

function materialize(text: string, protocolVersion: string): string {
  return text.replaceAll('{{pageSchemaVersion}}', versionPolicy.current)
    .replaceAll('{{platformProtocolVersion}}', protocolVersion);
}

/** Compatibility projections are generated from MC facts; other Skill files remain authored. */
export async function mcPlatformFacts(root: string): Promise<Outputs> {
  const registration = JSON.parse(await readFile(path.join(root, 'metriccanvas-authoring/bundle.json'), 'utf8'));
  const protocol = registration.toolServices['metriccanvas-platform-content'].platformProtocolVersion;
  const outputs: Outputs = new Map();
  for (const [source, target] of [
    ['runtime/tool-behavior.md', 'references/tools.md'],
    ['scenarios/business-report.md', 'references/scenarios/business-report.md'],
    ['scenarios/usage-report.md', 'references/scenarios/usage-report.md'],
    ['runtime/page-data-execution.md', 'references/page-data-execution.md'],
    ['runtime/tool-examples.md', 'references/examples.md'],
    ['runtime/plan-expression.md', 'references/plan-expression.md'],
    ['runtime/editing.md', 'references/editing.md'], ['runtime/parameters.md', 'references/parameters.md'],
    ['runtime/delivery.md', 'references/delivery.md'], ['runtime/numeric-format.md', 'references/numeric-format.md'],
    ['protocols/discovery-query.md', 'references/discovery-query.md'], ['runtime/error-repair.md', 'references/errors.md'],
    ['runtime/execution.md', 'references/execution.md'], ['layouts/reading.md', 'references/scenarios.md'],
    ['layouts/report.md', 'references/layouts/report.md'], ['layouts/dashboard.md', 'references/layouts/dashboard.md'],
    ['layouts/report-composition.md', 'references/layouts/report-composition.md']
  ]) {
    let text = materialize(await readFile(path.join(root, 'tools/mc-content', source), 'utf8'), protocol);
    if (source === 'layouts/report.md') text = text.replace(/\]\(reading\.md\)/g, '](../scenarios.md)');
    if (source === 'layouts/reading.md') text = text.replaceAll('](report-composition.md)', '](layouts/report-composition.md)');
    outputs.set(target, text);
  }
  return outputs;
}

async function addPageTools(root: string, outputs: Outputs): Promise<void> {
  for (const [entry, target] of [
    ['tools/scripts/mc-content-page.ts', 'scripts/inspect-page.mjs'],
    ['tools/scripts/local-authoring-upgrade.ts', 'scripts/upgrade-page.mjs'],
    ['tools/scripts/mc-content-knowledge-reader.ts', 'scripts/read-knowledge.mjs']
  ]) {
    for (const [file, text] of await localValidatorOutputs(root, entry, target)) {
      outputs.set(file === 'scripts/THIRD-PARTY-LICENSES.md' ? `${target}.LICENSES.md` : file, text);
    }
  }
}

export function indexFor(outputs: Outputs): object {
  const directories: Record<string, string> = { error: 'errors/', tool: 'tool-contracts/', layout: 'layouts/',
    protocol: 'protocols/', runtime: 'runtime/', snapshot: 'mc-closed-sets/', knowledge: 'knowledge/',
    reference: 'references/page-metadata/', example: 'examples/', component: 'components/', scenario: 'scenarios/',
    product: 'product-contracts/', authoring: 'authoring-contracts/', guide: '' };
  return Object.fromEntries(Object.entries(directories).map(([topic, prefix]) => [topic,
    Object.fromEntries([...outputs.keys()].sort().filter(file => prefix ? file.startsWith(prefix) : !file.includes('/')).map(file => [
      file.slice(prefix.length).replace(/\.(?:json|md|ts)$/, ''), file
    ]))]));
}

/** Catalog query references use the same canonical index as query_content. */
function addLayoutQueryRefs(outputs: Outputs): void {
  const index = indexFor(outputs) as Record<string, Record<string, string>>;
  const catalog = JSON.parse(outputs.get('layouts/catalog.json')!);
  for (const scene of catalog.scenes) {
    for (const variant of scene.variants ?? []) {
      if (!variant.templateFile) continue;
      const key = Object.keys(index.layout).find(key => index.layout[key] === `layouts/${variant.templateFile}`);
      if (!key) throw new Error(`Layout template is not indexed: ${variant.templateFile}`);
      variant.queryRef = {topic: 'layout', key};
    }
  }
  outputs.set('layouts/catalog.json', json(catalog));
}

export interface McBuildGraph { product: Outputs; authoring: Outputs; lock: string }

async function buildInputSources(root: string, sources: string[]): Promise<string[]> {
  const inputs = new Set(sources);
  for (const folder of ['packages/page/src', 'packages/page/fixtures', 'docs/page-metadata', 'pages',
    'tools/mc-content', 'tools/fixtures/legacy-contracts', 'metriccanvas-authoring/contracts/authored']) {
    for (const file of (await copyTree(path.join(root, folder))).keys()) inputs.add(`${folder}/${file}`);
  }
  for (const file of await readdir(path.join(root, 'tools/scripts'))) {
    if (/^(mc-|local-authoring-|page-|query-result-conformance|export-authoring-contracts)/.test(file)) inputs.add(`tools/scripts/${file}`);
  }
  for (const file of ['pnpm-lock.yaml', 'package.json', 'packages/page/package.json', 'docs/schema-metadata.md',
    'docs/schema-metadata.schema.json', 'docs/examples/schema-metadata.example.json',
    'metriccanvas-authoring/bundle.json', 'metriccanvas-authoring/tool/requirements.lock']) inputs.add(file);
  return [...inputs].sort();
}

async function sourceIdentity(root: string, sources: string[]): Promise<object> {
  const files = await Promise.all((await buildInputSources(root, sources)).map(async file => ({file,
    sha256: hash(await readFile(path.join(root, file)))})));
  return {kind: 'public-build-inputs', sha256: hash(json(files)), files,
    deployment: 'not_run; Relay must record actual engine/tool versions and artifact digests'};
}

/** The active Python contract and the product policy are exported, never re-authored. */
export async function mcContentOutputs(root: string, graph: McBuildGraph): Promise<Outputs> {
  const bundle = path.join(root, 'metriccanvas-authoring');
  const authored = await copyTree(path.join(bundle, 'contracts/authored'));
  graph = {...graph, authoring: new Map([...authored].map(([file, text]) => [`authored/${file}`, text] as [string, string]).concat([...graph.authoring]))};
  const raw = JSON.parse(execFileSync(process.env.METRICCANVAS_PYTHON ?? 'python3',
    [path.join(root, 'tools/scripts/mc-contracts.py'), bundle], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      input: json({product: Object.fromEntries(graph.product), authoring: Object.fromEntries(graph.authoring)}),
      env: { ...process.env, METRICCANVAS_BUNDLE_ROOT: bundle, PYTHONDONTWRITEBYTECODE: '1' }
    }));
  const outputs = await copyTree(path.join(root, 'tools/mc-content'));
  const lock = JSON.parse(graph.lock);
  const registration = JSON.parse(await readFile(path.join(bundle, 'bundle.json'), 'utf8'));
  const alignedWith = { ...lock, platformProtocolVersion: registration.toolServices['metriccanvas-platform-content'].platformProtocolVersion };
  for (const [file, text] of outputs) if (file.endsWith('.md')) outputs.set(file, materialize(text, alignedWith.platformProtocolVersion));
  outputs.set('runtime/contract-alignment.json', json(alignedWith));
  outputs.set('examples/tool-calls.json', json([...outputs.get('runtime/tool-examples.md')!.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]))));
  const snapshot = json({ composeSchema: raw.composeSchema, patterns: raw.patterns,
    componentCatalog: raw.componentCatalog, authoringCapabilities: raw.authoringCapabilities,
    queryErrorCodes: raw.queryErrorCodes, pageErrorTypes: raw.pageErrorTypes });
  outputs.set('mc-closed-sets/snapshot.json', snapshot);
  outputs.set('protocols/page-schema.json', graph.product.get('page/schema.json')!);
  for (const [file, text] of graph.product) if (!file.startsWith('page/reference/')) outputs.set(`product-contracts/${file}`, text);
  for (const [file, text] of graph.authoring) outputs.set(`authoring-contracts/${file}`, file.endsWith('.md') ? text.replace(/\[([^\]]+)\]\((?:\.\.\/){2,}[^)]+\)/g, '$1 (repository evidence; not an installed dependency)') : text);
  await addMcKnowledge(root, outputs, graph.product, raw);
  outputs.set('protocols/data-context.md', (await readFile(path.join(root, 'docs/schema-metadata.md'), 'utf8'))
    .replaceAll('../PAGE-METADATA.md', '../references/page-metadata/README.md')
    .replaceAll('./schema-metadata.schema.json', '../product-contracts/data-context/schema.json')
    .replaceAll('./examples/schema-metadata.example.json', 'data-context-example.json')
    .replace(/\[([^\]]+)\]\(\.\/adr\/[^)]+\)/g, '$1 (historical provenance; not an installed dependency)'));
  outputs.set('protocols/data-context-example.json', await readFile(path.join(root, 'docs/examples/schema-metadata.example.json'), 'utf8'));
  outputs.set('protocols/version-policy.json', json({ ...versionPolicy, readableVersions: supportedVersions(),
    capabilities: Object.fromEntries(Object.entries(pageCapabilities).map(([id, item]) => [id,
      { minor: item.minor, description: item.description, legacyReadable: !('legacyReadable' in item) || item.legacyReadable !== false }])) }));
  addAtoms(outputs, raw, 'active platform_mcp.py');
  await addPageTools(root, outputs);
  outputs.set('runtime/schema-catalog.json', json(schemaCatalog(outputs)));
  outputs.set('runtime/source-identity.json', json(await sourceIdentity(root, raw.publicSources)));
  addLayoutQueryRefs(outputs);
  outputs.set('index.json', json(indexFor(outputs)));
  const denominator = await knowledgeDenominator(root);
  outputs.set('runtime/coverage.json', json(checkMcCoverage(outputs, graph.product, graph.authoring, raw, denominator)));
  if (process.argv.includes('--mc-coverage')) {
    const actual = await copyTree(path.join(bundle, 'mc-content'));
    checkMcCoverage(actual, graph.product, graph.authoring, raw, denominator);
  }
  outputs.set('index.json', json(indexFor(outputs)));
  const files = [...outputs].map(([file, text]) => ({ file, sha256: hash(text) })).sort((a, b) => a.file.localeCompare(b.file, 'en'));
  outputs.set('mc-content.version.json', json({ interfaceVersion: '1.0',
    contentVersion: `1-${hash(json(files)).slice(0, 16)}`, contentSha256: hash(json(files)), files,
    alignedWith,
    snapshotSha256: hash(snapshot), evaluation: 'external-report; caller decides adoption' }));
  return outputs;
}
