import {afterAll, describe, expect, it} from 'vitest';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getLocalBuildCacheStats, withLocalBuildCache} from '../tools/scripts/local-authoring-build-cache';
import {localValidatorOutputs, referenceProjection} from '../tools/scripts/local-authoring-projection';
import {validate} from '../packages/page/src/validate';
import {requiredMinorVersion, versionPolicy} from '../packages/page/src/version';

const temporary = await mkdtemp(path.join(tmpdir(), 'metriccanvas-build-cache-test-'));
afterAll(() => rm(temporary, {recursive: true, force: true}));

async function fixture(name: string): Promise<string> {
  const root = path.join(temporary, name);
  await mkdir(path.join(root, 'tools/scripts'), {recursive: true});
  for (const file of ['local-authoring-projection.ts', 'local-authoring-build-cache.ts']) {
    await cp(path.join(process.cwd(), 'tools/scripts', file), path.join(root, 'tools/scripts', file));
  }
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  await writeFile(path.join(root, 'tools/scripts/value.js'), 'export const value = 1;');
  await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import {value} from "./value"; console.log(value);');
  return root;
}

async function execute(root: string, cacheDir: string, cache = true) {
  return localValidatorOutputs(root, 'tools/scripts/entry.ts', 'scripts/entry.mjs', {cacheDir, cache});
}

function delta(before: ReturnType<typeof getLocalBuildCacheStats>) {
  const after = getLocalBuildCacheStats();
  return {hits: after.hits - before.hits, misses: after.misses - before.misses, disabled: after.disabled - before.disabled};
}

