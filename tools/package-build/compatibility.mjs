import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceCheckCommands } from './compatibility-profile.mjs';

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(import.meta.url);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const current = json(require.resolve('svelte/package.json')).version;
const selected = process.argv.find((arg) => arg.startsWith('--svelte='))?.slice('--svelte='.length);
const requestedTree = process.argv.find((arg) => arg.startsWith('--source-tree='))?.slice('--source-tree='.length) ?? 'HEAD';
assert(/^(?:HEAD|[a-f0-9]{40})$/.test(requestedTree), 'source-tree must be HEAD or an explicit Git object id');
const sourceTree = execFileSync('git', ['rev-parse', `${requestedTree}^{tree}`], { cwd: root, encoding: 'utf8' }).trim();
const checkMode = process.argv.find(arg => arg.startsWith('--source-checks='))?.slice('--source-checks='.length) ?? 'full';
const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const headTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim();
const sourceCommands = sourceCheckCommands(checkMode, {
  githubActions: process.env.GITHUB_ACTIONS, ci: process.env.CI,
  githubSha: process.env.GITHUB_SHA, headSha, sourceTree, headTree
});
const versions = selected ? [selected === 'current' ? current : selected] : [current];
for (const version of versions) assert(version === current, `Unsupported matrix version ${version}`);
const requestedOutput = resolve(process.env.METRICCANVAS_COMPATIBILITY_DIR ?? mkdtempSync(join(tmpdir(), 'metriccanvas-compatibility-')));
mkdirSync(requestedOutput, { recursive: true });
const output = realpathSync(requestedOutput);
assert(output !== root && !output.startsWith(root + '/'), 'Compatibility consumers must live outside the workspace');
const summary = {
  source: root, sourceTree, sourceCommit: headSha,
  sourceValidation: { mode: checkMode, commands: sourceCommands,
    delegatedJobs: checkMode === 'ci' ? ['tests', 'types'] : [] },
  steps: [], versions: []
};
writeJson(join(output, 'summary.json'), summary);
const names = ['data-execution', 'page', 'ui', 'engine', 'metric-canvas', 'embed'];

function run(command, args, cwd, log) {
  console.log(`${command} ${args.join(' ')}\n  cwd: ${cwd}\n  log: ${log}`);
  const fd = openSync(log, 'w');
  const started = Date.now();
  let result = 'success';
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', fd, fd], env: { ...process.env, CI: '1' } });
  } catch (error) {
    result = 'failure';
    console.error(readFileSync(log, 'utf8').slice(-12000));
    throw error;
  } finally {
    closeSync(fd);
    summary.steps.push({ command, args, seconds: (Date.now() - started) / 1000, result, log });
    writeJson(join(output, 'summary.json'), summary);
  }
}

/** 按明确 Git 树建立隔离源码矩阵，原工作区及其锁文件完全不动。 */
function sourceWorkspace(directory, logs) {
  mkdirSync(directory, { recursive: true });
  const archive = directory + '.tar';
  execFileSync('git', ['archive', '--format=tar', '--output', archive, sourceTree], { cwd: root });
  execFileSync('tar', ['-xf', archive, '-C', directory]);
  rmSync(archive);
  run('pnpm', ['install', '--frozen-lockfile', '--strict-peer-dependencies'], directory, join(logs, 'source-install.log'));
  for (const command of sourceCommands) run('pnpm', [command], directory, join(logs, `source-${command}.log`));
  return directory;
}

