import { canonicalizeJson, parsePage, type TypedError } from '@metriccanvas/page';
import { createHash } from 'node:crypto';

/**
 * 检查点是新的服务端持久化边界:即使上游 Agent 或客户端已校验,
 * 写入前仍再跑一次页面校验,防止绕过正常工作台路径写入不可恢复文档。
 */
export function checkpointDocument(
  document: Record<string, unknown> | null
):
  | { ok: true; document: Record<string, unknown> | null; contentHash: string }
  | { ok: false; errors: TypedError[] } {
  if (document !== null) {
    const parsed = parsePage(document);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
  }
  const cloned = document === null ? null : structuredClone(document);
  return {
    ok: true,
    document: cloned,
    contentHash: createHash('sha256').update(canonicalizeJson(cloned)).digest('hex')
  };
}
