import { validateReferenceLinks } from './page-reference';
import { decodeKnowledge, type AuthoringKnowledge } from './local-authoring-knowledge-core';

type Outputs = Map<string, string>;
const required = (condition: unknown, message: string) => { if (!condition) throw new Error(`MC coverage: ${message}`); };
const parse = (outputs: Outputs, file: string): any => {
  required(outputs.has(file), `missing ${file}`);
  return JSON.parse(outputs.get(file)!);
};

export function checkMcCoverage(outputs: Outputs, product: Outputs, authoring: Outputs, raw: any, map: any): object {
  const index = parse(outputs, 'index.json');
  required(outputs.has('references/authoring-knowledge/model.json'), 'missing references/authoring-knowledge/model.json');
  const model = decodeKnowledge(outputs.get('references/authoring-knowledge/model.json')!);
  const entries: object[] = [];
  for (const file of product.keys()) {
    if (file.startsWith('page/reference/')) {
      const target = `references/page-metadata/${file.slice('page/reference/'.length)}`;
      requireIndexed(outputs, index.reference, file.slice('page/reference/'.length).replace(/\.(json|md)$/, ''), target);
      entries.push({source: `product:${file}`, target, scope: 'current normalized reference; frozen vectors remain separate'});
    } else {
      requireIndexed(outputs, index.product, file.replace(/\.(json|md)$/, ''), `product-contracts/${file}`);
      entries.push({source: `product:${file}`, target: `product-contracts/${file}`, scope: 'exact product contract'});
    }
  }
  for (const file of authoring.keys()) {
    requireIndexed(outputs, index.authoring, file.replace(/\.(json|md|ts)$/, ''), `authoring-contracts/${file}`);
    entries.push({source: `authoring:${file}`, target: `authoring-contracts/${file}`, scope: 'authoring contract; not all are model inputs'});
  }
  checkKnowledge(outputs, index, model, map);
  required(outputs.get('protocols/page-schema.json') === product.get('page/schema.json'), 'page schema source mismatch');
  const referenceIndex = parse(outputs, 'references/page-metadata/index.json');
  for (const [kind, missing] of Object.entries(referenceIndex.semanticGaps) as Array<[string, unknown[]]>) required(!missing.length, `uncovered semantic ${kind}: ${JSON.stringify(missing)}`);
  for (const [name, tool] of Object.entries(raw.tools) as Array<[string, any]>) {
    const actual = parse(outputs, `tool-contracts/${name}.json`);
    required(JSON.stringify(actual.inputSchema) === JSON.stringify(tool.inputSchema), `tool registration drift: ${name}`);
    required(index.tool[name], `unreachable tool: ${name}`);
  }
  checkComponents(outputs, index, raw);
  for (const key of ['dashboard', 'report', 'reading', 'report-composition']) required(index.layout[key], `unreachable layout: ${key}`);
  for (const key of ['business-report', 'usage-report']) {
    required(index.scenario[key], `missing scenario: ${key}`);
    required(index.example[key], `missing scene example: ${key}`);
  }
  for (const key of ['data-context', 'data-context-example', 'discovery-query', 'version-policy']) required(index.protocol[key], `missing protocol: ${key}`);
  checkOwnership(outputs, index);
  required(outputs.has('HANDOFF.md') && outputs.has('LICENSE'), 'missing distribution instructions/license');
  validateReferenceLinks(outputs);
  return {formatVersion: 1, scope: 'public MC; deployment infrastructure excluded', entries,
    counts: {product: product.size, authoring: authoring.size, modules: Object.keys(model.modules).length,
      topics: Object.keys(model.topics).length, nodes: model.nodes.length, tools: Object.keys(raw.tools).length,
      components: raw.componentCatalog.length},
    checks: ['source-denominator', 'semantic-headings', 'topic-closure', 'registration-schema', 'capabilities', 'query-reachability', 'file-links']};
}

function requireIndexed(outputs: Outputs, index: any, key: string, file: string): void {
  required(outputs.has(file), `missing source projection: ${file}`);
  required(index?.[key] === file, `unreachable source projection: ${file}`);
}

function checkKnowledge(outputs: Outputs, index: any, model: AuthoringKnowledge, map: any): void {
  for (const [file, module] of Object.entries(map.modules) as Array<[string, any]>) {
    const id = file.split('/').at(-1)!.replace(/\.md$/, '');
    // reference-map modules is keyed by output path; all registered semantic blocks must survive.
    required(model.modules[id], `missing registered module: ${file}`);
    required(index.knowledge[`${id}.overview`], `unreachable module: ${file}`);
    required(module, `invalid module: ${file}`);
  }
  for (const id of Object.keys(map.authoringTopics)) requireIndexed(outputs, index.knowledge, id, `knowledge/${id}.json`);
  for (const id of Object.keys(model.topics)) requireIndexed(outputs, index.knowledge, id, `knowledge/${id}.json`);
  const page = parse(outputs, 'protocols/page-schema.json');
  required(JSON.stringify(page) === JSON.stringify(model.schema), 'knowledge structure differs from product');
}

function checkComponents(outputs: Outputs, index: any, raw: any): void {
  const types = raw.componentCatalog.map((item: any) => item.type).sort();
  required(JSON.stringify(types) === JSON.stringify(Object.keys(raw.authoringCapabilities).sort()), 'component capability declaration missing');
  for (const name of types) requireIndexed(outputs, index.component, name, `components/${name}.json`);
}

function checkOwnership(outputs: Outputs, index: any): void {
  const migration = parse(outputs, 'runtime/skill-migration.json');
  required(migration.sourceFiles.length > 0, 'empty workflow denominator');
  for (const source of migration.sourceFiles) required(migration.paragraphs.some((row: any) => row.source === source), `unclassified workflow: ${source}`);
  for (const row of migration.paragraphs) {
    required(row.ownership && row.skillRetains, `missing ownership: ${row.source}:${row.paragraph}`);
    for (const key of row.mcKeys) {
      const [topic, ...parts] = key.split('/');
      required(index[topic]?.[parts.join('/')], `unreachable migrated fact: ${key}`);
    }
  }
}
