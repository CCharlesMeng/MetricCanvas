import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const sourceExtensions = new Set(['.css', '.js', '.json', '.svelte', '.ts']);

/**
 * 正式渲染通道:统一运行时、Runtime UI、纯渲染组件、Embed 与 Canvas 应用。
 * 开发期查询明细(DqeDevDetail)与查询检查器(QueryInspector)只允许出现在
 * 页面搭建或开发通道,不得进入这些包——因此生产构建也不可能通过普通
 * 页面参数把它们开起来(issue #47)。
 */
const renderChannelRoots = [
  'packages/runtime/src',
  'packages/runtime-ui/src',
  'packages/widgets/src',
  'packages/embed/src',
  'apps/canvas/src'
].map((root) => resolve(repoRoot, root));

const forbiddenTokens = ['QueryInspector', 'DqeDevDetail', 'createDqeDevDetail', 'devDetail'];

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe('查询诊断的渲染通道隔离', () => {
  it('正式渲染通道不包含 QueryInspector 与开发期明细通道', () => {
    const violations = renderChannelRoots
      .filter(existsSync)
      .flatMap(sourceFiles)
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8').toLowerCase();
        return forbiddenTokens
          .filter((token) => source.includes(token.toLowerCase()))
          .map((token) => ({ file: relative(repoRoot, file), token }));
      });

    expect(violations).toEqual([]);
  });
});