describe.sequential('local deterministic bundle cache', () => {
  it('reuses identical graphs across directories and matches uncached output byte for byte', async () => {
    const first = await fixture('cross-first');
    const second = await fixture('cross-second');
    const cache = path.join(temporary, 'cross-cache');
    const before = getLocalBuildCacheStats();
    const cold = await execute(first, cache);
    const hot = await execute(second, cache);
    const uncached = await execute(second, cache, false);
    expect([...hot]).toEqual([...cold]);
    expect([...uncached]).toEqual([...cold]);
    expect(delta(before)).toEqual({hits: 1, misses: 1, disabled: 1});
    expect([...hot.values()].join('\n')).not.toContain(temporary);
  });

  it('invalidates transitive bytes, new preferred modules, new imports, locks and resolver config', async () => {
    const root = await fixture('invalidations');
    const cache = path.join(temporary, 'invalidations-cache');
    await execute(root, cache);
    const changes: Array<[string, string]> = [
      ['tools/scripts/value.js', 'export const value = 2;'],
      ['tools/scripts/value.ts', 'export const value = 3;'],
      ['tools/scripts/extra.ts', 'export const extra = 4;'],
      ['tools/scripts/entry.ts', 'import {value} from "./value"; import {extra} from "./extra"; console.log(value + extra);'],
      ['pnpm-lock.yaml', 'lockfileVersion: 9\n# new dependency resolution\n'],
      ['tsconfig.json', '{"compilerOptions":{"target":"ES2022"}}']
    ];
    for (const [file, contents] of changes) {
      await writeFile(path.join(root, file), contents);
      const before = getLocalBuildCacheStats();
      const cached = await execute(root, cache);
      expect(delta(before).misses).toBe(1);
      expect([...cached]).toEqual([...await execute(root, cache, false)]);
    }
  });

  it('does not rebuild for edits to unrelated README or example bytes', async () => {
    const root = await fixture('unrelated');
    const cache = path.join(temporary, 'unrelated-cache');
    await writeFile(path.join(root, 'README.md'), 'first');
    await mkdir(path.join(root, 'pages'));
    await writeFile(path.join(root, 'pages/example.json'), '{"value":1}');
    await execute(root, cache);
    await writeFile(path.join(root, 'README.md'), 'second');
    await writeFile(path.join(root, 'pages/example.json'), '{"value":2}');
    const before = getLocalBuildCacheStats();
    await execute(root, cache);
    expect(delta(before).hits).toBe(1);
  });

  it('recovers corrupt, deleted and unverifiable cached outputs and supports environment bypass', async () => {
    const root = await fixture('recovery');
    const cache = path.join(temporary, 'recovery-cache');
    const original = await execute(root, cache);
    const record = path.join(cache, (await readdir(cache))[0]);
    for (const contents of ['{broken', JSON.stringify({format: 1}), '{}']) {
      await writeFile(record, contents);
      const before = getLocalBuildCacheStats();
      expect([...await execute(root, cache)]).toEqual([...original]);
      expect(delta(before).misses).toBe(1);
    }
    const parsed = JSON.parse(await readFile(record, 'utf8'));
    parsed.outputs[0][1] += 'corruption';
    await writeFile(record, JSON.stringify(parsed));
    expect([...await execute(root, cache)]).toEqual([...original]);
    await rm(record);
    expect([...await execute(root, cache)]).toEqual([...original]);
    const previous = process.env.METRICCANVAS_LOCAL_BUILD_CACHE;
    try {
      process.env.METRICCANVAS_LOCAL_BUILD_CACHE = '0';
      const before = getLocalBuildCacheStats();
      expect([...await execute(root, cache)]).toEqual([...original]);
      expect(delta(before).disabled).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.METRICCANVAS_LOCAL_BUILD_CACHE;
      else process.env.METRICCANVAS_LOCAL_BUILD_CACHE = previous;
    }
  });

  it('tracks actual dependency bytes, metadata, licenses and a newly nearer package', async () => {
    const root = await fixture('dependencies');
    const cache = path.join(temporary, 'dependency-cache');
    const dependency = path.join(root, 'node_modules/example-dependency');
    await mkdir(dependency, {recursive: true});
    await writeFile(path.join(dependency, 'package.json'), '{"name":"example-dependency","version":"1.0.0","main":"index.js","license":"MIT"}');
    await writeFile(path.join(dependency, 'index.js'), 'module.exports = 1;');
    await writeFile(path.join(dependency, 'LICENSE'), 'original license');
    await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import value from "example-dependency"; console.log(value);');
    await execute(root, cache);
    for (const [name, contents] of [['index.js', 'module.exports = 2;'], ['LICENSE', 'updated license'],
      ['package.json', '{"name":"example-dependency","version":"1.0.1","main":"index.js","license":"MIT"}']]) {
      await writeFile(path.join(dependency, name), contents);
      const before = getLocalBuildCacheStats();
      const actual = await execute(root, cache);
      expect(delta(before).misses).toBe(1);
      expect([...actual]).toEqual([...await execute(root, cache, false)]);
    }
    const nearer = path.join(root, 'tools/node_modules/example-dependency');
    await mkdir(path.dirname(nearer), {recursive: true});
    await cp(dependency, nearer, {recursive: true});
    await writeFile(path.join(nearer, 'index.js'), 'module.exports = 7;');
    const before = getLocalBuildCacheStats();
    const actual = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...actual]).toEqual([...await execute(root, cache, false)]);
  });

  it('detects a re-pointed installed package while old dependency bytes remain available', async () => {
    const root = await fixture('symlink');
    const cache = path.join(temporary, 'symlink-cache');
    const packages = ['version-one', 'version-two'].map(version => path.join(root, 'node_modules/.pnpm', version, 'node_modules/dependency'));
    for (const [index, folder] of packages.entries()) {
      await mkdir(folder, {recursive: true});
      await writeFile(path.join(folder, 'package.json'), '{"name":"dependency","version":"1.0.0","main":"index.js"}');
      await writeFile(path.join(folder, 'index.js'), `module.exports = ${index};`);
      await writeFile(path.join(folder, 'LICENSE'), 'license');
    }
    const link = path.join(root, 'node_modules/dependency');
    await symlink(packages[0], link);
    await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import value from "dependency"; console.log(value);');
    const first = await execute(root, cache);
    await rm(link);
    await symlink(packages[1], link);
    const before = getLocalBuildCacheStats();
    const second = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...second]).not.toEqual([...first]);
    expect([...second]).toEqual([...await execute(root, cache, false)]);
  });

  it('detects transitive package resolution changes in a shared external pnpm installation', async () => {
    const root = await fixture('transitive-package');
    const cache = path.join(temporary, 'transitive-package-cache');
    const installed = path.join(temporary, 'shared-install/node_modules');
    const outer = path.join(installed, '.pnpm/outer/node_modules/outer');
    const inners = ['one', 'two'].map(name => path.join(installed, `.pnpm/${name}/node_modules/inner`));
    for (const [index, folder] of [outer, ...inners].entries()) {
      await mkdir(folder, {recursive: true});
      await writeFile(path.join(folder, 'package.json'), JSON.stringify({name: index ? 'inner' : 'outer', version: '1.0.0', main: 'index.js'}));
      await writeFile(path.join(folder, 'LICENSE'), 'license');
      await writeFile(path.join(folder, 'index.js'), index ? `module.exports = ${index};` : 'module.exports = require("inner");');
    }
    await symlink(outer, path.join(installed, 'outer'));
    await symlink(installed, path.join(root, 'node_modules'));
    const link = path.join(path.dirname(outer), 'inner');
    await symlink(inners[0], link);
    await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import value from "outer"; console.log(value);');
    const first = await execute(root, cache);
    await rm(link);
    await symlink(inners[1], link);
    const before = getLocalBuildCacheStats();
    const actual = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...actual]).not.toEqual([...first]);
    expect([...actual]).toEqual([...await execute(root, cache, false)]);
  });

  it('invalidates a whole node_modules scope retargeted to different bytes at identical pnpm paths', async () => {
    const root = await fixture('scope-retarget');
    const cache = path.join(temporary, 'scope-retarget-cache');
    const installations = ['install-a', 'install-b'].map(name => path.join(temporary, name, 'node_modules'));
    for (const [index, installation] of installations.entries()) {
      const dependency = path.join(installation, '.pnpm/same-version/node_modules/dependency');
      await mkdir(dependency, {recursive: true});
      await writeFile(path.join(dependency, 'package.json'), '{"name":"dependency","version":"1.0.0","main":"index.js"}');
      await writeFile(path.join(dependency, 'index.js'), `module.exports = ${index};`);
      await writeFile(path.join(dependency, 'LICENSE'), 'license');
      await symlink('.pnpm/same-version/node_modules/dependency', path.join(installation, 'dependency'));
    }
    const consumer = path.join(root, 'packages/consumer');
    await mkdir(consumer, {recursive: true});
    await symlink(installations[0], path.join(root, 'node_modules'));
    const scope = path.join(consumer, 'node_modules');
    await symlink(installations[0], scope);
    await writeFile(path.join(consumer, 'index.ts'), 'import value from "dependency"; export default value;');
    await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import value from "../../packages/consumer"; console.log(value);');
    const first = await execute(root, cache);
    await rm(scope);
    await symlink(installations[1], scope);
    const before = getLocalBuildCacheStats();
    const actual = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...actual]).not.toEqual([...first]);
    expect([...actual]).toEqual([...await execute(root, cache, false)]);
  });

  it('detects a re-pointed source symlink imported without an extension', async () => {
    const root = await fixture('source-symlink');
    const cache = path.join(temporary, 'source-symlink-cache');
    await writeFile(path.join(root, 'tools/scripts/one.js'), 'export const value = 1;');
    await writeFile(path.join(root, 'tools/scripts/two.js'), 'export const value = 2;');
    const link = path.join(root, 'tools/scripts/value.js');
    await rm(link);
    await symlink('one.js', link);
    await execute(root, cache);
    await rm(link);
    await symlink('two.js', link);
    const before = getLocalBuildCacheStats();
    const actual = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...actual]).toEqual([...await execute(root, cache, false)]);
  });

  it('tracks configured alias targets and inherited configuration', async () => {
    const root = await fixture('aliases');
    const cache = path.join(temporary, 'alias-cache');
    await mkdir(path.join(root, 'aliases'));
    await writeFile(path.join(root, 'tsconfig.json'), '{"extends":"./base.json"}');
    await writeFile(path.join(root, 'base.json'), '{"compilerOptions":{"baseUrl":".","paths":{"@value":["aliases/value"]}}}');
    await writeFile(path.join(root, 'aliases/value.js'), 'export default 1;');
    await writeFile(path.join(root, 'tools/scripts/entry.ts'), 'import value from "@value"; console.log(value);');
    await execute(root, cache);
    await writeFile(path.join(root, 'aliases/value.ts'), 'export default 8;');
    let before = getLocalBuildCacheStats();
    const preferred = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...preferred]).toEqual([...await execute(root, cache, false)]);
    await writeFile(path.join(root, 'base.json'), '{"compilerOptions":{"baseUrl":".","paths":{"@value":["aliases/value.js"]}}}');
    before = getLocalBuildCacheStats();
    const changed = await execute(root, cache);
    expect(delta(before).misses).toBe(1);
    expect([...changed]).toEqual([...await execute(root, cache, false)]);
  });

  it('keeps concurrent cache writes atomic and an unwritable cache optional', async () => {
    const root = await fixture('concurrent');
    const cache = path.join(temporary, 'concurrent-cache');
    const results = await Promise.all([execute(root, cache), execute(root, cache), execute(root, cache)]);
    expect(results.map(result => [...result])).toEqual(results.map(() => [...results[0]]));
    expect(await readdir(cache)).toHaveLength(1);
    const before = getLocalBuildCacheStats();
    expect([...await execute(root, cache)]).toEqual([...results[0]]);
    expect(delta(before).hits).toBe(1);
    const blocked = path.join(temporary, 'blocked-cache');
    await writeFile(blocked, 'regular file');
    expect([...await execute(root, blocked)]).toEqual([...results[0]]);
  });

  it('uses a cold build when a resolver config outside the checkout can affect resolution', async () => {
    const root = await fixture('external-config/checkout');
    const cache = path.join(temporary, 'external-config-cache');
    await writeFile(path.join(path.dirname(root), 'tsconfig.json'), '{"compilerOptions":{"target":"ES2022"}}');
    const before = getLocalBuildCacheStats();
    const actual = await execute(root, cache);
    expect(delta(before).disabled).toBe(1);
    expect([...actual]).toEqual([...await execute(root, cache, false)]);
  });

  it('accepts a checkout reached through a directory symlink in the generic cache API', async () => {
    const actual = await fixture('generic-root');
    const linked = path.join(temporary, 'generic-linked');
    await symlink(actual, linked);
    const cacheDir = path.join(temporary, 'generic-cache');
    let builds = 0;
    const build = async () => ({outputs: new Map([['result', String(++builds)]]),
      files: [path.join(linked, 'package.json')], directories: [path.join(linked, 'tools')]});
    const first = await withLocalBuildCache(linked, 'generic', {cacheDir}, build);
    const second = await withLocalBuildCache(linked, 'generic', {cacheDir}, build);
    expect([...second]).toEqual([...first]);
    expect(builds).toBe(1);
  });

  it('uses build options and never hides a cold build failure behind a stale record', async () => {
    const root = await fixture('failure');
    const cache = path.join(temporary, 'failure-cache');
    await execute(root, cache);
    await writeFile(path.join(root, 'tools/scripts/value.js'), 'invalid !!!');
    await expect(execute(root, cache)).rejects.toThrow();
    let builds = 0;
    const build = async () => ({outputs: new Map([['result', String(++builds)]]),
      files: [path.join(root, 'package.json')], directories: []});
    await withLocalBuildCache(root, {parameter: 1}, {cacheDir: cache}, build);
    await withLocalBuildCache(root, {parameter: 2}, {cacheDir: cache}, build);
    expect(builds).toBe(2);
  });
});

