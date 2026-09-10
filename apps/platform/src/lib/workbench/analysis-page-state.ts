import { validate, type PageDocument } from '@metriccanvas/page';

export type AnalysisPagePhase =
  | 'idle' | 'processing' | 'waiting' | 'page' | 'text' | 'failed' | 'cancelled';

export interface AnalysisPageSnapshot {
  document: PageDocument | null;
  phase: AnalysisPagePhase;
  previousPage: boolean;
}

/**
 * #108 / ADR-0077 的本地页面接收状态。handle 仅属于本实例的一轮处理，
 * 不是盘古 requestId、会话标识或持久化检查点。页面读取适配器须先验证
 * 身份、产物来源、hash/version，再调用 acceptVerifiedPage；这里复验页面协议。
 * 不映射 SDK 事件，也不把消息流 finish 自动解释为“只有文本”。
 */
export function createAnalysisPageState() {
  let active: symbol | null = null;
  let state: AnalysisPageSnapshot = { document: null, phase: 'idle', previousPage: false };

  function finish(handle: symbol, phase: 'waiting' | 'text' | 'failed' | 'cancelled'): boolean {
    if (active !== handle) return false;
    active = null;
    state = { ...state, phase };
    return true;
  }

  return {
    snapshot(): AnalysisPageSnapshot {
      return structuredClone(state);
    },

    begin(): symbol {
      active = Symbol('analysis-turn');
      state = { ...state, phase: 'processing', previousPage: state.document !== null };
      return active;
    },

    /** 结束本轮并等待回应；确认后的新轮必须 begin，旧轮产物不能越过确认。 */
    waitForConfirmation(handle: symbol): boolean {
      return finish(handle, 'waiting');
    },

    /** text 仅表示已确定本轮无页面，不是消息流结束事件。 */
    finishWithoutPage(handle: symbol, outcome: 'text' | 'failed'): boolean {
      return finish(handle, outcome);
    },

    /** 仅取消本地接收资格，不代表已调用或确认服务端取消。 */
    cancel(handle: symbol): boolean {
      return finish(handle, 'cancelled');
    },

    acceptVerifiedPage(handle: symbol, document: PageDocument): 'accepted' | 'stale' | 'invalid' {
      if (active !== handle) return 'stale';
      if (validate(document).length > 0) return 'invalid';
      state = { document: structuredClone(document), phase: 'page', previousPage: false };
      active = null;
      return 'accepted';
    },

    /** 显式清空/删除或切换分析会话时调用；旧异步回调全部失效。 */
    reset(): void {
      active = null;
      state = { document: null, phase: 'idle', previousPage: false };
    }
  };
}
