import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AnalysisSessionStore } from './store';

/**
 * 分析会话回放端点(GET /api/sessions/{sessionId})的实现(#69,ADR-0030)。
 *
 * 会话按 sessionId 返回全量步骤事件流,供刷新后的工作台按会话 id 回放。
 * 可见性过滤在存储内真实执行(仅归属者本人与平台管理员可见):不可见与
 * 不存在同响应 404,不经由错误码暴露他人会话的存在性——端点不做第二份
 * 权限判断,身份原样传给存储。
 */
export async function handleSessionReplayRequest(input: {
  sessionId: string;
  identity: LifecycleContext;
  sessions: Pick<AnalysisSessionStore, 'getSession'>;
}): Promise<Response> {
  const result = await input.sessions.getSession(
    { sessionId: input.sessionId },
    input.identity
  );
  if (!result.ok) {
    return json(404, { error: { code: result.error.code, message: result.error.message } });
  }
  return json(200, { ok: true, session: result.session });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
