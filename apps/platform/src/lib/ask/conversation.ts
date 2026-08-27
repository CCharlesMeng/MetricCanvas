import type { FormulaTrace } from '@metriccanvas/mcp';
import type { AgentMessage } from '../server/agent/types';
import type { AnalysisIntent, MetricGapOccurrence } from '../server/session/step-event';
import type {
  AskDataRequestUnitState,
  AskUnitGapAspect,
  RankedMetricCandidate
} from '../server/ask/ports';

/**
 * 问数会话状态的往返契约(#66)。
 *
 * 编排的输入是「问题与会话上下文」:会话上下文以一条带前缀的 system 消息
 * 随 outcome.messages 往返(工作台把 outcome.messages 原样作为下一轮基线,
 * 服务端请求契约 workbench-request.ts 予以保留)。状态只承载结构化结果——
 * 路由域、生效取数单元集合、临时页面 id、formula 留痕与待确认取数核对;
 * 不含对话文本与模型 prompt(ADR-0030 红线),也不内嵌业务数据行
 * (未触及单元的初始行由随请求传回的 draft 文档承载)。
 *
 * 放在 $lib/ask 而非 $lib/server:状态消息经推送通道往返于浏览器,本就是
 * 双端共享的线上契约。服务端编排(orchestrator)与工作台沉淀入口(#68 读
 * formulaTraces 作沉淀警告输入)共用这一份解析,不各写一份。模块保持纯
 * 函数,仅类型引用服务端契约声明。
 */

export const ASK_STATE_PREFIX = 'METRICCANVAS_ASK_STATE:';

/**
 * 问数首个取数单元的页面数据源名。多单元模型下每个单元持有稳定的
 * dataSourceId,由 askUnitDataSourceId 按会话内单调序号派生;首单元
 * 沿用历史值 `result`,历史单 unit 会话、既有钉住与 target 定位因此
 * 无缝续接。
 */
export const ASK_DATA_SOURCE_ID = 'result';

/** 会话内第 ordinal 个取数单元的稳定页面数据源名(序号只增不复用)。 */
export function askUnitDataSourceId(ordinal: number): string {
  return ordinal <= 1 ? ASK_DATA_SOURCE_ID : `${ASK_DATA_SOURCE_ID}-${ordinal}`;
}

/** 取数核对阻塞原因(ADR-0037 触发条件的已实现子集)。 */
export type ScopeBlockReason =
  | 'ambiguous_metric'
  | 'ad_hoc_definition'
  | 'model_completed_time';

/**
 * 会话中的一个取数单元条目:稳定数据源名 + 取数单元 + 按单元记录的
 * 呈现状态(分析意图、用户话语显式点名的组件形态)。
 */
export interface AskUnitEntryState {
  dataSourceId: string;
  unit: AskDataRequestUnitState;
  intent: AnalysisIntent | null;
  /**
   * 用户话语显式点名的组件形态(如「改成柱状图」),确定性识别后跨追问
   * 轮按单元保持,新点名覆盖;优先于 UI 钉住。
   */
  requestedComponent?: string | null;
}

/** 待人工确认的取数核对:阻塞原因、待执行单元与消歧候选。 */
export interface AskPendingScopeCard {
  interactionId: string;
  reasons: ScopeBlockReason[];
  /** 阻塞单元(展示与消歧锚点);歧义未决时 metrics 缺少歧义命中词对应的条目。 */
  unit: AskDataRequestUnitState;
  /** 阻塞单元的数据源名;历史卡缺省时按首单元读取。 */
  dataSourceId?: string;
  /** 本轮全部单元的下一状态(含未触及单元);历史卡缺省时以 unit 为唯一单元。 */
  units?: AskUnitEntryState[];
  /** 本轮被新增或修改、确认后需要重新执行的单元;历史卡缺省时为阻塞单元。 */
  touchedDataSourceIds?: string[];
  /** 歧义命中词(为空表示阻塞与消歧无关,普通确认即可执行)。 */
  ambiguousTerms: string[];
  candidates: RankedMetricCandidate[];
  /** 产生该卡的问题原文:确认续跑后 formula 留痕与页面说明仍锚定它。 */
  question: string;
  /** 本轮问题里语义面无法回答的部分(#67):随续跑传递,单独列为缺口。 */
  gapAspects?: AskUnitGapAspect[];
}

