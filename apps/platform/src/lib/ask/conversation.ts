import type { FormulaTrace } from '@metriccanvas/mcp';
import type { AgentMessage } from '../server/agent/types';
import type { AnalysisIntent } from '../server/session/step-event';
import type { AskDataRequestUnitState, RankedMetricCandidate } from '../server/ask/ports';

/**
 * 问数会话状态的往返契约(#66)。
 *
 * 编排的输入是「问题与会话上下文」:会话上下文以一条带前缀的 system 消息
 * 随 outcome.messages 往返(工作台把 outcome.messages 原样作为下一轮基线,
 * 服务端请求契约 workbench-request.ts 予以保留)。状态只承载结构化结果——
 * 路由域、生效取数单元、意图、临时页面 id、formula 留痕与待确认口径卡;
 * 不含对话文本与模型 prompt(ADR-0030 红线)。
 *
 * 放在 $lib/ask 而非 $lib/server:状态消息经推送通道往返于浏览器,本就是
 * 双端共享的线上契约。服务端编排(orchestrator)与工作台沉淀入口(#68 读
 * formulaTraces 作沉淀警告输入)共用这一份解析,不各写一份。模块保持纯
 * 函数,仅类型引用服务端契约声明。
 */

export const ASK_STATE_PREFIX = 'METRICCANVAS_ASK_STATE:';

/** 口径卡阻塞原因(ADR-0037 触发条件的已实现子集)。 */
export type ScopeBlockReason =
  | 'ambiguous_metric'
  | 'ad_hoc_definition'
  | 'model_completed_time';

/** 待人工确认的口径卡:阻塞原因、待执行单元与消歧候选。 */
export interface AskPendingScopeCard {
  interactionId: string;
  reasons: ScopeBlockReason[];
  /** 待执行的取数单元;歧义未决时 metrics 缺少歧义命中词对应的条目。 */
  unit: AskDataRequestUnitState;
  /** 歧义命中词(为空表示阻塞与消歧无关,普通确认即可执行)。 */
  ambiguousTerms: string[];
  candidates: RankedMetricCandidate[];
  /** 产生该卡的问题原文:确认续跑后 formula 留痕与页面说明仍锚定它。 */
  question: string;
}

export interface AskConversationState {
  version: 1;
  /** 生效业务域与是否经用户改写(改写记录是改进路由的信号,ADR-0037)。 */
  businessDomains: string[];
  domainsOverriddenByUser: boolean;
  /** 最近一次成功执行的取数单元;追问的增量修改基线。 */
  unit: AskDataRequestUnitState | null;
  intent: AnalysisIntent | null;
  transientPageId: string | null;
  /** 自由生成 formula 的留痕(ADR-0032);沉淀门槛(#68)的输入。 */
  formulaTraces: FormulaTrace[];
  pending: AskPendingScopeCard | null;
}

export function initialAskState(): AskConversationState {
  return {
    version: 1,
    businessDomains: [],
    domainsOverriddenByUser: false,
    unit: null,
    intent: null,
    transientPageId: null,
    formulaTraces: [],
    pending: null
  };
}

export function askStateMessage(state: AskConversationState): AgentMessage {
  return { role: 'system', content: ASK_STATE_PREFIX + JSON.stringify(state) };
}

export function isAskStateMessage(message: AgentMessage): boolean {
  return message.role === 'system' && message.content.startsWith(ASK_STATE_PREFIX);
}

export interface AskConversation {
  /**
   * 本轮新问题。续跑(口径卡确认、重试)以上一轮 outcome.messages 为基线
   * 且不追加新用户消息,此时为 null。
   */
  question: string | null;
  state: AskConversationState;
}

/**
 * 从会话消息解析问数上下文:状态取最后一条状态消息;新问题只认状态消息
 * 之后出现的用户消息(状态之前的用户消息属于已完成的轮次)。
 */
export function parseAskConversation(messages: readonly AgentMessage[]): AskConversation {
  let stateIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAskStateMessage(messages[index]!)) {
      stateIndex = index;
      break;
    }
  }
  const state = stateIndex === -1 ? null : decodeState(messages[stateIndex]!.content);
  let question: string | null = null;
  for (let index = messages.length - 1; index > stateIndex; index -= 1) {
    const message = messages[index]!;
    if (message.role === 'user') {
      question = message.content;
      break;
    }
  }
  return { question, state: state ?? initialAskState() };
}

/** 以新状态替换消息序列中的旧状态消息(保持单一状态真源)。 */
export function withAskState(
  messages: readonly AgentMessage[],
  state: AskConversationState
): AgentMessage[] {
  return [...messages.filter((message) => !isAskStateMessage(message)), askStateMessage(state)];
}

function decodeState(content: string): AskConversationState | null {
  try {
    const parsed = JSON.parse(content.slice(ASK_STATE_PREFIX.length)) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1
    ) {
      return parsed as AskConversationState;
    }
    return null;
  } catch {
    return null;
  }
}
