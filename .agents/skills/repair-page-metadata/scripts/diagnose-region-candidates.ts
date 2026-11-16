#!/usr/bin/env -S pnpm exec tsx

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parsePage } from '../../../../packages/page/src/validate';
import { conditionSourceIds, sourceFilterIds } from '../../../../packages/page/src/data-source-references';
import { candidateDependencies, iocHeaderDeclaration, type Page } from '../../../../packages/page/src/internal';
import { validFilterCandidates } from '../../../../packages/data-execution/src/filter-candidates';
import { parseFilterSearch } from '../../../../packages/engine/runtime/src/filter-state';
import { candidateScopeKey, type DimensionValuesSnapshot } from '../../../../packages/engine/runtime/src/dimension-values';
import { pendingIocRegionURL, resolveIocRegionURL } from '../../../../packages/engine/runtime-ui/src/ioc-region-default';

function readJson(path: string): { bytes: Buffer; document: unknown } {
  const bytes = readFileSync(path);
  try { return { bytes, document: JSON.parse(bytes.toString('utf8')) }; }
  catch { throw new Error('输入文件不是合法 JSON'); }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function receipt(value: unknown, levels: string[]): DimensionValuesSnapshot {
  if (!record(value)) throw new Error('候选回执须包含 status');
  const { status, candidates } = value;
  if (status === 'ready' && Array.isArray(candidates) && validFilterCandidates(candidates, levels)) return { status, candidates };
  if (status === 'empty' || status === 'loading') return { status };
  if (status === 'denied' || status === 'unavailable' || status === 'unconfigured') return { status };
  if (status === 'error') return { status, error: { code: 'UNKNOWN', message: '候选回执失败' } };
  throw new Error('候选回执状态或候选结构无效');
}

function readReceipts(path: string | undefined, levels: string[]) {
  const receipts = new Map<string, DimensionValuesSnapshot>();
  if (!path) return receipts;
  const { document } = readJson(path);
  if (!record(document)) throw new Error('候选回执须按层级 ID 索引');
  for (const [level, value] of Object.entries(document)) {
    if (!levels.includes(level)) throw new Error('候选回执包含未声明的层级');
    receipts.set(level, receipt(value, levels));
  }
  return receipts;
}

function declaredFilters(page: Page, sourceId: string): string[] {
  const filters = new Map(page.filters?.map(filter => [filter.id, filter]));
  const ids = new Set([...conditionSourceIds(page, sourceId)].flatMap(id => sourceFilterIds(page.dataSources[id])));
  for (const id of ids) {
    const filter = filters.get(id);
    if (filter) for (const dependency of candidateDependencies(filter)) ids.add(dependency);
  }
  return [...ids].sort();
}

function replayValueOnly(input: NonNullable<ReturnType<typeof pendingIocRegionURL>>, receipts: Map<string, DimensionValuesSnapshot>) {
  const snapshots = new Map<string, DimensionValuesSnapshot>();
  for (const level of input.declaration.hierarchy ?? []) {
    const snapshot = receipts.get(level.id);
    if (snapshot) snapshots.set(candidateScopeKey('region', level.dimension, level.id, ''), snapshot);
  }
  const resolved = resolveIocRegionURL(input, snapshots, '');
  if (!resolved) return { stage: 'region-candidate-resolution', state: 'pending' };
  if ('issue' in resolved) return { stage: 'region-candidate-resolution', state: 'rejected', issue: resolved.issue };
  return { stage: 'region-candidate-resolution', state: 'resolved', level: resolved.value.type === 'dimension' ? resolved.value.level : undefined };
}

function inspectExplicitRegion(page: Page, search: string, receipts: Map<string, DimensionValuesSnapshot>) {
  const region = parseFilterSearch(search, page.filters ?? [], new Date(), true).get('region');
  if (region?.type !== 'dimension' || !region.level) return { stage: 'url-input', state: 'no-parsed-region' };
  if (!region.values.length) return { stage: 'url-input', state: 'level-only', level: region.level };
  const observed = receipts.get(region.level);
  if (!observed) return { stage: 'region-candidate-validation', state: 'unobserved', level: region.level };
  const selected = region.values;
  const accepted = observed.status === 'ready' && selected.every(value => observed.candidates.some(
    item => item.level === region.level && !item.disabled && item.value === value
  ));
  return {
    stage: 'region-candidate-validation', level: region.level, state: observed.status === 'ready'
      ? (accepted ? 'matched' : 'rejected')
      : observed.status
  };
}

function main(argv: string[]): number {
  try {
    const { positionals, values } = parseArgs({
      args: argv, allowPositionals: true,
      options: { source: { type: 'string' }, search: { type: 'string' }, 'region-receipts': { type: 'string' } }
    });
    if (positionals.length !== 1 || values.search === undefined || !values.source) {
      throw new Error('用法：diagnose-region-candidates.ts <page.json> --source <id> --search <query> [--region-receipts <file.json>]');
    }
    const { bytes, document } = readJson(positionals[0]!);
    const parsed = parsePage(document);
    if (!parsed.ok) {
      const error = parsed.errors[0]!;
      console.log(JSON.stringify({ stage: 'page-validation', issue: { type: error.type, path: error.path }, dqeRequest: 'not-observed' }));
      return 1;
    }
    const { page } = parsed;
    if (!Object.hasOwn(page.dataSources, values.source)) throw new Error('页面未声明该数据源');
    const region = page.filters?.find(filter => filter.id === 'region');
    if (region?.type !== 'dimension' || !region.hierarchy || !iocHeaderDeclaration(page)?.filterIds?.includes('region')) {
      throw new Error('页面未声明 IOC Region 层级筛选');
    }
    const receipts = readReceipts(values['region-receipts'], region.hierarchy.map(level => level.id));
    const pending = pendingIocRegionURL(page, values.search);
    const diagnostic = pending ? replayValueOnly(pending, receipts) : inspectExplicitRegion(page, values.search, receipts);
    const filters = declaredFilters(page, values.source);
    console.log(JSON.stringify({
      pageId: page.id, schemaVersion: record(document) ? document.schemaVersion : undefined,
      runtimeSchemaVersion: page.schemaVersion, sha256: createHash('sha256').update(bytes).digest('hex'),
      sourceId: values.source, sourcePath: `/dataSources/${values.source}`,
      declaresRegionDependency: filters.includes('region'), declaredFilterIds: filters.slice(0, 12), declaredFilterCount: filters.length,
      filterId: 'region', ...diagnostic, receipts: Object.fromEntries(region.hierarchy.map(
        level => [level.id, receipts.get(level.id)?.status ?? 'unobserved']
      )),
      dqeRequest: 'not-observed'
    }));
    return 0;
  } catch (cause) {
    console.error(JSON.stringify({ error: cause instanceof Error ? cause.message : '候选诊断失败' }));
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
