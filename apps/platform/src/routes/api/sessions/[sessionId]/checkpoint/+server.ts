import { handleSessionCheckpointUpdate } from '$lib/server/session/checkpoint-endpoint';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/** 保存已有会话的本地有效页面编辑;乐观并发冲突返回 409。 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const { sessions } = await getPlatformServices();
  return handleSessionCheckpointUpdate({
    sessionId: params.sessionId,
    request,
    identity: locals.identity,
    sessions
  });
};
