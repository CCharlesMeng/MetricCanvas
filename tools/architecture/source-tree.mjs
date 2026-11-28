import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const directories = new Map([
  ['packages/page/src/', 'page'],
  ['packages/data-execution/src/', 'data-execution'],
  ['packages/ui/src/', 'ui'],
  ['packages/embed/src/', 'embed'],
  ...['runtime', 'runtime-ui', 'widgets', 'data-gateway'].map((layer) => [
    'packages/engine/' + layer + '/src/',
    layer,
  ]),
]);

export function layerRelativePath(file) {
  if (file === 'packages/page/src/validate-cli.ts' || /\/(?:prototype|prototypes)\//.test(file))
    return;
  for (const [prefix, layer] of directories) {
    if (file.startsWith(prefix)) return { layer, relative: file.slice(prefix.length) };
  }
}

export function layerOf(file) {
  return layerRelativePath(file)?.layer ?? 'outside';
}

const isManifest = (file) => /^packages\/[^/]+\/package\.json$/.test(file);
export const isModule = (file) =>
  /\.(?:[cm]?[jt]sx?|svelte)$/.test(file) && !/\.d\.[cm]?ts$/.test(file);
const included = (file) =>
  isManifest(file) ||
  /^(?:packages\/[^/]+\/)?tsconfig(?:\.[^/]+)?\.json$/.test(file) ||
  (layerOf(file) !== 'outside' && isModule(file));
const inputs = ['packages', ':(top,glob)tsconfig*.json'];

function git(args, options = {}) {
  return execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024, ...options });
}

export function workingTree() {
  const paths = git(
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...inputs],
    { encoding: 'utf8' },
  );
  return new Map(
    paths
      .split('\0')
      .filter(included)
      .filter((file) => existsSync(file))
      .map((file) => [file, readFileSync(file, 'utf8')]),
  );
}

export function committedTree(ref) {
  const commit = git(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'], {
    encoding: 'utf8',
  }).trim();
  const paths = git(['ls-tree', '-rz', '--format=%(objectname) %(path)', commit], {
    encoding: 'utf8',
  });
  const entries = paths
    .split('\0')
    .map((line) => [line.slice(0, 40), line.slice(41)])
    .filter(([, file]) => included(file));
  const bytes = git(['cat-file', '--batch'], {
    input: entries.map(([oid]) => oid).join('\n') + '\n',
  });
  const tree = new Map();
  let offset = 0;
  for (const [, file] of entries) {
    const start = bytes.indexOf(10, offset) + 1;
    const size = Number(bytes.toString('ascii', offset, start - 1).split(' ')[2]);
    tree.set(file, bytes.toString('utf8', start, start + size));
    offset = start + size + 1;
  }
  return tree;
}
