import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/internal';

/**
 * 「层级维度筛选器不许写恒定 `queryField`」是一次**收紧**(ADR-0084),按
 * ADR-0051 的例外在 6.8 行使:从未被行使的开放面可以按次版本收紧。例外的
 * 第二条判据要求零使用由测试或脚本证明、并随收紧一并落地——本文件是那份证明。
 *
 * 扫描口径按判据一:`pages/` 下的全部存量页面文档,加 `packages/*​/fixtures/`
 * 下的全部校验样例。模板引用与冻结报告指向的已发布修订当前都由这些文档
 * 承载(仓内还没有独立的修订存档),因此同一份扫描即覆盖三者。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const pagesDir = path.join(repoRoot, 'pages');
const packagesDir = path.join(repoRoot, 'packages');

function jsonFilesIn(dir: string): string[] {
  if (!existsDir(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsonFilesIn(full);
    return entry.isFile() && entry.name.endsWith('.json') ? [full] : [];
  });
}

function existsDir(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fixtureFiles(): string[] {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => jsonFilesIn(path.join(packagesDir, entry.name, 'fixtures')));
}

type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

/** 文档里每一处「层级筛选器被恒定 queryField 绑定」的位置。 */
function flatBindingsOnHierarchy(document: unknown): string[] {
  const page = record(document);
  if (!page) return [];
  const filters = Array.isArray(page.filters) ? page.filters : [];
  const hierarchical = new Set(
    filters.flatMap((candidate) => {
      const filter = record(candidate);
      const hierarchy = filter?.hierarchy;
      return filter?.type === 'dimension' &&
        typeof filter.id === 'string' &&
        Array.isArray(hierarchy) &&
        hierarchy.length > 0
        ? [filter.id]
        : [];
    })
  );
  if (hierarchical.size === 0) return [];
  return Object.entries(record(page.dataSources) ?? {}).flatMap(([sourceId, candidate]) => {
    const bindings = record(record(record(record(candidate)?.source)?.query)?.filterBindings);
    return Object.entries(bindings ?? {}).flatMap(([filterId, rawBinding]) => {
      const binding = record(rawBinding);
      return hierarchical.has(filterId) && binding?.target === 'dimension' &&
        Object.hasOwn(binding, 'queryField')
        ? [`/dataSources/${sourceId}/source/query/filterBindings/${filterId}`]
        : [];
    });
  });
}

describe('层级筛选绑定收紧：ADR-0051 例外的零使用证明', () => {
  const scanned = [...jsonFilesIn(pagesDir), ...fixtureFiles()];

  it('扫描口径覆盖存量页面文档与全部校验样例', () => {
    expect(jsonFilesIn(pagesDir).length).toBeGreaterThan(0);
    expect(fixtureFiles().length).toBeGreaterThan(0);
  });

  it('没有任何文档用恒定 queryField 绑定层级维度筛选器', () => {
    const used = scanned.flatMap((file) =>
      flatBindingsOnHierarchy(JSON.parse(readFileSync(file, 'utf8'))).map(
        (pointer) => `${path.relative(repoRoot, file)}${pointer}`
      )
    );
    expect(used).toEqual([]);
  });

  it('扫描口径本身有效：确实找得出这种写法', () => {
    expect(
      flatBindingsOnHierarchy({
        filters: [
          {
            id: 'area',
            type: 'dimension',
            dimension: 'code',
            hierarchy: [
              { id: 'province', dimension: 'code' },
              { id: 'city', dimension: 'city_code' }
            ]
          }
        ],
        dataSources: {
          regions: {
            source: {
              type: 'query',
              query: { filterBindings: { area: { target: 'dimension', queryField: 'code' } } }
            }
          }
        }
      })
    ).toEqual(['/dataSources/regions/source/query/filterBindings/area']);
  });

  it('收紧生效：层级筛选器写恒定 queryField 不再静默通过', () => {
    const page = JSON.parse(
      readFileSync(path.join(repoRoot, 'packages/page/fixtures/contract-valid/map-page.json'), 'utf8')
    ) as Json;
    expect(validate(page)).toEqual([]);
    const source = record(record(record(page.dataSources)?.regions)?.source)!;
    (record(source.query)!.filterBindings as Json).area = {
      target: 'dimension',
      queryField: 'code'
    };
    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/regions/source/query/filterBindings/area/queryField'
      })
    );
  });
});
