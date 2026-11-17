import assert from 'node:assert/strict';
import test from 'node:test';
import { dependencyGraph } from './imports.mjs';
import { findingsFor, additions } from './ratchet.mjs';

const page = 'packages/page/src/';
const exec = 'packages/data-execution/src/';
const view = 'packages/engine/runtime-ui/src/';
const manifest = (name, exports) => JSON.stringify({ name, exports });
const scan = files => findingsFor(dependencyGraph(new Map(files)).graph);

test('growing a cycle and adding a chord inside the same cycle both fail; removing an edge passes', () => {
  const a = exec + 'a.ts', b = exec + 'b.ts', c = exec + 'c.ts';
  const pair = scan([[a, "import './b'"], [b, "import './a'"], [c, '']]);
  const triangle = scan([[a, "import './b'"], [b, "import './a'; import './c'"], [c, "import './a'"]]);
  const larger = additions(triangle, pair);
  assert.equal(larger.length, 2);
  assert.ok(larger.some(({ path }) => path.join('|') === [c, a, b, c].join('|')));
  const chord = scan([[a, "import './b'; import './c'"], [b, "import './a'; import './c'"], [c, "import './a'"]]);
  assert.deepEqual(additions(chord, triangle), [{ rule: 'cycle', path: [a, c, a] }]);
  assert.deepEqual(additions(pair, triangle), []);
});

test('exposes transitive re-export violations and a second route to an existing forbidden target', () => {
  const a = exec + 'a.ts', b = page + 'b.ts', c = page + 'c.ts', d = view + 'private.ts';
  const common = [
    ['packages/engine/package.json', manifest('@metriccanvas/engine', { './ui': { svelte: './runtime-ui/src/private.ts', default: './runtime-ui/src/private.ts' } })],
    ['packages/page/package.json', manifest('@metriccanvas/page', { './internal': './src/b.ts' })],
    [a, "export * from '@metriccanvas/page/internal'"], [d, 'export const value = 1;'],
  ];
  const previous = scan([...common, [b, "export * from '@metriccanvas/engine/ui'"], [c, '']]);
  const candidate = scan([...common, [b, "export * from '@metriccanvas/engine/ui'; export * from './c'"], [c, "export * from '@metriccanvas/engine/ui'"]]);
  const added = additions(candidate, previous);
  assert.ok(added.some(({ rule, path }) => rule === 'data-execution boundary' && path.join('|') === [a, b, c, d].join('|')));
  assert.ok(added.some(({ rule }) => rule === 'page boundary'));
});

test('keeps explicit type imports out of cycles and retains side-effect imports under verbatimModuleSyntax', () => {
  const a = exec + 'a.ts', b = exec + 'b.ts';
  const tree = new Map([[a, "import type { B } from './b'; export type { B } from './b'; type C = import('./b').B"], [b, "import './a'"]]);
  const { graph, typeReferences } = dependencyGraph(tree);
  assert.equal(typeReferences, 3);
  assert.equal(findingsFor(graph).size, 0);
  tree.set(a, "import { type B } from './b'");
  assert.equal(scan(tree).size, 2);
});

test('resolves Svelte module scripts, literal dynamic template imports and extension substitutions', () => {
  const a = view + 'View.svelte', b = view + 'bridge.ts';
  const types = "<script module lang='ts'>import type { Value } from './bridge';</script>";
  const files = [[a, types + '<button onclick={() => import(`./bridge.js`)}>Open</button>'], [b, "export { default as View } from './View.svelte'"]];
  assert.equal(scan(files).size, 2);
  assert.equal(scan([[a, "<script>import './bridge'</script>"], files[1]]).size, 2);
  assert.throws(() => scan([[a, '<p>{import(name)}</p>']]), /unresolved import/);
  assert.throws(() => scan([[b, "import './missing'"]]), /unresolved source/);
  assert.throws(() => scan([[b, 'import(someName)']]), /computed module/);
});

test('resolves an inherited TypeScript paths mapping from the source snapshot', () => {
  const a = page + 'caller.ts', b = view + 'View.svelte';
  const tree = new Map([
    ['tsconfig.base.json', JSON.stringify({ compilerOptions: { moduleResolution: 'bundler', module: 'ESNext', paths: { 'view/*': ['./packages/engine/runtime-ui/src/*'] } } })],
    ['packages/page/tsconfig.json', JSON.stringify({ extends: '../../tsconfig.base.json' })],
    [a, "import View from 'view/View.svelte'"], [b, '<p>View</p>'],
  ]);
  assert.deepEqual([...scan(tree).values()], [{ rule: 'page boundary', path: [a, b] }]);
});
