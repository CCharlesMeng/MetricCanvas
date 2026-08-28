import { askStateMessage } from '../ask/conversation';
import type { AnalysisStepEvent } from '../server/session/step-event';
import type { AnalysisSessionCheckpoint } from '../server/session/store';
import {
  applyOutcome,
  applyStreamEvent,
  createRunView,
  type WorkbenchRunView
} from './run-state';

/**
 * 会话回放(#69,ADR-0030):把落库的分析会话事件流物化为工作台时间线视图。
 *
 * 落库的步骤事件(AnalysisStepEvent)是推送流事件的子集,逐条经 run-state
 * 的同一状态机回放——回放与实时消费共用一份事件→视图映射,不写第二份。
 * 步骤事件还原过程,最新检查点还原临时页面态与结构化续跑
 * 基线。两者分工:不把整份页面文档重复塞入每条 document_ready 事件。
 */

/** GET /api/sessions/{sessionId} 返回的会话形状(服务端 AnalysisSession 的客户端视图)。 */
export interface RecordedSessionPayload {
  sessionId: string;
  question: string | null;
  events: Array<{ sequence: number; occurredAt: string; event: AnalysisStepEvent }>;
  /** 历史会话没有检查点,因此兼容缺省。 */
  checkpoint?: AnalysisSessionCheckpoint | null;
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
  const checkpoint = session.checkpoint ?? null;
  if (checkpoint === null) return { ...replayed, status: 'completed' };
  return applyOutcome(replayed, {
    status: checkpoint.status,
    messages: [askStateMessage(checkpoint.askState)],
    document: checkpoint.document,
    interaction: checkpoint.interaction,
    error: checkpoint.failure,
    checkpointVersion: checkpoint.version
  });
}
