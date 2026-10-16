import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Resolve from this script so both profiles also work outside the package cwd.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(appRoot, '../..');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--debug')) {
  throw Error('Usage: node pack-microfrontend.mjs [--debug]');
}
const debug = args[0] === '--debug';
const profile = debug ? 'debug' : 'production';
const dist = resolve(appRoot, debug ? 'dist/microfrontend-debug' : 'dist/microfrontend');
const version = process.env.METRICCANVAS_PLATFORM_VERSION || '1.0.0-rc.1';
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw Error('Invalid platform release version');
const hash = data => createHash('sha256').update(data).digest('hex');
const files = directory => readdirSync(directory).sort().flatMap(name => {
  const path = resolve(directory, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

for (const [target, source] of [
  ['portal-contract.d.ts', 'src/lib/integration/contract.ts'],
  ['compose-deployment.mjs', 'scripts/compose-deployment.mjs'],
  ['pack-deployment.mjs', 'scripts/pack-deployment.mjs']
]) writeFileSync(resolve(dist, target), readFileSync(resolve(appRoot, source)));

const artifacts = files(dist).filter(path => path !== resolve(dist, 'release.json'));
const maps = artifacts.filter(path => path.endsWith('.map'));
if (!debug && maps.length) throw Error('生产目录不能包含 source map。');
if (debug) {
  const script = readFileSync(resolve(dist, 'assets/platform.umd.js'), 'utf8');
  if (!script.includes('//# sourceMappingURL=platform.umd.js.map')) throw Error('调试入口缺少 source map 引用。');
  const map = JSON.parse(readFileSync(resolve(dist, 'assets/platform.umd.js.map'), 'utf8'));
  if (map.version !== 3 || !map.mappings || !map.sources.some(source => source.endsWith('/src/microfrontend/entry.ts')) ||
      !map.sources.some(source => source.endsWith('/PlatformRoot.svelte')) ||
      !Array.isArray(map.sourcesContent) || map.sourcesContent.length !== map.sources.length ||
      map.sourcesContent.some(content => typeof content !== 'string')) throw Error('调试包缺少完整 TS/Svelte 源码映射。');
  for (const path of maps) {
    const contents = readFileSync(path, 'utf8');
    if (contents.includes(root) || contents.includes('/Users/') || contents.includes('/home/')) throw Error('源码映射包含构建机绝对路径。');
  }
}
// Readable Rolldown output annotates module regions; these are not runtime imports.
const script = artifacts.filter(path => path.endsWith('.js')).map(path => readFileSync(path, 'utf8'))
  .join('\n').replace(/^\s*\/\/#(?:end)?region[^\n]*$/gm, '');
// __METRICCANVAS_PANGU__ is the public URL/version seam used by the default
// dialogue adapter. Portal-specific user sources and development wiring stay forbidden.
for (const forbidden of ['local-dev', 'developer-1', '__fixtures/', 'currentLoginUser', 'node_modules/', 'process.env.NODE_ENV', root]) {
  if (script.includes(forbidden)) throw Error(`产物包含禁止内容: ${forbidden}`);
}

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'})
  .split('\0').filter(Boolean);
const sourceFiles = [...new Set(tracked)].filter(path => /^(apps\/platform\/(src|scripts)\/|packages\/(page|engine|metric-canvas|application-runtime|ui|data-execution)\/|apps\/platform\/(package.json|vite.config.ts|svelte.config.js|index.html)|pnpm-lock.yaml|package.json)/.test(path)).sort();
const sourceHash = createHash('sha256');
for (const path of sourceFiles) {
  try {
    if (statSync(resolve(root, path)).isFile()) {
      sourceHash.update(path + '\0');
      sourceHash.update(readFileSync(resolve(root, path)));
      sourceHash.update('\0');
    }
  } catch { /* Git can list paths deleted from a dirty worktree. */ }
}
const manifest = {
  version, profile, deploymentContractVersion: '1',
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim(),
  sourceTreeSha256: sourceHash.digest('hex'), entry: 'index.html',
  routeBase: 'runtime prop; any normalized path prefix', qiankunCandidate: '2.10.16',
  targetPortal: 'NOT_RUN', realServices: 'NOT_RUN',
  files: Object.fromEntries(artifacts.map(path => [relative(dist, path).split('\\').join('/'), hash(readFileSync(path))]))
};
writeFileSync(resolve(dist, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
const archive = resolve(appRoot, `dist/metriccanvas-platform-${version}${debug ? '-debug' : ''}.tar.gz`);
execFileSync('tar', ['-czf', archive, '-C', dist, '.']);
const sha256 = hash(readFileSync(archive));
writeFileSync(`${archive}.sha256`, `${sha256}  ${relative(resolve(appRoot, 'dist'), archive)}\n`);
console.log(JSON.stringify({profile, archive, sha256, sourceTreeSha256: manifest.sourceTreeSha256, files: artifacts.length}, null, 2));