function projectExample(document: unknown): string {
  return referenceProjection(new Map([['page/reference/examples/sample.json', JSON.stringify(document, null, 2) + '\n']])).get('examples/sample.json')!;
}

it('retains the bytes and version of a valid example when the current minor changes independently', () => {
  const document = {schemaVersion: '6.51', id: 'stable-example', meta: {title: 'Stable'}, layout: 'dashboard', dataSources: {},
    sections: [{id: 'main', components: [{id: 'text', type: 'text', layout: {span: 12}, props: {body: 'Stable'}}]}]};
  expect(validate(document)).toEqual([]);
  const original = JSON.stringify(document, null, 2) + '\n';
  expect(projectExample(document)).toBe(original);
  expect(document.schemaVersion).not.toBe(versionPolicy.current);
});

it('still upgrades examples that actually require a capability floor or legacy header migration', () => {
  const document = {schemaVersion: '6.51', id: 'upgrade-example', meta: {title: 'Upgrade'}, layout: 'dashboard', dataSources: {},
    sections: [{id: 'main', components: [{id: 'header', type: 'iocHeader', layout: {span: 12}, props: {identity: {title: 'Upgrade'}}}]}]};
  expect(validate(document).length).toBeGreaterThan(0);
  const upgraded = JSON.parse(projectExample(document));
  expect(upgraded.schemaVersion).toBe(`6.${requiredMinorVersion(upgraded)}`);
  expect(validate(upgraded)).toEqual([]);
  expect(document.schemaVersion).toBe('6.51');
});


