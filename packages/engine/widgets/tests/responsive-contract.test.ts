import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentCatalog } from '@metriccanvas/page';
import { describe, expect, it } from 'vitest';
import { responsiveFixtures, responsiveQueryContracts } from './responsive-fixtures';

const componentsDir = new URL('../src/components/', import.meta.url);
const componentsPath = fileURLToPath(componentsDir);

function componentSources(): Array<{ file: string; source: string }> {
  return readdirSync(componentsDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const directory = join(componentsPath, entry.name);
    return readdirSync(directory)
      .filter((file) => file.endsWith('.svelte'))
      .map((file) => ({ file: `${entry.name}/${file}`, source: readFileSync(join(directory, file), 'utf8') }));
  });
}

describe('Page Component 响应式架构契约', () => {
  it('测试侧目录覆盖 schema 的全部 17 种组件与 53 个 variant 分支', () => {
    expect(Object.keys(responsiveFixtures).sort()).toEqual(
      componentCatalog.map(({ type }) => type).sort()
    );
    expect(Object.values(responsiveFixtures).flatMap(({ variants }) => variants)).toHaveLength(53);
  });

  it('纯渲染组件不读取 viewport 或页面身份', () => {
    for (const { file, source } of componentSources()) {
      expect(source, file).not.toMatch(/@media\s*\([^)]*(?:max-|min-)?width\s*:/m);
      expect(source, file).not.toMatch(
        /ioc-(?:project-overview|opportunity-analysis|opportunity-list|project-detail)/
      );
    }
  });

  it('每条离散尺寸容器查询都登记唯一响应契约', () => {
    const discovered: string[] = [];
    for (const { file, source } of componentSources()) {
      const queryPattern = /\/\*\s*responsive-contract:\s*([a-z0-9-]+)\s*\*\/[\s\S]{0,120}?@container\s*(?:[^({]+)?\([^)]*(?:max-|min-)?width\s*:[^)]+\)/gm;
      const declaredQueries = [...source.matchAll(queryPattern)].map((match) => match[1]!);
      const sizeQueries = [...source.matchAll(/@container\s*(?:[^({]+)?\([^)]*(?:max-|min-)?width\s*:[^)]+\)/gm)];
      expect(declaredQueries, `${file} 的尺寸查询必须紧邻 responsive-contract 注释`).toHaveLength(
        sizeQueries.length
      );
      discovered.push(...declaredQueries);
    }
    expect(new Set(discovered).size).toBe(discovered.length);
    expect(discovered.sort()).toEqual([...responsiveQueryContracts].sort());
  });

  it('布局所有者不保存已确认的页面派生根宽', () => {
    const sources = Object.fromEntries(componentSources().map((item) => [item.file, item.source]));
    expect(sources['composite-card/CompositeCard.svelte']).not.toMatch(/width:\s*1168px/);
    expect(sources['tab-container/TabContainer.svelte']).not.toMatch(/width:\s*(?:516|550)px/);
    expect(sources['table/Table.svelte']).not.toMatch(/width:\s*(?:518|532|1584)px/);
  });

  it('三个直接布局所有者都建立 mc-component-box', () => {
    const runtimeSection = readFileSync(
      new URL('../../runtime-ui/src/RuntimeSection.svelte', import.meta.url),
      'utf8'
    );
    const sources = Object.fromEntries(componentSources().map((item) => [item.file, item.source]));
    expect(runtimeSection).toMatch(/\.cell\s*\{[^}]*container:\s*mc-component-box\s*\/\s*inline-size/s);
    expect(sources['composite-card/CompositeCard.svelte']).toMatch(
      /\.composite-slot\s*\{[^}]*container:\s*mc-component-box\s*\/\s*inline-size/s
    );
    expect(sources['tab-container/TabContainer.svelte']).toMatch(
      /\.tab-panel\s*\{[^}]*container:\s*mc-component-box\s*\/\s*inline-size/s
    );
  });
});
