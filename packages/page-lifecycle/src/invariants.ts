import { createHash } from 'node:crypto';
import {
  canonicalizeJson,
  validate,
  versionPolicy,
  type PageDocument
} from '@metriccanvas/page';
import type {
  DataContextVersionProvider,
  JSONValue,
  JsonDiffEntry,
  LifecycleContext,
  LifecycleError,
  LifecycleErrorCode,
  LifecycleRole,
  PageRevision,
  PublishAuditAction,
  PublishRequestStatus,
  RevisionResult,
  SaveRevisionCommand
} from './types';

/**
 * memory 与 postgres 两份实现共用的业务不变式宿主。任何一处逻辑差异
 * 都会导致两份实现出现行为漂移（参见 tests/contract.ts），因此这里的
 * 判定只允许有一份实现：两份实现只负责各自的存储副作用（Map 写入 /
 * SQL 提交），乐观锁、修订号推导、租约活性、状态机转移与审计映射、
 * 发布授权矩阵、目录游标语义一律在此裁决。
 */

export const DEFAULT_PUBLISH_LEASE_MS = 15 * 60 * 1000;
export const PUBLISH_LEASE_EXPIRED_REASON = '15 分钟发布租约已到期';

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

/** 线性修订:下一个修订号只由当前最新修订推导。 */
export function nextRevisionNumber(latest: PageRevision | null): number {
  return (latest?.revisionNumber ?? 0) + 1;
}

/**
 * 保存修订的前置判定(乐观锁 + 首保确认)。返回 null 表示放行。
 * 首保:baseRevisionId 必须为 null 且必须显式确认页面 id;
 * 后续保存:基线必须是当前最新修订。
 */
export function saveRevisionPrecondition(
  pageExists: boolean,
  latest: PageRevision | null,
  command: Pick<SaveRevisionCommand, 'pageId' | 'baseRevisionId' | 'pageIdConfirmed'>
): RevisionResult | null {
  if (!pageExists) {
    if (command.baseRevisionId !== null) {
      return revisionConflict('首次保存的 baseRevisionId 必须为 null', null);
    }
    if (command.pageIdConfirmed !== true) {
      return lifecycleFailure(
        'PAGE_ID_CONFIRMATION_REQUIRED',
        `首次保存前必须确认页面 id ${command.pageId}`
      );
    }
    return null;
  }
  if (!latest || command.baseRevisionId !== latest.revisionId) {
    return revisionConflict(
      `保存基线不是当前最新页面修订:${latest?.revisionId ?? '无'}`,
      latest
    );
  }
  return null;
}

/** 保存文档的内容判定:结构校验 + 当前版本 + 命令与文档 id 一致。 */
export function checkSaveDocument(
  raw: unknown,
  pageId: string
): { ok: true; document: PageDocument } | { ok: false; error: LifecycleError } {
  const validationErrors = validate(raw);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      error: { code: 'INVALID_PAGE', message: '页面文档未通过校验', validationErrors }
    };
  }
  const document = raw as PageDocument;
  if (document.schemaVersion !== versionPolicy.current) {
    return lifecycleFailure(
      'INVALID_PAGE',
      `保存只接受当前 schemaVersion ${versionPolicy.current}`
    );
  }
  if (document.id !== pageId) {
    return lifecycleFailure(
      'PAGE_ID_MISMATCH',
      `命令页面 id ${pageId} 与页面文档 id ${document.id} 不一致`
    );
  }
  return { ok: true, document };
}

/** 构造下一个不可变页面修订:修订号推导、内容哈希、创作依据版本印章。 */
export async function buildPageRevision(input: {
  command: Pick<SaveRevisionCommand, 'pageId' | 'baseRevisionId'>;
  document: PageDocument;
  latest: PageRevision | null;
  revisionId: string;
  actorId: string;
  now: Date;
  dataContext: DataContextVersionProvider;
}): Promise<PageRevision> {
  return {
    revisionId: input.revisionId,
    revisionNumber: nextRevisionNumber(input.latest),
    pageId: input.command.pageId,
    baseRevisionId: input.command.baseRevisionId,
    document: input.document,
    contentHash: hash(canonicalizeJson(input.document)),
    dataContextVersion: hasQueryDataSource(input.document)
      ? (await input.dataContext.current()).version
      : null,
    createdBy: input.actorId,
    createdAt: input.now.toISOString()
  };
}

/**
 * 发布租约活性:pending 且未到期为 active(阻塞其它写入),
 * pending 已到期为 expired(待懒过期收尾),其余状态为 closed。
 */
export function publishLeaseState(
  status: PublishRequestStatus,
  expiresAt: Date | string,
  now: Date
): 'active' | 'expired' | 'closed' {
  if (status !== 'pending') return 'closed';
  return new Date(expiresAt).getTime() > now.getTime() ? 'active' : 'expired';
}

/**
 * 发布请求状态 → 审计动作的唯一映射:
 * `published` 记 `approved`,`pending` 记 `requested`,其余同名。
 */
export function publishAuditActionFor(status: PublishRequestStatus): PublishAuditAction {
  if (status === 'published') return 'approved';
  if (status === 'pending') return 'requested';
  return status;
}

export type PublishDecision = 'confirm' | 'reject' | 'cancel' | 'force_release';

/**
 * 发布决策授权矩阵的唯一定义。返回 null 表示放行:
 * confirm/reject 需 publisher 或 admin;cancel 需发起人本人或 admin;
 * force_release 仅 admin。
 */
export function publishDecisionForbidden(
  decision: PublishDecision,
  request: { requestedBy: string },
  context: LifecycleContext
): { ok: false; error: LifecycleError } | null {
  switch (decision) {
    case 'confirm':
      return hasRole(context, 'publisher') || hasRole(context, 'admin')
        ? null
        : lifecycleFailure('PUBLISH_FORBIDDEN', '确认发布需要 publisher 权限');
    case 'reject':
      return hasRole(context, 'publisher') || hasRole(context, 'admin')
        ? null
        : lifecycleFailure('PUBLISH_FORBIDDEN', '拒绝发布需要 publisher 权限');
    case 'cancel':
      return context.actorId === request.requestedBy || hasRole(context, 'admin')
        ? null
        : lifecycleFailure('PUBLISH_FORBIDDEN', '只有发起人或管理员可取消发布请求');
    case 'force_release':
      return hasRole(context, 'admin')
        ? null
        : lifecycleFailure('PUBLISH_FORBIDDEN', '强制释放发布租约需要 admin 权限');
  }
}

/** 发布请求与审计的可见性:发起人本人、publisher 或 admin。 */
export function canViewPublishRequest(
  request: { requestedBy: string },
  context: LifecycleContext
): boolean {
  return (
    request.requestedBy === context.actorId ||
    hasRole(context, 'publisher') ||
    hasRole(context, 'admin')
  );
}

/**
 * 页面目录游标语义的唯一定义:按 UTF-16 码点升序,游标严格大于。
 * PostgreSQL 侧通过 `COLLATE "C"` 对齐(BMP 字符与码点序一致);
 * memory 侧的排序与游标过滤必须都使用这一比较,不得混用 localeCompare。
 */
export function comparePageIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
