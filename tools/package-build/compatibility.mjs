import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(import.meta.url);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const current = json(require.resolve('svelte/package.json')).version;
const selected = process.argv.find((arg) => arg.startsWith('--svelte='))?.slice('--svelte='.length);
const requestedTree = process.argv.find((arg) => arg.startsWith('--source-tree='))?.slice('--source-tree='.length) ?? 'HEAD';
assert(/^(?:HEAD|[a-f0-9]{40})$/.test(requestedTree), 'source-tree must be HEAD or an explicit Git object id');
const sourceTree = execFileSync('git', ['rev-parse', `${requestedTree}^{tree}`], { cwd: root, encoding: 'utf8' }).trim();
const versions = selected ? [selected === 'current' ? current : selected] : [current, '5.29.0'];
for (const version of versions) assert([current, '5.29.0'].includes(version), `Unsupported matrix version ${version}`);
const requestedOutput = resolve(process.env.METRICCANVAS_COMPATIBILITY_DIR ?? mkdtempSync(join(tmpdir(), 'metriccanvas-compatibility-')));
mkdirSync(requestedOutput, { recursive: true });
const output = realpathSync(requestedOutput);
assert(output !== root && !output.startsWith(root + '/'), 'Compatibility consumers must live outside the workspace');
const summary = { source: root, sourceTree, versions: [] };
const names = ['page', 'engine', 'metric-canvas', 'embed'];

function run(command, args, cwd, log) {
  console.log(`${command} ${args.join(' ')}\n  cwd: ${cwd}\n  log: ${log}`);
  const fd = openSync(log, 'w');
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', fd, fd], env: { ...process.env, CI: '1' } });
  } catch (error) {
    console.error(readFileSync(log, 'utf8').slice(-12000));
    throw error;
  } finally { closeSync(fd); }
}

/** 按明确 Git 树建立隔离源码矩阵，原工作区及其锁文件完全不动。 */
function sourceWorkspace(directory, logs, version) {
  mkdirSync(directory, { recursive: true });
  const archive = directory + '.tar';
  execFileSync('git', ['archive', '--format=tar', '--output', archive, sourceTree], { cwd: root });
  execFileSync('tar', ['-xf', archive, '-C', directory]);
  rmSync(archive);
  if (version === '5.29.0') {
    const pins = { svelte: '5.29.0', vite: '6.3.6', '@sveltejs/vite-plugin-svelte': '5.1.1' };
    const manifests = [join(directory, 'package.json')];
    for (const base of ['packages', 'packages/server', 'apps', 'tools']) {
      for (const entry of readdirSync(join(directory, base), { withFileTypes: true })) {
        const path = join(directory, base, entry.name, 'package.json');
        if (entry.isDirectory() && existsSync(path)) manifests.push(path);
      }
    }
    for (const file of manifests) {
      const manifest = json(file);
      for (const field of ['dependencies', 'devDependencies']) {
        for (const [name, version] of Object.entries(pins)) if (manifest[field]?.[name]) manifest[field][name] = version;
      }
      writeJson(file, manifest);
    }
    const workspace = join(directory, 'pnpm-workspace.yaml');
    const yaml = readFileSync(workspace, 'utf8');
    assert(!/^overrides:/m.test(yaml), 'Merge existing overrides explicitly before extending this matrix');
    writeFileSync(workspace, yaml + '\noverrides:\n' + Object.entries(pins).map(([name, version]) => `  ${JSON.stringify(name)}: ${JSON.stringify(version)}\n`).join(''));
  }
  run('pnpm', ['install', version === '5.29.0' ? '--no-frozen-lockfile' : '--frozen-lockfile', '--strict-peer-dependencies'], directory, join(logs, 'source-install.log'));
  for (const command of ['test', 'check', 'build']) run('pnpm', [command], directory, join(logs, `source-${command}.log`));
  return directory;
}

