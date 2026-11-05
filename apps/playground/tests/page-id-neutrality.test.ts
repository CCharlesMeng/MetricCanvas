import { pageFiles } from '../../../tools/scripts/page-files.mjs';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

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
    // Prototype routes may link to concrete examples; runtime product logic stays page-neutral.
    if (entry.isDirectory() && entry.name === 'prototypes') return [];
    if (entry.isDirectory()) return productSourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

const versionRegistry = resolve(repoRoot, 'packages/page/src/version.ts');

// Capability identifiers can match example ids. Mask only registry keys; a page id
// used inside a capability predicate is still product logic and must be rejected.
function pageIdCheckSource(file: string, source: string): string {
  if (file !== versionRegistry) return source;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const characters = source.split('');
  function maskRegistryKeys(expression: ts.Expression): void {
    const value = ts.isSatisfiesExpression(expression) ? expression.expression : expression;
    if (!ts.isObjectLiteralExpression(value)) return;
    for (const property of value.properties) {
      if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) {
        characters.fill(' ', property.name.getStart(ast), property.name.end);
      }
    }
  }
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
        node.name.text === 'pageCapabilities' && node.initializer) maskRegistryKeys(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return characters.join('');
}

describe('页面 id 中立性', () => {
  it.each(['', ' satisfies Record<string, unknown>'])('仅忽略能力登记键，保留真实分支检查（%s）', annotation => {
    const declaration = `export const pageCapabilities = {'example-page': {minor:89}}${annotation};`;
    expect(pageIdCheckSource(versionRegistry, declaration)).not.toContain('example-page');
    const predicate = `export const pageCapabilities = {'example-page': {usedAt: page => page.id === 'example-page'}}${annotation};`;
    expect(pageIdCheckSource(versionRegistry, predicate)).toContain('example-page');
    expect(pageIdCheckSource(resolve(repoRoot, 'packages/page/src/validate.ts'), declaration)).toContain('example-page');
  });

  it('产品源码不得根据任何正式页面 id 分支', () => {
    const pageIds = pageFiles(resolve(repoRoot, 'pages'))
      .map((name) => JSON.parse(readFileSync(resolve(repoRoot, 'pages', name), 'utf8')) as { id: string })
      .map((page) => page.id);
    const violations = productSourceRoots.flatMap(productSourceFiles).flatMap((file) => {
      const source = pageIdCheckSource(file, readFileSync(file, 'utf8'));
      return pageIds.filter((id) => source.includes(id)).map((id) => ({ file, id }));
    });

    expect(violations).toEqual([]);
  });
});
