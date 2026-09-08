import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** 交付物的源码入口。`embed` 的 exports 指向构建产物，这里锁它的源码入口。 */
export const artifacts: Record<string, { manifest: string; entries: Record<string, string> }> = {
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
  const candidates = fromFile.endsWith('.d.ts')
    ? [base.replace(/\.js$/, '.d.ts'), base]
    : [base, `${base}.ts`, resolve(base, 'index.ts')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && /\.(?:ts|js)$/.test(candidate)) return candidate;
  }
  return undefined;
}

export function exportedNames(file: string, seen = new Set<string>(), valuesOnly = false): string[] {
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
      if (valuesOnly && statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (!clause) {
        // `export * from './m'`：公开面等于被转出模块的全部导出，必须展开。
        const specifier = (statement.moduleSpecifier as ts.StringLiteral | undefined)?.text;
        const target = specifier ? resolveModule(file, specifier) : undefined;
        if (!target) throw new Error(`${relative(root, file)} 的 export * 无法解析：${specifier}`);
        names.push(...exportedNames(target, seen, valuesOnly));
      } else if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if (!valuesOnly || !element.isTypeOnly) names.push(element.name.text);
        }
      } else {
        names.push(clause.name.text);
      }
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (valuesOnly && (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))) continue;
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

export function renderSnapshot(name: string, entries: Record<string, string>): string {
  const sections = Object.entries(entries).map(([subpath, entry]) => {
    const names = [...new Set(exportedNames(resolve(root, entry)))].sort();
    return `## ${subpath}\n${names.join('\n')}`;
  });
  return `# ${name}\n\n${sections.join('\n\n')}\n`;
}
