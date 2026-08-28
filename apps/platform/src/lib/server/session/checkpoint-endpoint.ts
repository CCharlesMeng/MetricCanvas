import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AnalysisSessionStore, SessionPinnedComponent } from './store';
import { checkpointDocument } from './checkpoint-document';

/**
 * 工作台本地编辑的检查点写入。Agent 终态由推送端点在服务端直接
 * 保存;本端点只承接拖动、换组件等不经 Agent 的有效文档改写。
 */
export async function handleSessionCheckpointUpdate(input: {
  sessionId: string;
  request: Request;
  identity: LifecycleContext;
  sessions: Pick<AnalysisSessionStore, 'updateCheckpoint'>;
}): Promise<Response> {
  let body: unknown;
  try {
    body = await input.request.json();
  } catch {
    return json(400, { error: { code: 'INVALID_REQUEST', message: '请求体不是合法 JSON' } });
  }
  if (!isCheckpointUpdate(body)) {
    return json(400, {
      error: { code: 'INVALID_REQUEST', message: '检查点版本、页面文档或钉住状态不合法' }
    });
  }
  const checked = checkpointDocument(body.document);
  if (!checked.ok || checked.document === null) {
    return json(422, {
      error: {
        code: 'INVALID_PAGE_DOCUMENT',
        message: '页面文档未通过校验',
        details: checked.ok ? [] : checked.errors.slice(0, 20)
      }
    });
  }
  const result = await input.sessions.updateCheckpoint(
    {
      sessionId: input.sessionId,
      expectedVersion: body.expectedVersion,
      document: checked.document,
      contentHash: checked.contentHash,
      pinnedComponents: body.pinnedComponents
    },
    input.identity
  );
  if (!result.ok) {
    if (result.error.code === 'SESSION_CHECKPOINT_STALE') {
      return json(409, { error: result.error });
    }
    // 与会话读接口保持一致:不向非所有者泄露指定会话是否存在。
    return json(404, {
      error: { code: 'SESSION_NOT_FOUND', message: `会话 ${input.sessionId} 不存在` }
    });
  }
  return json(200, {
    ok: true,
    checkpoint: {
      version: result.checkpoint.version,
      contentHash: result.checkpoint.contentHash,
      updatedAt: result.checkpoint.updatedAt
    }
  });
}

function isCheckpointUpdate(value: unknown): value is {
  expectedVersion: number;
  document: Record<string, unknown>;
  pinnedComponents: SessionPinnedComponent[];
} {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.expectedVersion) &&
    (value.expectedVersion as number) >= 1 &&
    isRecord(value.document) &&
    Array.isArray(value.pinnedComponents) &&
    value.pinnedComponents.length <= 20 &&
    value.pinnedComponents.every(isPinnedComponent)
  );
}

function isPinnedComponent(value: unknown): value is SessionPinnedComponent {
  return (
    isRecord(value) &&
    typeof value.dataSourceId === 'string' &&
    value.dataSourceId.length > 0 &&
    value.dataSourceId.length <= 100 &&
    typeof value.componentType === 'string' &&
    value.componentType.length > 0 &&
    value.componentType.length <= 100
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