for (const version of versions) {
  const directory = join(output, version);
  assert(!existsSync(directory), `Use an empty result directory: ${directory}`);
  const logs = join(directory, 'logs');
  mkdirSync(logs, { recursive: true });
  const source = sourceWorkspace(join(directory, 'source'), logs, version);
  const archives = {};
  for (const name of names) {
    const archive = join(directory, `${name}.tgz`);
    run('pnpm', ['pack', '--out', archive], join(source, 'packages', name), join(logs, `pack-${name}.log`));
    archives[`@metriccanvas/${name}`] = `file:${archive}`;
  }

  // 单独安装 page，证明依赖图没有把渲染框架带进来；普通 Node ESM 直接执行协议校验。
  const pageOnly = join(directory, 'page-only');
  mkdirSync(pageOnly);
  writeJson(join(pageOnly, 'package.json'), { private: true, type: 'module', dependencies: { '@metriccanvas/page': archives['@metriccanvas/page'] } });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], pageOnly, join(logs, 'page-install.log'));
  run('node', ['--input-type=module', '-e', `import assert from 'node:assert/strict'; import {createRequire} from 'node:module'; import {parsePage,supportedVersions} from '@metriccanvas/page'; const require=createRequire(import.meta.url); for(const name of ['svelte','echarts']) assert.throws(()=>require.resolve(name)); assert(parsePage({schemaVersion:supportedVersions().at(-1),id:'external',dataSources:{},sections:[{id:'main',components:[{id:'title',type:'reportHeader',layout:{span:12},props:{title:'External'}}]}]}).ok); console.log('page-only Node ESM passed');`], pageOnly, join(logs, 'page-runtime.log'));

  const consumer = join(directory, 'consumer');
  mkdirSync(consumer);
  writeJson(join(consumer, 'package.json'), {
    name: 'metriccanvas-external-consumer', private: true, type: 'module',
    dependencies: { ...archives, svelte: version },
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': version === '5.29.0' ? '5.1.1' : '7.2.0',
      vite: version === '5.29.0' ? '6.3.6' : '8.1.5',
      typescript: '5.9.3', 'svelte-check': '4.7.3', '@types/node': '26.1.1', '@playwright/test': '1.62.0'
    },
    // 四个版本尚未发到 registry；只把彼此的依赖来源固定为这次真实 tarball。
    overrides: Object.fromEntries(Object.keys(archives).map((name) => [name, '$' + name]))
  });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--strict-peer-deps'], consumer, join(logs, 'consumer-install.log'));
  const consumerRequire = createRequire(join(consumer, 'package.json'));
  const engineRequire = createRequire(join(consumer, 'node_modules/@metriccanvas/engine/package.json'));
  assert.equal(json(consumerRequire.resolve('svelte/package.json')).version, version);
  assert.equal(json(engineRequire.resolve('svelte/package.json')).version, version);
  for (const name of names) assert(realpathSync(join(consumer, 'node_modules/@metriccanvas', name)).startsWith(consumer + '/'), 'Installed package points back into workspace');

  for (const path of ['packages/metric-canvas/tests/browser', 'packages/embed/tests/browser', 'packages/embed/examples', 'packages/embed/tests/serve.mjs', 'packages/page/fixtures/contract-valid/url-navigation-page.json', 'pages']) {
    cpSync(join(source, path), join(consumer, path), { recursive: true });
  }
  // 既有浏览器用例与断言不变；类型导入改为已安装包，不能读取本仓 src。
  for (const file of ['embed.spec.ts', 'version-error.spec.ts', 'globals.d.ts']) {
    const path = join(consumer, 'packages/embed/tests/browser', file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll("'../../src/types'", "'@metriccanvas/embed'"));
  }
  cpSync(join(consumer, 'node_modules/@metriccanvas/embed/dist'), join(consumer, 'packages/embed/dist'), { recursive: true });
  for (const [from, to] of [['consumer-vite.config.js', 'vite.config.js'], ['consumer-playwright.config.ts', 'playwright.config.ts'], ['browser-versions.mjs', 'browser-versions.mjs']]) cpSync(join(source, 'tools/package-build/fixtures', from), join(consumer, to));
  writeFileSync(join(consumer, 'svelte.config.js'), 'export default {};\n');
  writeJson(join(consumer, 'tsconfig.json'), {
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, allowJs: true, checkJs: true, skipLibCheck: false, verbatimModuleSyntax: true, esModuleInterop: true, types: ['node'] },
    include: ['packages/metric-canvas/tests/browser/harness/**/*', 'ports.ts']
  });
  const imports = ['@metriccanvas/page', '@metriccanvas/engine', '@metriccanvas/engine/widgets', '@metriccanvas/engine/ui', '@metriccanvas/engine/ui/types', '@metriccanvas/engine/ui/composition', '@metriccanvas/engine/dqe', '@metriccanvas/metric-canvas', '@metriccanvas/metric-canvas/types', '@metriccanvas/embed'];
  writeFileSync(join(consumer, 'ports.ts'), imports.map((name, index) => `export * as Entry${index} from '${name}';`).join('\n'));
  const bin = (name) => join(consumer, 'node_modules/.bin', name);
  run(bin('svelte-check'), ['--tsconfig', './tsconfig.json'], consumer, join(logs, 'consumer-svelte-check.log'));
  run(bin('tsc'), ['--noEmit', '-p', 'tsconfig.json'], consumer, join(logs, 'consumer-types.log'));
  run(bin('vite'), ['build'], consumer, join(logs, 'consumer-build.log'));
  run(bin('playwright'), ['test'], consumer, join(logs, 'consumer-browser.log'));
  const browserResults = json(join(consumer, 'browser-results.json'));
  assert.equal(browserResults.stats.unexpected, 0);
  assert.equal(browserResults.stats.skipped, 0);
  assert(browserResults.stats.expected > 0, 'Browser suite did not run any tests');
  const browsers = json(join(consumer, 'browser-versions.json'));
  assert.deepEqual(Object.keys(browsers).sort(), ['chrome', 'msedge'], 'Both real Chrome and Edge are required');
  summary.versions.push({ svelte: version, isolatedSource: source !== root, consumer, browsers, tests: browserResults.stats });
  writeJson(join(output, 'summary.json'), summary);
}
console.log(JSON.stringify(summary, null, 2));
