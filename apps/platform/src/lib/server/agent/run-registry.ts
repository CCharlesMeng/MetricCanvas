import type { LifecycleContext } from '@metriccanvas/page-lifecycle';

/**
 * 进行中 Agent 运行的注册表:取消端点据此找到目标运行并中止它。
 *
 * 每个运行持有独立的 AbortController,按 runId 隔离,不存在跨运行共享的
 * 可变引用;取消即 controller.abort,信号贯穿模型调用与工具执行(Runner)。
 * 可见性与会话存储同一纪律:非本人且非平台管理员时,不存在与不可见同响应,
 * 不经由响应差异暴露他人运行的存在性。
 */
export interface ActiveAgentRun {
  runId: string;
  /** 运行归属者(发起请求的 actorId):取消权限的依据。 */
  actorId: string;
}

export interface RegisteredAgentRun {
  /** 该运行专属的取消信号:传给 Runner 的 run() 输入。 */
  signal: AbortSignal;
  /** 运行结束(完成、失败或取消)后释放 runId,允许同 runId 重试。 */
  finish(): void;
}

export type CancelAgentRunResult = 'cancelled' | 'not_found';

export interface AgentRunRegistry {
  /** 注册运行;同 runId 已有进行中的运行时拒绝(返回 null),防止并发重放。 */
  register(run: ActiveAgentRun): RegisteredAgentRun | null;
  /** 取消进行中的运行:本人或平台管理员可取消;其余情况一律 not_found。 */
  cancel(runId: string, context: LifecycleContext): CancelAgentRunResult;
}

export function createAgentRunRegistry(): AgentRunRegistry {
  const active = new Map<string, { actorId: string; controller: AbortController }>();

  return {
    register({ runId, actorId }) {
      if (active.has(runId)) return null;
      const controller = new AbortController();
      active.set(runId, { actorId, controller });
      return {
        signal: controller.signal,
        finish() {
          // 只清理自己这条注册:finish 与新一次 register 之间不存在窗口冲突,
          // 因为同 runId 在 finish 前无法再注册。
          active.delete(runId);
        }
      };
    },

    cancel(runId, context) {
      const run = active.get(runId);
      if (!run) return 'not_found';
      const isAdmin = context.roles?.includes('admin') ?? false;
      if (run.actorId !== context.actorId && !isAdmin) return 'not_found';
      run.controller.abort(new DOMException(`Agent 运行 ${runId} 已被取消`, 'AbortError'));
      return 'cancelled';
    }
  };
}