for (const version of versions) {
  const directory = join(output, version);
  assert(!existsSync(directory), `Use an empty result directory: ${directory}`);
  const logs = join(directory, 'logs');
  mkdirSync(logs, { recursive: true });
  const source = sourceWorkspace(join(directory, 'source'), logs);
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
  run('node', ['--input-type=module', '-e', `import assert from 'node:assert/strict'; import {createRequire} from 'node:module'; import {parsePage,supportedVersions} from '@metriccanvas/page'; const require=createRequire(import.meta.url); for(const name of ['svelte','echarts','@metriccanvas/ui']) assert.throws(()=>require.resolve(name)); assert(parsePage({schemaVersion:supportedVersions().at(-1),id:'external',dataSources:{},sections:[{id:'main',components:[{id:'title',type:'reportHeader',layout:{span:12},props:{title:'External'}}]}]}).ok); console.log('page-only Node ESM passed');`], pageOnly, join(logs, 'page-runtime.log'));

  // UI-only installation must not reach any product/domain package.
  const uiOnly = join(directory, 'ui-only');
  mkdirSync(uiOnly);
  writeJson(join(uiOnly, 'package.json'), {
    private: true, type: 'module',
    dependencies: { '@metriccanvas/ui': archives['@metriccanvas/ui'], svelte: version },
    devDependencies: { typescript: '5.9.3', 'svelte-check': '4.7.3',
      '@sveltejs/vite-plugin-svelte': '7.2.0',
      vite: '8.1.5' }
  });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--strict-peer-deps'], uiOnly, join(logs, 'ui-install.log'));
  const uiRequire = createRequire(join(uiOnly, 'package.json'));
  for (const name of ['@metriccanvas/page', '@metriccanvas/engine', '@metriccanvas/metric-canvas', '@metriccanvas/embed', 'echarts']) assert.throws(() => uiRequire.resolve(name));
  cpSync(join(source, 'tools/package-build/fixtures/ui-only'), uiOnly, { recursive: true });
  for (const [command, args] of [['svelte-check', ['--tsconfig', './tsconfig.json']], ['vite', ['build']]]) {
    run(join(uiOnly, 'node_modules/.bin', command), args, uiOnly, join(logs, `ui-${command}.log`));
  }

  const consumer = join(directory, 'consumer');
  mkdirSync(consumer);
  writeJson(join(consumer, 'package.json'), {
    name: 'metriccanvas-external-consumer', private: true, type: 'module',
    dependencies: { ...archives, svelte: version },
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': '7.2.0',
      vite: '8.1.5',
      typescript: '5.9.3', 'svelte-check': '4.7.3', '@types/node': '26.1.1', '@playwright/test': '1.62.0'
    },
    // 产品和 UI 版本尚未发到 registry；只把彼此的依赖来源固定为这次真实 tarball。
    overrides: Object.fromEntries(Object.keys(archives).map((name) => [name, '$' + name]))
  });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--strict-peer-deps'], consumer, join(logs, 'consumer-install.log'));
  const consumerRequire = createRequire(join(consumer, 'package.json'));
  const engineRequire = createRequire(join(consumer, 'node_modules/@metriccanvas/engine/package.json'));
  assert.equal(json(consumerRequire.resolve('svelte/package.json')).version, version);
  assert.equal(json(engineRequire.resolve('svelte/package.json')).version, version);
  for (const name of names) assert(realpathSync(join(consumer, 'node_modules/@metriccanvas', name)).startsWith(consumer + '/'), 'Installed package points back into workspace');

  for (const path of ['packages/metric-canvas/tests/browser', 'packages/embed/tests/browser', 'packages/embed/examples', 'packages/embed/tests/serve.mjs', 'packages/embed/tests/dqe-fixture-endpoint.mjs', 'tools/dqe-sim/fixtures/ioc-opportunity-list.json', 'tools/dqe-sim/fixtures/ioc-dimension-values.json', 'tools/dqe-sim/fixtures/ioc-page-datasets.json', 'packages/engine/widgets/tests/responsive-fixtures.ts', 'contracts/metriccanvas/page/reference/examples', 'packages/page/fixtures/contract-valid/query-cascade-page.json', 'packages/page/fixtures/contract-valid/detail-views.json', 'packages/page/fixtures/contract-valid/url-navigation-page.json', 'packages/page/fixtures/contract-valid/dimension-params-page.json', 'packages/page/fixtures/parameter-extraction/tokens-parameter-source.json', 'pages']) {
    cpSync(join(source, path), join(consumer, path), { recursive: true });
  }
  // 既有浏览器用例与断言不变；类型导入改为已安装包，不能读取本仓 src。
  for (const file of ['embed.spec.ts', 'version-error.spec.ts', 'execution.spec.ts', 'globals.d.ts']) {
    const path = join(consumer, 'packages/embed/tests/browser', file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll("'../../src/types'", "'@metriccanvas/embed'").replaceAll("'../../src'", "'@metriccanvas/embed'"));
  }
  cpSync(join(consumer, 'node_modules/@metriccanvas/embed/dist'), join(consumer, 'packages/embed/dist'), { recursive: true });
  for (const [from, to] of [['consumer-vite.config.js', 'vite.config.js'], ['consumer-playwright.config.ts', 'playwright.config.ts'], ['browser-versions.mjs', 'browser-versions.mjs']]) cpSync(join(source, 'tools/package-build/fixtures', from), join(consumer, to));
  writeFileSync(join(consumer, 'svelte.config.js'), 'export default {};\n');
  writeJson(join(consumer, 'tsconfig.json'), {
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, allowJs: true, checkJs: true, skipLibCheck: false, verbatimModuleSyntax: true, esModuleInterop: true, types: ['node'] },
    include: ['packages/metric-canvas/tests/browser/harness/**/*', 'ports.ts']
  });
  const imports = ['@metriccanvas/data-execution', '@metriccanvas/data-execution/runtime', '@metriccanvas/data-execution/dqe', '@metriccanvas/data-execution/node', '@metriccanvas/ui', '@metriccanvas/page', '@metriccanvas/engine', '@metriccanvas/engine/widgets', '@metriccanvas/engine/ui', '@metriccanvas/engine/ui/types', '@metriccanvas/engine/ui/composition', '@metriccanvas/engine/dqe', '@metriccanvas/metric-canvas', '@metriccanvas/metric-canvas/types', '@metriccanvas/embed'];
  writeFileSync(join(consumer, 'ports.ts'), imports.map((name, index) => `export * as Entry${index} from '${name}';`).join('\n'));
  const bin = (name) => join(consumer, 'node_modules/.bin', name);
  run(bin('svelte-check'), ['--tsconfig', './tsconfig.json'], consumer, join(logs, 'consumer-svelte-check.log'));
  run(bin('tsc'), ['--noEmit', '-p', 'tsconfig.json'], consumer, join(logs, 'consumer-types.log'));
  run(bin('vite'), ['build'], consumer, join(logs, 'consumer-build.log'));
  cpSync(join(source,'packages/ui/tests/browser/components.spec.ts'),join(uiOnly,'components.spec.ts'));
  writeFileSync(join(uiOnly,'playwright.config.mjs'),`import {defineConfig} from '${consumer.replaceAll('\\','/')}/node_modules/@playwright/test/index.mjs';export default defineConfig({testDir:'.',testMatch:'components.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:4183',channel:'chrome',headless:true,viewport:{width:1440,height:900}},webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4183 --strictPort',url:'http://127.0.0.1:4183',reuseExistingServer:false}});`);
  // Browser runner is a test tool from the combined fixture, never a UI runtime dependency.
  writeFileSync(join(uiOnly,'components.spec.ts'),readFileSync(join(uiOnly,'components.spec.ts'),'utf8').replace("from '@playwright/test'",`from '${consumer.replaceAll('\\','/')}/node_modules/@playwright/test/index.mjs'`).replace('/tests/browser/index.html','/'));
  run(bin('playwright'),['test','--config=playwright.config.mjs'],uiOnly,join(logs,'ui-browser.log'));
  run(bin('playwright'), ['test'], consumer, join(logs, 'consumer-browser.log'));
  const browserResults = json(join(consumer, 'browser-results.json'));
  assert.equal(browserResults.stats.unexpected, 0);
  assert.equal(browserResults.stats.skipped, 0);
  assert(browserResults.stats.expected > 0, 'Browser suite did not run any tests');
  const browsers = json(join(consumer, 'browser-versions.json'));
  const requestedBrowsers=(process.env.METRICCANVAS_TEST_BROWSERS??'chrome,msedge').split(',').sort();
  assert.deepEqual(Object.keys(browsers).sort(),requestedBrowsers,'Requested real browsers must all run');
  const completeBrowserMatrix=JSON.stringify(requestedBrowsers)===JSON.stringify(['chrome','msedge']);
  summary.versions.push({ svelte: version, isolatedSource: source !== root, consumer, browsers, requiredBrowsers:['chrome','msedge'],completeBrowserMatrix, tests: browserResults.stats });
  writeJson(join(output, 'summary.json'), summary);
}
console.log(JSON.stringify(summary, null, 2));
