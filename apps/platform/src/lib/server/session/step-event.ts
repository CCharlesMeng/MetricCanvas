import type { JSONValue } from '@metriccanvas/page-lifecycle';

/**
 * 分析会话的步骤事件契约(ADR-0030、ADR-0037)。
 *
 * 这是问数编排各阶段落库共用的唯一事件类型声明:会话存储(./store.ts)、
 * 可见性过滤、测试以及后续切片(模型探针、#32 步骤事件流式下发)都从这里
 * 导入,不得另写一份。事件顺序对应 ADR-0037 的编排阶段:
 * 域路由 → 候选检索 → 口径卡 → 真实执行 → 行就绪 → 文档就绪;任一阶段
 * 失败以 step_failed 收尾。
 *
 * 红线(ADR-0030):事件只记录结构化结果——问题原文、路由域、候选与选中
 * 指标、临时口径、生效查询、执行结果摘要、意图与组件选择、失败分类;
 * 不保存完整对话文本,也不保存模型 prompt。
 */

/** 失败四段分类:发现 / 生成 / 执行 / 呈现。 */
export const FAILURE_STAGES = ['discovery', 'generation', 'execution', 'presentation'] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

/** 分析意图(ADR-0037):比较、趋势、构成、排名、明细、单值。 */
export const ANALYSIS_INTENTS = [
  'comparison',
  'trend',
  'composition',
  'ranking',
  'detail',
  'single_value'
] as const;
export type AnalysisIntent = (typeof ANALYSIS_INTENTS)[number];

/** 指标候选:检索返回的排序候选及其口径差异说明,是口径卡消歧的输入(ADR-0037)。 */
export interface MetricCandidate {
  metricName: string;
  /** 所属业务域(CONTEXT.md:业务域是路由标签,不表达数据隔离)。 */
  businessDomain: string;
  /** 与其他候选的口径差异说明;检索未给出差异说明时为 null。 */
  definitionDifference: string | null;
}

/** 临时口径(CONTEXT.md:Ad-hoc Definition):未命中指标条目时现场生成的计算口径。 */
export interface AdHocDefinition {
  formula: string;
  description: string | null;
}

/** 维度筛选条件,口径卡生效范围的组成部分。 */
export interface DimensionFilter {
  dimension: string;
  values: readonly string[];
}

/** 执行结果摘要:只存行数、总数与输出字段名,不存数据行(ADR-0030)。 */
export interface ExecutionResultSummary {
  rowCount: number;
  /** DQE 返回的总条数;查询未返回时为 null。 */
  totalCount: number | null;
  outputFields: readonly string[];
}

/** 组件选择及钉住状态;钉住属创作期状态,随会话保存,不进页面文档(ADR-0037)。 */
export interface ComponentChoice {
  componentType: string;
  pinnedByUser: boolean;
}

/** 域路由完成:问题原文进入会话的唯一位置;路由结果必须可见且可改(ADR-0037)。 */
export interface DomainRoutedEvent {
  type: 'domain_routed';
  /** 问题原文。含客户名等真实敏感内容,受按 actorId 的可见性过滤保护(ADR-0030)。 */
  question: string;
  /** 路由域:收窄后的一到两个业务域。 */
  routedDomains: readonly string[];
  /** 用户是否改写过模型的路由结果;改写记录是改进路由的主要信号(ADR-0037)。 */
  overriddenByUser: boolean;
}

/** 指标与维度检索完成:排序候选、选中指标与可能的临时口径。 */
export interface CandidatesRetrievedEvent {
  type: 'candidates_retrieved';
  candidates: readonly MetricCandidate[];
  /** 选中指标名;检索未命中、改走临时口径时为 null。 */
  selectedMetric: string | null;
  adHocDefinition: AdHocDefinition | null;
}

/** 口径卡已呈现:完整生效范围(ADR-0037);指标名与临时口径二者其一。 */
export interface ScopeCardPresentedEvent {
  type: 'scope_card_presented';
  businessDomain: string;
  metricName: string | null;
  adHocDefinition: AdHocDefinition | null;
  timeRange: string;
  granularity: string;
  filters: readonly DimensionFilter[];
  /** 是否命中 ADR-0037 的阻塞条件(候选歧义、自由 formula、临时口径等),需等待用户确认。 */
  blockedOnConfirmation: boolean;
}

/** 真实执行开始:记录生效查询(查询定义 + 查询字段映射 + 当前筛选值,CONTEXT.md)。 */
export interface ExecutionStartedEvent {
  type: 'execution_started';
  effectiveQuery: JSONValue;
}

/** 执行结果行就绪:只落执行结果摘要。 */
export interface RowsReadyEvent {
  type: 'rows_ready';
  summary: ExecutionResultSummary;
}

/** 临时页面文档就绪:意图判定与组件选择随会话保存(ADR-0030、ADR-0037)。 */
export interface DocumentReadyEvent {
  type: 'document_ready';
  intent: AnalysisIntent;
  components: readonly ComponentChoice[];
  /** 临时页面 id(ADR-0030):不进页面仓储、不产生页面修订。 */
  transientPageId: string;
}

/** 步骤失败:按发现 / 生成 / 执行 / 呈现四段分类。 */
export interface StepFailedEvent {
  type: 'step_failed';
  stage: FailureStage;
  code: string;
  message: string;
}

/**
 * 指标需求条目的一次出现(CONTEXT.md:Metric Gap Entry;ADR-0036、#67)。
 *
 * 这是缺口条目形状的唯一声明:检索不到合适指标时,编排在用户确认后交出
 * 一次结构化出现,随会话事件流落库(不另建采集通道);出现次数不在这里
 * ——同一幂等键的多次出现由会话存储侧聚合为一个条目并累加计数
 * (../session/metric-gap.ts)。
 *
 * 红线:只保存问题原文与结构化结果,不保存完整对话文本(ADR-0030)。
 */
