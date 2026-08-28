import { handleSessionReplayRequest } from '$lib/server/session/replay-endpoint';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/**
 * 分析会话恢复(#69,ADR-0058):读取全量步骤事件流与最新检查点。
 * 可见性过滤由会话存储真实执行;换 mock 用户读他人会话返回 404。
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const { sessions } = await getPlatformServices();
  return handleSessionReplayRequest({
    sessionId: params.sessionId,
    identity: locals.identity,
    sessions
  });
};
