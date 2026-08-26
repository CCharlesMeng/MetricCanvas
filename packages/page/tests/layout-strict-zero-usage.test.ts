import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate } from '../src';

/**
 * 组件 `layout` 补 `.strict()` 是一次**收紧**,按 ADR-0051 的例外行使:
 * 从未被行使的开放面可以按次版本收紧。例外的第二条判据要求零使用由测试
 * 或脚本证明、并随收紧一并落地——本文件就是那份证明。
 *
 * 扫描口径按判据一:`pages/` 下的全部存量页面文档,加 `packages/*​/fixtures/`
 * 下的全部校验样例。模板引用与冻结报告指向的已发布修订当前都由这些文档
 * 承载(仓内还没有独立的修订存档),因此同一份扫描即覆盖三者。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const pagesDir = path.join(repoRoot, 'pages');
const packagesDir = path.join(repoRoot, 'packages');

/** `layout` 上今天允许的全部键;与 `componentLayoutZ` 的形状同源。 */
const declaredLayoutKeys = ['span', 'connectPrevious', 'layer'];

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

/** 文档里每一处 `layout` 对象的键;不认组件类型,只按属性名找。 */
function layoutKeysIn(value: unknown, at = ''): Array<{ path: string; key: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => layoutKeysIn(item, `${at}/${index}`));
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = `${at}/${key}`;
    const own =
      key === 'layout' && typeof child === 'object' && child !== null && !Array.isArray(child)
        ? Object.keys(child).map((layoutKey) => ({ path: childPath, key: layoutKey }))
        : [];
    return [...own, ...layoutKeysIn(child, childPath)];
  });
}

describe('layout 补 strict：ADR-0051 例外的零使用证明', () => {
  const scanned = [...jsonFilesIn(pagesDir), ...fixtureFiles()];

  it('扫描口径覆盖存量页面文档与全部校验样例', () => {
    expect(jsonFilesIn(pagesDir).length).toBeGreaterThan(0);
    expect(fixtureFiles().length).toBeGreaterThan(0);
  });

  it('没有任何文档在 layout 上写过未声明的键', () => {
    const unknown = scanned.flatMap((file) => {
      const document: unknown = JSON.parse(readFileSync(file, 'utf8'));
      return layoutKeysIn(document)
        .filter((usage) => !declaredLayoutKeys.includes(usage.key))
        .map((usage) => `${path.relative(repoRoot, file)}${usage.path}/${usage.key}`);
    });
    expect(unknown).toEqual([]);
  });

  it('收紧生效：写错的键名不再静默通过', () => {
    const page = {
      schemaVersion: '5.2',
      id: 'layout-strict-probe',
      dataSources: {},
      sections: [
        {
          id: 'body',
          components: [
            {
              id: 'note',
              type: 'text',
              layout: { span: 12, spans: 6 },
              props: { body: '说明' }
            }
          ]
        }
      ]
    };
    expect(validate(page)).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/0/layout/spans' })
    );
  });
});
