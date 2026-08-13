import { handleAgentStreamRequest } from '$lib/server/agent/stream-endpoint';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/**
 * Agent 步骤事件服务端推送端点(#32):按步骤下发 AgentRunStreamEvent,
 * 协议与消费方式见 $lib/server/agent/stream-endpoint.ts 模块注释。
 * 既有非流式端点(../+server.ts)保留,供确定性测试使用。
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const services = await getPlatformServices();
  return handleAgentStreamRequest({ request, identity: locals.identity, services });
};
