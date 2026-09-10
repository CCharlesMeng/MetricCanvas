import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

describe('纯前端静态平台边界', () => {
  it('不包含 SvelteKit 服务端入口或服务端页面资产依赖', () => {
    const forbiddenEntries = walk(join(appRoot, 'src'))
      .map((file) => relative(appRoot, file))
      .filter((file) =>
        file.endsWith('+server.ts') ||
        file.endsWith('+page.server.ts') ||
        file.endsWith('+layout.server.ts') ||
        file.endsWith('hooks.server.ts') ||
        file.includes('/lib/server/')
      );
    expect(forbiddenEntries).toEqual([]);

    const manifest = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const dependency of [
      '@sveltejs/adapter-node',
      '@metriccanvas/page-assets-java',
      '@metriccanvas/page-lifecycle',
      '@metriccanvas/persistence-postgres'
    ]) {
      expect(declared).not.toHaveProperty(dependency);
    }
  });

  it('使用带 SPA fallback 的 adapter-static', () => {
    const config = readFileSync(join(appRoot, 'svelte.config.js'), 'utf8');
    expect(config).toContain("from '@sveltejs/adapter-static'");
    expect(config).toContain("fallback: 'index.html'");
    expect(config).not.toContain('adapter-node');
  });
});

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
