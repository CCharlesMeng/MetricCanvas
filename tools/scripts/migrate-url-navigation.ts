/** Offline migration only. Never rewrite persisted immutable revisions in place. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { filterURLKeys, isNavigationHref, type FilterDeclaration } from '../../packages/page/src/internal';

type Json = Record<string, any>;
export function migrateURLNavigation(input: Json, urls: Readonly<Record<string, string>>): Json {
  const document = structuredClone(input);
  if (!/^5\.[0-4]$/.test(document.schemaVersion)) throw new Error('迁移只接受 5.0–5.4 页面');
  const filters = new Map<string, FilterDeclaration>((document.filters ?? []).map((f: FilterDeclaration) => [f.id, f]));
  function target(old: Json): Json {
    const href = urls[old.page];
    if (!href || !isNavigationHref(href)) throw new Error(`缺少有效的部署 URL 映射:${old.page}`);
    const query: Json = {};
    for (const id of old.carryFilters ?? []) {
      const filter = filters.get(id);
      if (!filter) throw new Error(`缺少来源筛选器:${id}`);
      for (const [part, key] of Object.entries(filterURLKeys(filter))) query[key] = { source:'filter', id, ...(part !== 'value' ? {part} : {}) };
    }
    for (const bindings of [old.setFilters, old.setParams]) {
      for (const [key, binding] of Object.entries(bindings ?? {})) {
        if (typeof binding !== 'string' && (binding as Json).data !== 'main') throw new Error('非 main 行绑定需作者显式迁移');
        query[key] = {source:'row', field: typeof binding === 'string' ? binding : (binding as Json).field};
      }
    }
    return { href, ...(Object.keys(query).length ? {query} : {}) };
  }
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Json;
    if (node.navigate?.page) node.navigate = target(node.navigate);
    if (node.type === 'text' && node.props?.links) {
      node.props.links = node.props.links.map((link: Json) => ({label:link.label, ...target(link)}));
    }
    for (const [key, child] of Object.entries(node)) if (key !== 'dataSources') visit(child);
  }
  visit(document);
  document.schemaVersion = '6.0';
  return document;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [inputPath, urlsPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !urlsPath || !outputPath || resolve(inputPath) === resolve(outputPath)) {
    throw new Error('用法: tsx tools/scripts/migrate-url-navigation.ts <旧页面.json> <部署URL映射.json> <新页面.json>；输入输出不能相同');
  }
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const urls = JSON.parse(await readFile(urlsPath, 'utf8'));
  await writeFile(outputPath, JSON.stringify(migrateURLNavigation(input, urls), null, 2) + '\n', {flag:'wx'});
}
