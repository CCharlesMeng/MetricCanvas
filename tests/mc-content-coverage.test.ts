import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkMcCoverage } from '../tools/scripts/mc-content-coverage';
import { indexFor } from '../tools/scripts/mc-content';

type Outputs = Map<string, string>;
function tree(root: string, prefix = ''): Outputs {
  const files: Outputs = new Map();
  for (const item of readdirSync(path.join(root, prefix), {withFileTypes: true})) {
    if (item.name === '__pycache__') continue;
    const file = path.posix.join(prefix, item.name);
    if (item.isDirectory()) for (const entry of tree(root, file)) files.set(...entry);
    else files.set(file, readFileSync(path.join(root, file), 'utf8'));
  }
  return files;
}
const content = tree('metriccanvas-authoring/mc-content');
const product = tree('metriccanvas-authoring/contract-snapshot');
const authoring = new Map([...tree('metriccanvas-authoring/contracts')].filter(([file]) => !file.startsWith('exported/') || file.endsWith('.json')));
const snapshot = JSON.parse(content.get('mc-closed-sets/snapshot.json')!);
const toolNames = Object.keys(JSON.parse(content.get('index.json')!).tool);
const raw = {...snapshot, tools: Object.fromEntries(toolNames.map(name => [name, JSON.parse(content.get(`tool-contracts/${name}.json`)!)]))};
const map = JSON.parse(readFileSync('docs/page-metadata/reference-map.json', 'utf8'));
const check = (outputs: Outputs, denominator = map) => checkMcCoverage(outputs, product, authoring, raw, denominator);

describe('MC coverage uses the product denominator', () => {
  it('covers the independent product, authoring, topic, tool and component registries', () => {
    expect(check(content)).toMatchObject({counts: {tools: toolNames.length, components: snapshot.componentCatalog.length}});
  });
  it('detects a category omitted by the generator even with a self-consistent index', () => {
    const broken = new Map([...content].filter(([file]) => !file.startsWith('knowledge/')));
    broken.set('index.json', JSON.stringify(indexFor(broken)));
    expect(() => check(broken)).toThrow(/MC coverage/);
  });
  it('detects a newly registered source module instead of counting only generated files', () => {
    const denominator = {...map, modules: {...map.modules, 'unselected-module.md': {sources: []}}};
    expect(() => check(content, denominator)).toThrow(/missing registered module/);
  });
  it('detects an unreachable layout or semantic topic', () => {
    const broken = new Map(content);
    const index = JSON.parse(broken.get('index.json')!);
    delete index.layout.dashboard;
    broken.set('index.json', JSON.stringify(index));
    expect(() => check(broken)).toThrow(/unreachable layout/);
  });
  it('detects a tool branch lost after registration', () => {
    const broken = new Map(content);
    const tool = JSON.parse(broken.get('tool-contracts/edit_page.json')!);
    delete tool.inputSchema.properties.request;
    broken.set('tool-contracts/edit_page.json', JSON.stringify(tool));
    expect(() => check(broken)).toThrow(/tool registration drift/);
  });
  it('requires every product component to explicitly declare authoring support', () => {
    expect(() => checkMcCoverage(content, product, authoring, {...raw, componentCatalog: [...raw.componentCatalog, {type: 'futureComponent'}]}, map)).toThrow(/capability declaration missing/);
  });
});
