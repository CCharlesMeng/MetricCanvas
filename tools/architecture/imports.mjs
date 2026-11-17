import { posix as path } from 'node:path';
import ts from 'typescript';
import { parse } from 'svelte/compiler';
import { isModule, layerOf } from './source-tree.mjs';
import { pathResolver } from './paths.mjs';

function moduleReference(node) {
  if (ts.isImportDeclaration(node)) {
    return [node.moduleSpecifier.text, node.importClause?.isTypeOnly];
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    return [node.moduleSpecifier.text, node.isTypeOnly];
  }
  if (ts.isImportTypeNode(node)) return [node.argument.literal?.text, true];
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return [node.moduleReference.expression.text, node.isTypeOnly];
  }
  if (!ts.isCallExpression(node)) return;
  const call = node.expression;
  if (call.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(call) && call.text === 'require')) {
    const arg = node.arguments[0];
    return [arg && ts.isStringLiteralLike(arg) ? arg.text : undefined, false];
  }
}

function scriptReferences(file, script) {
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw Error(file + ': ' + ts.flattenDiagnosticMessageText(ast.parseDiagnostics[0].messageText, '\n'));
  const found = [];
  function visit(node) {
    const ref = moduleReference(node);
    if (ref) {
      if (!ref[0]) throw Error(file + ': cannot resolve computed module at line ' + (ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1));
      found.push(ref);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

function templateImports(node, found, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ImportExpression') {
    const spec = node.source.value ?? literalTemplate(node.source);
    if (typeof spec !== 'string') throw Error(file + ': unresolved import in Svelte template');
    found.push([spec, false]);
  }
  for (const child of Object.values(node)) templateImports(child, found, file);
}

function literalTemplate(node) {
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
}

function references(file, source) {
  if (!file.endsWith('.svelte')) return scriptReferences(file, source);
  const ast = parse(source, { modern: true, filename: file });
  const found = [ast.module, ast.instance].filter(Boolean).flatMap(({ content }) =>
    scriptReferences(file + '.ts', source.slice(content.start, content.end)));
  templateImports(ast.fragment, found, file);
  return found;
}

// Collect the source exports used by supported consumers. Declaration targets are type-only.
function targets(value) {
  if (typeof value === 'string') return [value];
  if (!value) return [];
  return Object.entries(value).filter(([condition]) => condition !== 'types').flatMap(([, target]) => targets(target));
}

function workspaceExports(tree) {
  const aliases = new Map();
  for (const [file, json] of tree) {
    if (!file.endsWith('/package.json')) continue;
    const manifest = JSON.parse(json);
    for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
      const spec = manifest.name + (subpath === '.' ? '' : subpath.slice(1));
      aliases.set(spec, targets(value).map(target => path.join(path.dirname(file), target)));
    }
  }
  return aliases;
}

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.svelte'];
function sourceFile(tree, name) {
  if (tree.has(name)) return name;
  const stem = name.replace(/\.mjs$/, '.mts').replace(/\.cjs$/, '.cts').replace(/\.jsx?$/, '');
  const candidates = [stem, ...extensions.flatMap(ext => [stem + ext, path.join(stem, 'index' + ext)])];
  const source = candidates.find(file => tree.has(file));
  if (source) return source;
  if (layerOf(name) !== 'outside') throw Error('unresolved source module ' + name);
  return name;
}

function resolveValue(spec, file, tree, aliases, mappedPath) {
  const [name, query] = spec.split('?');
  if (query === 'raw' || query === 'url' || /\.(?:svg|png|json|css)$/.test(name)) return [];
  if (name.startsWith('.')) return [sourceFile(tree, path.join(path.dirname(file), name))];
  const mapped = mappedPath(name, file);
  if (mapped) return [mapped];
  const exported = aliases.get(name);
  if (exported) return exported.map(target => sourceFile(tree, target));
  if (/^(@metriccanvas\/(?:engine|page|data-execution|ui)(?:\/|$)|[$#]|\/)/.test(name)) throw Error('unresolved source alias ' + name);
  return ['npm:' + name];
}

export function dependencyGraph(tree) {
  const aliases = workspaceExports(tree);
  const mappedPath = pathResolver(tree);
  const graph = new Map();
  let typeReferences = 0;
  for (const [file, source] of tree) {
    if (!isModule(file)) continue;
    const edges = new Set();
    for (const [spec, typeOnly] of references(file, source)) {
      if (typeOnly) typeReferences++;
      else for (const target of resolveValue(spec, file, tree, aliases, mappedPath)) edges.add(target);
    }
    graph.set(file, edges);
  }
  return { graph, typeReferences };
}
