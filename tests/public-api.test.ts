import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * 四个交付物的公开面快照门禁(ADR-0071)。
 *
 * 交付物一旦发布，主入口与每个子路径导出的名字就是对外承诺。此前 `page` 主入口
 * 是 19 个 `export *`，公开面等于那 19 个模块的全部内容，新增符号会自动成为承诺
 * 且无人看见。快照把这件事变成显式的：任何名字进出都让门禁变红，评审时看到的
 * 是具体哪个符号。
 *
 * 枚举走语法解析而非运行时导入：`ui` 子路径导出 Svelte 组件，根 vitest 没有
 * svelte 插件，且公开面是「暴露了哪些名字」而不是「运行起来是什么值」。
 * 产物入口与源码入口的一致性由发布构建那张票单独接管。
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const snapshotDir = resolve(root, 'tests/public-api');
const update = process.env.UPDATE_PUBLIC_API === '1';

/** 交付物的源码入口。`embed` 的 exports 指向构建产物，这里锁它的源码入口。 */
const artifacts: Record<string, { manifest: string; entries: Record<string, string> }> = {
  '@metriccanvas/page': {
    manifest: 'packages/page/package.json',
    entries: {
      '.': 'packages/page/src/index.ts',
      './internal': 'packages/page/src/internal.ts'
    }
  },
  '@metriccanvas/engine': {
    manifest: 'packages/engine/package.json',
    entries: {
      '.': 'packages/engine/runtime/src/index.ts',
      './widgets': 'packages/engine/widgets/src/index.ts',
      './ui': 'packages/engine/runtime-ui/src/index.ts',
      './ui/types': 'packages/engine/runtime-ui/src/types.ts',
      './ui/composition': 'packages/engine/runtime-ui/src/composition.ts',
      './dqe': 'packages/engine/data-gateway/src/index.ts'
    }
  },
  '@metriccanvas/metric-canvas': {
    manifest: 'packages/metric-canvas/package.json',
    entries: {
      '.': 'packages/metric-canvas/src/index.ts',
      './types': 'packages/metric-canvas/src/types.ts'
    }
  },
  '@metriccanvas/embed': {
    manifest: 'packages/embed/package.json',
    entries: { '.': 'packages/embed/src/index.ts' }
  }
};

function resolveModule(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, resolve(base, 'index.ts'), base]) {
    if (existsSync(candidate) && candidate.endsWith('.ts')) return candidate;
  }
  return undefined;
}

function exportedNames(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ESNext,
    true
  );
  const names: string[] = [];

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (!clause) {
        // `export * from './m'`：公开面等于被转出模块的全部导出，必须展开。
        const specifier = (statement.moduleSpecifier as ts.StringLiteral | undefined)?.text;
        const target = specifier ? resolveModule(file, specifier) : undefined;
        if (!target) throw new Error(`${relative(root, file)} 的 export * 无法解析：${specifier}`);
        names.push(...exportedNames(target, seen));
      } else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) names.push(element.name.text);
      } else {
        names.push(clause.name.text);
      }
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
      names.push('default');
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name &&
      ts.isIdentifier(statement.name)
    ) {
      names.push(statement.name.text);
    }
  }

  return names;
}

function renderSnapshot(name: string, entries: Record<string, string>): string {
  const sections = Object.entries(entries).map(([subpath, entry]) => {
    const names = [...new Set(exportedNames(resolve(root, entry)))].sort();
    return `## ${subpath}\n${names.join('\n')}`;
  });
  return `# ${name}\n\n${sections.join('\n\n')}\n`;
}

describe('四个交付物的公开面', () => {
  for (const [name, artifact] of Object.entries(artifacts)) {
    it(`${name} 的导出名与快照一致`, () => {
      const file = resolve(snapshotDir, `${name.replace('@metriccanvas/', '')}.txt`);
      const actual = renderSnapshot(name, artifact.entries);
      if (update) {
        mkdirSync(snapshotDir, { recursive: true });
        writeFileSync(file, actual);
        return;
      }
      expect(existsSync(file), `缺少公开面快照 ${relative(root, file)}`).toBe(true);
      expect(actual).toBe(readFileSync(file, 'utf8'));
    });
  }

  it('每个交付物声明的子路径都被快照覆盖，新增子路径不能绕过门禁', () => {
    for (const [name, artifact] of Object.entries(artifacts)) {
      const manifest = JSON.parse(readFileSync(resolve(root, artifact.manifest), 'utf8')) as {
        exports?: Record<string, unknown>;
      };
      expect(Object.keys(manifest.exports ?? {}).sort(), `${name} 的 exports 与快照入口不一致`)
        .toEqual(Object.keys(artifact.entries).sort());
    }
  });
});
