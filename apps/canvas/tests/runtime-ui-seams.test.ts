import { readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const runtimeUiRoot = resolve(repoRoot, 'packages/runtime-ui/src');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.svelte', '.ts'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('Runtime UI Module Seam', () => {
  it('统一运行时不得通过全局 class 选择器修改纯渲染组件内部 DOM', () => {
    const violations = sourceFiles(runtimeUiRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/:global\(\.([^)]+)\)/gu)].map((match) => ({
        file,
        selector: match[0]
      }));
    });

    expect(violations).toEqual([]);
  });
});
