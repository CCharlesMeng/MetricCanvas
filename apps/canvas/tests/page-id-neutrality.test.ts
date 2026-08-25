import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const sourceExtensions = new Set(['.css', '.js', '.json', '.svelte', '.ts']);

const productSourceRoots = ['apps', 'packages'].flatMap((scope) =>
  readdirSync(resolve(repoRoot, scope), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(repoRoot, scope, entry.name, 'src'))
    .filter(existsSync)
);

function productSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return productSourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe('页面 id 中立性', () => {
  it('产品源码不得根据任何正式页面 id 分支', () => {
    const pageIds = readdirSync(resolve(repoRoot, 'pages'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(resolve(repoRoot, 'pages', name), 'utf8')) as { id: string })
      .map((page) => page.id);
    const violations = productSourceRoots.flatMap(productSourceFiles).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return pageIds.filter((id) => source.includes(id)).map((id) => ({ file, id }));
    });

    expect(violations).toEqual([]);
  });
});
