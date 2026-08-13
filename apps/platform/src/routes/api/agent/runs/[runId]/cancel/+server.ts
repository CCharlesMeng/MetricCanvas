import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/**
 * 取消进行中的 Agent 运行(#32):中止信号贯穿模型调用与工具执行,
 * 推送端点随后下发 run_cancelled 与携带会话快照的 outcome 帧。
 * 仅运行归属者本人与平台管理员可取消;其余情况与不存在同响应(404),
 * 不经由响应差异暴露他人运行的存在性。
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  const { agentRuns } = await getPlatformServices();
  const result = agentRuns.cancel(params.runId, locals.identity);
  if (result === 'cancelled') {
    return json({ ok: true, runId: params.runId }, { headers: { 'cache-control': 'no-store' } });
  }
  return json(
    {
      ok: false,
      error: { code: 'AGENT_RUN_NOT_FOUND', message: `没有进行中的运行 ${params.runId}` }
    },
    { status: 404, headers: { 'cache-control': 'no-store' } }
  );
};