it('migrates a legacy root IOC header even when its declared version is still accepted', () => {
  const document = {schemaVersion: '6.51', id: 'legacy-header', layout: 'dashboard', dataSources: {},
    iocHeader: {identity: {title: 'Legacy'}},
    sections: [{id: 'main', components: [{id: 'text', type: 'text', layout: {span: 12}, props: {body: 'Body'}}]}]};
  const upgraded = JSON.parse(projectExample(document));
  expect(upgraded.schemaVersion).toBe(`6.${requiredMinorVersion(upgraded)}`);
  expect(upgraded.iocHeader).toBeUndefined();
  expect(upgraded.sections[0].components[0].type).toBe('iocHeader');
  expect(validate(upgraded)).toEqual([]);
});


async function copyRealValidatorTree(root: string): Promise<void> {
  const source = process.cwd();
  const inputs = ['tools/scripts', 'packages/page', 'pnpm-lock.yaml', 'package.json', 'tsconfig.base.json'];
  const ignored = new Set(['node_modules', '__pycache__', 'dist']);
  for (const relative of inputs) {
    await mkdir(path.dirname(path.join(root, relative)), {recursive: true});
    await cp(path.join(source, relative), path.join(root, relative), {recursive: true, filter: file => !ignored.has(path.basename(file))});
  }
  await symlink(path.join(source, 'node_modules'), path.join(root, 'node_modules'));
  await symlink(path.join(source, 'packages/page/node_modules'), path.join(root, 'packages/page/node_modules'));
}

