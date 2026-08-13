import type { AnalysisStepEvent } from '../server/session/step-event';
import { applyStreamEvent, createRunView, type WorkbenchRunView } from './run-state';

/**
 * 会话回放(#69,ADR-0030):把落库的分析会话事件流物化为工作台时间线视图。
 *
 * 落库的步骤事件(AnalysisStepEvent)是推送流事件的子集,逐条经 run-state
 * 的同一状态机回放——回放与实时消费共用一份事件→视图映射,不写第二份。
 * 回放视图是只读的已完成运行:没有续跑基线与页面文档(它们只存在于
 * outcome 帧,ADR-0030 刻意不落库),用于刷新后按会话 id 复看全部步骤。
 */

/** GET /api/sessions/{sessionId} 返回的会话形状(服务端 AnalysisSession 的客户端视图)。 */
export interface RecordedSessionPayload {
  sessionId: string;
  question: string | null;
  events: Array<{ sequence: number; occurredAt: string; event: AnalysisStepEvent }>;
}

export function sessionReplayView(session: RecordedSessionPayload): WorkbenchRunView {
  const initial: WorkbenchRunView = {
    ...createRunView({
      runId: `session-replay-${session.sessionId}`,
      question: session.question
    }),
    sessionId: session.sessionId
  };
  const replayed = session.events.reduce(
    (view, recorded) => applyStreamEvent(view, recorded.event),
    initial
  );
  return { ...replayed, status: 'completed' };
}
