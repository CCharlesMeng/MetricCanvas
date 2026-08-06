import { createHash } from 'node:crypto';
import { canonicalizeJson, type PageDocument } from '@metriccanvas/page';
import type {
  JSONValue,
  JsonDiffEntry,
  LifecycleContext,
  LifecycleError,
  LifecycleErrorCode,
  LifecycleRole,
  PageRevision,
  RevisionResult
} from './types';

/**
 * memory 与 postgres 两份实现共用的纯函数。任何一处逻辑差异都会导致
 * 两份实现出现行为漂移（参见 tests/*.contract.ts），因此这些函数只
 * 允许有一份实现。
 */

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hasQueryDataSource(page: PageDocument): boolean {
  return Object.values(page.dataSources).some(
    (dataSource) => dataSource.source.type === 'query'
  );
}

export function pageListLimit(value: number | undefined): number {
  if (!Number.isInteger(value) || value === undefined || value < 1) return 50;
  return Math.min(value, 100);
}

export function hasRole(context: LifecycleContext, role: LifecycleRole): boolean {
  return context.roles?.includes(role) === true;
}

export function lifecycleFailure(
  code: LifecycleErrorCode,
  message: string
): { ok: false; error: LifecycleError } {
  return { ok: false, error: { code, message } };
}

export function revisionConflict(
  message: string,
  currentLatestRevision: PageRevision | null
): RevisionResult {
  return {
    ok: false,
    error: { code: 'REVISION_CONFLICT', message, currentLatestRevision }
  };
}

/**
 * 数组按下标逐元素比较（而不是整体替换）：两个数组共享前缀的元素
 * 递归 diff，多出的尾部元素记为逐个 add/remove。这与 JSON Patch
 * 对数组的常规处理一致，也是 `/api/pages/[pageId]/revisions/diff`
 * 需要的精度。
 */
export function diffJson(before: JSONValue, after: JSONValue, path = ''): JsonDiffEntry[] {
  if (canonicalizeJson(before) === canonicalizeJson(after)) return [];
  if (isJsonObject(before) && isJsonObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => {
      const childPath = `${path}/${escapeJsonPointer(key)}`;
      if (!(key in before)) return [{ op: 'add' as const, path: childPath, after: after[key] }];
      if (!(key in after)) return [{ op: 'remove' as const, path: childPath, before: before[key] }];
      return diffJson(before[key], after[key], childPath);
    });
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: JsonDiffEntry[] = [];
    const sharedLength = Math.min(before.length, after.length);
    for (let index = 0; index < sharedLength; index += 1) {
      changes.push(...diffJson(before[index], after[index], `${path}/${index}`));
    }
    for (let index = sharedLength; index < before.length; index += 1) {
      changes.push({ op: 'remove', path: `${path}/${index}`, before: before[index] });
    }
    for (let index = sharedLength; index < after.length; index += 1) {
      changes.push({ op: 'add', path: `${path}/${index}`, after: after[index] });
    }
    return changes;
  }
  return [{ op: 'replace', path, before, after }];
}

function isJsonObject(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