it('reuses a real heavy validator across an isolated shared-install checkout and matches an uncached build', async () => {
  const root = path.join(temporary, 'real-validator-checkout');
  const cacheDir = path.join(temporary, 'real-validator-cache');
  await copyRealValidatorTree(root);
  const original = await localValidatorOutputs(process.cwd(), undefined, undefined, {cacheDir});
  let before = getLocalBuildCacheStats();
  const isolated = await localValidatorOutputs(root, undefined, undefined, {cacheDir});
  expect(delta(before).hits).toBe(1);
  expect([...isolated]).toEqual([...original]);
  // A cold build inside the same isolation layout must validate its own graph;
  // priming only from the source root hides physical/virtual pnpm scope drift.
  await rm(cacheDir, {recursive: true, force: true});
  before = getLocalBuildCacheStats();
  const isolatedCold = await localValidatorOutputs(root, undefined, undefined, {cacheDir});
  expect(delta(before).misses).toBe(1);
  expect([...isolatedCold]).toEqual([...original]);
  // Export regenerates output directories and descriptions outside this graph.
  await mkdir(path.join(root, 'contracts/generated'), {recursive: true});
  await writeFile(path.join(root, 'contracts/generated/README.md'), 'Generated output, not a build input.');
  await writeFile(path.join(root, 'README.md'), 'Changed authoring guidance.');
  before = getLocalBuildCacheStats();
  const repeated = await localValidatorOutputs(root, undefined, undefined, {cacheDir});
  expect(delta(before).hits).toBe(1);
  const uncached = await localValidatorOutputs(root, undefined, undefined, {cacheDir, cache: false});
  expect([...uncached]).toEqual([...repeated]);
  expect([...uncached.values()].join('\n')).not.toContain(root);
  before = getLocalBuildCacheStats();
  await localValidatorOutputs(root, undefined, undefined, {cacheDir});
  expect(delta(before).hits).toBe(1);
}, 30_000);

it('migrates 5.x recommendation examples to the lowest supported 6.x capability version', () => {
  const document = {schemaVersion: '5.4', id: 'legacy-five', layoutForm: 'dashboard', dashboardToolbar: 'hidden', dataSources: {},
    sections: [{id: 'main', components: [{id: 'text', type: 'text', layout: {span: 12}, props: {body: 'Body'}}]}]};
  const upgraded = JSON.parse(projectExample(document));
  expect(upgraded.schemaVersion).toBe('6.5');
  expect(validate(upgraded)).toEqual([]);
});