export interface MetricGapOccurrence {
  /**
   * 幂等键:临时口径缺口按「业务域 + 表达式形状」派生,面外缺口按
   * 「业务域 + 归一化检索对象」派生(派生函数见 ../session/metric-gap.ts)。
   * 同一缺口的重复出现共享同一键,聚合时去重并累加出现次数。
   */
  idempotencyKey: string;
  /** 问题原文(仅本次提问,不含对话上下文)。 */
  question: string;
  /** 检索过的词:候选命中词或缺失口径的业务描述。 */
  searchTerms: readonly string[];
  /** 最接近的候选及其口径差异说明。 */
  closestCandidates: readonly MetricCandidate[];
  /** 尽力回答所用的临时口径;完全无法回答时为 null。 */
  adHocDefinition: AdHocDefinition | null;
  /** 期望的切分维度。 */
  expectedDimensions: readonly string[];
  /** 期望的时间粒度;问题未涉及时间时为 null。 */
  expectedGranularity: string | null;
  /** 所属业务域(路由结果)。 */
  businessDomain: string;
}

/** 缺口出现已登记:用户确认后才产生本事件(#36 内核在 #67 的继承)。 */
export interface MetricGapRecordedEvent {
  type: 'metric_gap_recorded';
  gap: MetricGapOccurrence;
}

/** 步骤事件:分析会话事件流的可判别联合,判别字段为 `type`。 */
export type AnalysisStepEvent =
  | DomainRoutedEvent
  | CandidatesRetrievedEvent
  | ScopeCardPresentedEvent
  | ExecutionStartedEvent
  | RowsReadyEvent
  | DocumentReadyEvent
  | MetricGapRecordedEvent
  | StepFailedEvent;

/*
 * 以下是步骤事件流式下发(#32)对本契约的最小扩展:Agent 运行经服务端推送
 * 逐步下发时,除上方会落库的步骤事件外,还需要运行生命周期与工具调用进度
 * 两类只进推送通道、不落库的事件(ADR-0030 的落库红线只覆盖步骤事件)。
 * 它们与 AnalysisStepEvent 共用 `type` 判别字段,合并为 AgentRunStreamEvent;
 * 消费方(工作台,#65)按 type 收窄即可顺序消费。
 */

/** 运行开始:流式通道的第一个事件,锚定 runId 与可选的分析会话。 */
export interface RunStartedEvent {
  type: 'run_started';
  runId: string;
  /** 关联的分析会话;调用方未开启会话落库时为 null。 */
  sessionId: string | null;
}

/**
 * 工具调用开始:工作台按 toolCallId 呈现"进行中"状态。
 * 只带名称与调用 id,不带调用入参——入参可能含问题原文之外的敏感拼装内容,
 * 工具审计(日志)与工作台展示都只需要名称与状态。
 */
export interface ToolCallStartedEvent {
  type: 'tool_call_started';
  toolCallId: string;
  toolName: string;
}

/** 工具调用结束:成功或失败;失败时附工具结果中的稳定错误码。 */
export interface ToolCallFinishedEvent {
  type: 'tool_call_finished';
  toolCallId: string;
  toolName: string;
  status: 'succeeded' | 'failed';
  /** 失败时取工具结果 error.code;成功或无结构化错误码时为 null。 */
  errorCode: string | null;
}

/** 助手文本回复(如澄清提问):只进推送通道供本人界面呈现,不落库、不进日志。 */
export interface AssistantRepliedEvent {
  type: 'assistant_replied';
  content: string;
}

/** 运行等待人工交互(如页面 id 确认),等待期间运行结束;确认后由新运行继续。 */
export interface RunInteractionRequiredEvent {
  type: 'run_interaction_required';
  interactionId: string;
  kind: string;
  payload: Record<string, unknown>;
}

/** 运行正常完成。 */
export interface RunCompletedEvent {
  type: 'run_completed';
}

/**
 * 运行失败终态:纯生命周期标记。失败分类本身以紧邻在前的 step_failed
 * 事件承载(并按 ADR-0030 落库),这里只补充传输层语义,不重复声明分类。
 */
export interface RunFailedEvent {
  type: 'run_failed';
  /** 以运行结束时的会话状态重试失败步骤是否有意义(取消/限流为 true,预算耗尽为 false)。 */
  retryable: boolean;
}

/** 运行被用户取消:不是失败,不产生 step_failed,可携带既有会话状态重试。 */
export interface RunCancelledEvent {
  type: 'run_cancelled';
}

/**
 * Agent 运行流事件:服务端推送通道的可判别联合(判别字段 `type`)。
 * AnalysisStepEvent 子集按 ADR-0030 落库;其余为运行进度,只进通道。
 */
export type AgentRunStreamEvent =
  | AnalysisStepEvent
  | RunStartedEvent
  | ToolCallStartedEvent
  | ToolCallFinishedEvent
  | AssistantRepliedEvent
  | RunInteractionRequiredEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent;

/** 判别一条流事件是否属于按 ADR-0030 落库的步骤事件。 */
export function isPersistedStepEvent(
  event: AgentRunStreamEvent
): event is AnalysisStepEvent {
  switch (event.type) {
    case 'domain_routed':
    case 'candidates_retrieved':
    case 'scope_card_presented':
    case 'execution_started':
    case 'rows_ready':
    case 'document_ready':
    case 'metric_gap_recorded':
    case 'step_failed':
      return true;
    default:
      return false;
  }
}