/** 待人工确认的缺口登记(#67):确认后才产生 metric_gap_recorded 事件。 */
export interface AskPendingGapEntry {
  interactionId: string;
  occurrences: MetricGapOccurrence[];
}

export interface AskConversationState {
  version: 1;
  /** 生效业务域与是否经用户改写(改写记录是改进路由的信号,ADR-0037)。 */
  businessDomains: string[];
  domainsOverriddenByUser: boolean;
  /**
   * 最近一次成功执行的取数单元集合;追问的定向单元操作基线。
   * 历史单 unit 状态消息(unit/intent/requestedComponent 顶层字段)在
   * 解析时迁移为单元素集合,见 decodeState。
   */
  units: AskUnitEntryState[];
  /** 单元数据源名的下一个序号:只增不复用,删除单元不回收名字。 */
  nextUnitOrdinal: number;
  transientPageId: string | null;
  /** 自由生成 formula 的留痕(ADR-0032);沉淀门槛(#68)的输入。 */
  formulaTraces: FormulaTrace[];
  pending: AskPendingScopeCard | null;
  /**
   * 待确认的缺口登记(#67)。历史状态消息可能缺该字段,读取处一律
   * `?? null`;确认(空白续跑)即登记,新问题到来即放弃。
   */
  pendingGapEntry?: AskPendingGapEntry | null;
}

export function initialAskState(): AskConversationState {
  return {
    version: 1,
    businessDomains: [],
    domainsOverriddenByUser: false,
    units: [],
    nextUnitOrdinal: 1,
    transientPageId: null,
    formulaTraces: [],
    pending: null,
    pendingGapEntry: null
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
   * 本轮新问题。续跑(取数核对确认、重试)以上一轮 outcome.messages 为基线
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
      return migrateState(parsed as Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 历史单 unit 状态的兼容读取:旧形状以顶层 unit/intent/requestedComponent
 * 承载唯一单元,读到时迁移为单元素集合(数据源名沿用 `result`,与旧文档
 * 的 dataSources 键一致,钉住与 target 定位不断链);新形状原样返回。
 */
function migrateState(parsed: Record<string, unknown>): AskConversationState {
  if (Array.isArray(parsed.units)) {
    const state = parsed as unknown as AskConversationState;
    return {
      ...state,
      nextUnitOrdinal:
        typeof parsed.nextUnitOrdinal === 'number' && parsed.nextUnitOrdinal >= 1
          ? parsed.nextUnitOrdinal
          : state.units.length + 1
    };
  }
  const legacy = parsed as unknown as {
    unit?: AskDataRequestUnitState | null;
    intent?: AnalysisIntent | null;
    requestedComponent?: string | null;
  };
  const units: AskUnitEntryState[] =
    legacy.unit === null || legacy.unit === undefined
      ? []
      : [
          {
            dataSourceId: ASK_DATA_SOURCE_ID,
            unit: legacy.unit,
            intent: legacy.intent ?? null,
            requestedComponent: legacy.requestedComponent ?? null
          }
        ];
  return {
    version: 1,
    businessDomains: Array.isArray(parsed.businessDomains)
      ? (parsed.businessDomains as string[])
      : [],
    domainsOverriddenByUser: parsed.domainsOverriddenByUser === true,
    units,
    nextUnitOrdinal: units.length + 1,
    transientPageId:
      typeof parsed.transientPageId === 'string' ? parsed.transientPageId : null,
    formulaTraces: Array.isArray(parsed.formulaTraces)
      ? (parsed.formulaTraces as FormulaTrace[])
      : [],
    pending: (parsed.pending as AskPendingScopeCard | null | undefined) ?? null,
    pendingGapEntry:
      (parsed.pendingGapEntry as AskPendingGapEntry | null | undefined) ?? null
  };
}
