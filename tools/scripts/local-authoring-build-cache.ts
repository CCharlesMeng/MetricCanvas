import type { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';

export interface LocalBuildCacheOptions {
  cache?: boolean;
  cacheDir?: string;
}

export interface LocalBuildResult {
  outputs: Map<string, string>;
  files: Iterable<string>;
  inputDigests?: ReadonlyMap<string, string>;
  directories: Iterable<string>;
}

interface FileStamp { location: string; digest: string; target: string }
interface DirectoryStamp { location: string; target: string; names: string[] }
interface CacheRecord {
  format: 1;
  identity: string;
  inputDigest: string;
  files: FileStamp[];
  directories: DirectoryStamp[];
  outputs: Array<[string, string]>;
  outputDigest: string;
}

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const slash = (value: string) => value.split(path.sep).join('/');
const require = createRequire(import.meta.url);
const cacheFormat = 'metriccanvas-local-build/1';
const cacheStats = {hits: 0, misses: 0, disabled: 0};
export function getLocalBuildCacheStats() { return {...cacheStats}; }

/** Logical locations allow identical source/dependency bytes in another checkout. */
function location(root: string, file: string): string {
  const relative = path.relative(root, file);
  if (relative === 'node_modules' || relative.startsWith('node_modules/')) return `dependency/${slash(relative)}`;
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return `source/${slash(relative)}`;
  const dependency = file.indexOf(`${path.sep}node_modules`);
  if (dependency >= 0) return `dependency/${slash(file.slice(dependency + 1))}`;
  throw new Error('Uncacheable external build input');
}

function physical(root: string, value: string): string {
  const [kind, ...parts] = value.split('/');
  if (!['source', 'dependency'].includes(kind) || parts.includes('..')) throw new Error('Invalid cache location');
  return path.join(root, ...parts);
}

async function names(root: string, folder: string): Promise<string[]> {
  try {
    const entries = await readdir(folder, {withFileTypes: true});
    return (await Promise.all(entries.map(item => entryName(root, folder, item)))).sort();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return [];
    throw error;
  }
}

async function entryName(root: string, folder: string, item: Dirent): Promise<string> {
  if (item.isSymbolicLink()) return `${item.name}@${await siblingLinkTarget(root, folder, item.name)}`;
  return `${item.name}${item.isDirectory() ? '/' : ''}`;
}

async function siblingLinkTarget(root: string, folder: string, name: string): Promise<string> {
  const actualFolder = await realpath(folder);
  const actual = await realpath(path.join(folder, name)).catch(() => undefined);
  if (!actual) return 'missing';
  // Shared pnpm installations can contain unrelated workspace links outside an
  // isolated checkout. Their relative target is stable across checkout roots.
  if (actualFolder.includes('/node_modules') && !actual.includes('/node_modules')) {
    return `workspace/${slash(path.relative(actualFolder, actual))}`;
  }
  return location(root, actual);
}

async function directoryTarget(root: string, folder: string): Promise<string> {
  try {
    const actual = await realpath(folder);
    // A package's node_modules scope may be a shared symlink in an isolated
    // checkout. Keep its physical identity locally so retargeting the entire
    // scope cannot keep reading an old installation through stable module ids.
    if (path.basename(folder) === 'node_modules') return `scope/${slash(actual)}`;
    return location(root, actual);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return 'missing';
    throw error;
  }
}

function stableNodePath(folder: string): string {
  const dependency = folder.indexOf('node_modules');
  return dependency < 0 ? folder : folder.slice(dependency);
}

function nodePaths(): string[] {
  return (process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean);
}

/** Read tool bytes as well as versions: patched esbuild installations cannot hit an old record. */
async function builderIdentity(): Promise<unknown> {
  const main = require.resolve('esbuild');
  const metadataFile = require.resolve('esbuild/package.json');
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
  const nativePackage = `@esbuild/${process.platform}-${process.arch}`;
  const executable = process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild';
  const binary = process.env.ESBUILD_BINARY_PATH ?? require.resolve(`${nativePackage}/${executable}`, {paths: [path.dirname(main)]});
  return {node: process.version, platform: process.platform, arch: process.arch, esbuild: metadata.version, nodePath: nodePaths().map(stableNodePath), typescript: ts.version,
    bytes: await Promise.all([main, metadataFile, binary, require.resolve('typescript'), require.resolve('typescript/package.json')].map(async file => digest(await readFile(file))))};
}

async function cacheIdentity(identity: unknown): Promise<string> {
  return digest(JSON.stringify({format: cacheFormat, identity, builder: await builderIdentity()}));
}

function isConfig(name: string): boolean {
  return /^(?:tsconfig|jsconfig)(?:\.[^.]+)*\.json$/.test(name);
}

function resolutionBoundary(root: string, folder: string): string {
  const dependency = folder.indexOf(`${path.sep}node_modules${path.sep}`);
  return dependency < 0 ? root : folder.slice(0, dependency) + '/node_modules';
}

/** Fixed absent metadata probes detect a newly introduced resolver config. */
async function ancestorMetadata(root: string, folder: string, files: Set<string>): Promise<void> {
  const boundary = resolutionBoundary(root, folder);
  let current = folder;
  while (current.startsWith(boundary)) {
    for (const name of ['package.json', 'tsconfig.json', 'jsconfig.json']) files.add(path.join(current, name));
    if (current === boundary) break;
    current = path.dirname(current);
  }
}

async function fileDigest(file: string): Promise<string> {
  try { return digest(await readFile(file)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

function extendedConfig(config: string, request: string): string {
  if (!request.startsWith('.')) return require.resolve(request, {paths: [path.dirname(config)]});
  const file = path.resolve(path.dirname(config), request);
  return path.extname(file) ? file : `${file}.json`;
}

async function configDependencies(root: string, file: string, files: Set<string>, directories: Set<string>, visited: Set<string>): Promise<void> {
  if (visited.has(file)) return;
  visited.add(file);
  const contents = await readFile(file, 'utf8').catch(() => undefined);
  if (contents === undefined) return;
  const parsed = ts.parseConfigFileTextToJson(file, contents);
  if (parsed.error) throw new Error('Uncacheable invalid resolver config');
  const config = parsed.config;
  const extensions = config.extends ? [config.extends].flat() as string[] : [];
  for (const request of extensions) {
    const parent = extendedConfig(file, request);
    files.add(parent);
    await ancestorMetadata(root, path.dirname(parent), files);
    if (!request.startsWith('.')) observeResolution(root, path.dirname(file), request, directories);
    await configDependencies(root, parent, files, directories, visited);
  }
  if (config.compilerOptions?.paths || config.compilerOptions?.baseUrl) {
    // Alias candidate discovery needs the full target tree; a conservative name
    // inventory is restricted to configured alias roots, never the whole repo.
    const base = path.resolve(path.dirname(file), config.compilerOptions.baseUrl ?? '.');
    const targets = Object.values(config.compilerOptions.paths ?? {}).flat() as string[];
    const folders = targets.length ? targets.map(aliasFolder) : ['.'];
    for (const folder of folders) await directoryTree(path.resolve(base, folder), directories);
  }
}

function aliasFolder(target: string): string {
  const prefix = target.split('*')[0];
  return prefix.endsWith('/') ? prefix.slice(0, -1) : path.dirname(prefix);
}

async function directoryTree(folder: string, directories: Set<string>, visited = new Set<string>()): Promise<void> {
  const canonical = await realpath(folder).catch(() => folder);
  directories.add(folder);
  if (visited.has(canonical)) return;
  visited.add(canonical);
  const entries = await readdir(folder, {withFileTypes: true}).catch(() => []);
  for (const entry of entries) {
    if ((entry.isDirectory() || entry.isSymbolicLink()) && entry.name !== 'node_modules') {
      await directoryTree(path.join(folder, entry.name), directories, visited);
    }
  }
}

async function trackedInputs(root: string, result: LocalBuildResult): Promise<{files: Set<string>; directories: Set<string>}> {
  const files = new Set(result.files);
  const directories = new Set(result.directories);
  for (const file of [...files]) await ancestorMetadata(root, path.dirname(file), files);
  const visited = new Set<string>();
  for (const file of [...files].filter(file => isConfig(path.basename(file)))) await configDependencies(root, file, files, directories, visited);
  for (const name of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock',
    '.pnp.cjs', '.pnp.data.json', '.yarnrc.yml', 'node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml', 'node_modules/.package-map.json']) {
    const file = path.join(root, name);
    files.add(file);
  }
  return {files, directories};
}

async function stampFile(root: string, file: string, expected?: string): Promise<FileStamp> {
  const actual = await fileDigest(file);
  if (expected && actual !== expected) throw new Error('Build input changed while bundling');
  return {location: location(root, file), target: await directoryTarget(root, file), digest: actual};
}

async function recordBuild(root: string, identity: string, result: LocalBuildResult): Promise<CacheRecord> {
  const inputs = await trackedInputs(root, result);
  const files = await Promise.all([...inputs.files].map(file => stampFile(root, file, result.inputDigests?.get(file))));
  const directories = await Promise.all([...inputs.directories].map(async folder => ({location: location(root, folder), target: await directoryTarget(root, folder), names: await names(root, folder)})));
  files.sort((a, b) => a.location.localeCompare(b.location));
  directories.sort((a, b) => a.location.localeCompare(b.location));
  const inputDigest = digest(JSON.stringify({identity, files, directories}));
  const outputs = [...result.outputs];
  return {format: 1, identity, inputDigest, files, directories, outputs, outputDigest: digest(JSON.stringify(outputs))};
}

async function validRecord(root: string, record: CacheRecord, identity: string): Promise<boolean> {
  if (record.format !== 1 || record.identity !== identity || !record.files.length || !record.outputs.length) return false;
  if (digest(JSON.stringify(record.outputs)) !== record.outputDigest) return false;
  if (digest(JSON.stringify({identity, files: record.files, directories: record.directories})) !== record.inputDigest) return false;
  const files = await Promise.all(record.files.map(async file => await fileDigest(physical(root, file.location)) === file.digest &&
    await directoryTarget(root, physical(root, file.location)) === file.target));
  if (!files.every(Boolean)) return false;
  const directories = await Promise.all(record.directories.map(async folder =>
    await directoryTarget(root, physical(root, folder.location)) === folder.target &&
    JSON.stringify(await names(root, physical(root, folder.location))) === JSON.stringify(folder.names)));
  return directories.every(Boolean);
}

async function readCache(root: string, file: string, identity: string): Promise<Map<string, string> | undefined> {
  try {
    const record: CacheRecord = JSON.parse(await readFile(file, 'utf8'));
    return await validRecord(root, record, identity) ? new Map(record.outputs) : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(file: string, record: CacheRecord): Promise<void> {
  const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(temporary, JSON.stringify(record));
    await rename(temporary, file);
  } finally {
    await rm(temporary, {force: true});
  }
}

async function hasExternalResolverConfig(root: string): Promise<boolean> {
  let folder = path.dirname(root);
  while (true) {
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      if (await fileDigest(path.join(folder, name)) !== 'missing') return true;
    }
    if (folder === path.dirname(folder)) break;
    folder = path.dirname(folder);
  }
  return false;
}

function relocateInputs(result: LocalBuildResult, originalRoot: string, root: string): LocalBuildResult {
  const relocate = (file: string) => file.startsWith(originalRoot + path.sep) ? path.join(root, path.relative(originalRoot, file)) : file;
  return {...result, files: [...result.files].map(relocate), directories: [...result.directories].map(relocate),
    inputDigests: new Map([...(result.inputDigests ?? [])].map(([file, value]) => [relocate(file), value]))};
}

/** Disposable local acceleration. Any unavailable/unverifiable cache runs the original build. */
export async function withLocalBuildCache(root: string, identity: unknown, options: LocalBuildCacheOptions,
  build: () => Promise<LocalBuildResult>): Promise<Map<string, string>> {
  if (options.cache === false || process.env.METRICCANVAS_LOCAL_BUILD_CACHE === '0' || await hasExternalResolverConfig(root).catch(() => true)) {
    cacheStats.disabled++;
    return (await build()).outputs;
  }
  const originalRoot = root;
  root = await realpath(root);
  let key: string;
  try { key = await cacheIdentity(identity); } catch { cacheStats.disabled++; return (await build()).outputs; }
  const folder = options.cacheDir ?? path.join(tmpdir(), 'metriccanvas-local-build-cache-v1');
  const file = path.join(folder, `${key}.json`);
  const cached = await readCache(root, file, key);
  if (cached) { cacheStats.hits++; return cached; }
  cacheStats.misses++;
  const result = await build();
  try { await writeCache(file, await recordBuild(root, key, relocateInputs(result, originalRoot, root))); } catch { /* Cache failure cannot fail a valid build. */ }
  return result.outputs;
}

/** Resolver observations include missing higher priority candidates and nearer packages. */
export function observeResolution(root: string, resolveDir: string, request: string, directories: Set<string>): void {
  if (request.startsWith('.') || path.isAbsolute(request)) {
    const target = path.resolve(resolveDir, request);
    directories.add(path.dirname(target));
    directories.add(target);
    return;
  }
  if (request.startsWith('node:')) return;
  const packageName = request.startsWith('@') ? request.split('/').slice(0, 2).join('/') : request.split('/')[0];
  for (const folder of nodePaths()) {
    directories.add(folder);
    directories.add(path.join(folder, packageName));
  }
  const boundary = resolutionBoundary(root, resolveDir);
  let folder = resolveDir;
  while (folder.startsWith(boundary)) {
    directories.add(path.join(folder, 'node_modules'));
    directories.add(path.join(folder, 'node_modules', packageName));
    if (folder === boundary) break;
    folder = path.dirname(folder);
  }
}
