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

/** 步骤事件:分析会话事件流的可判别联合,判别字段为 `type`。 */
export type AnalysisStepEvent =
  | DomainRoutedEvent
  | CandidatesRetrievedEvent
  | ScopeCardPresentedEvent
  | ExecutionStartedEvent
  | RowsReadyEvent
  | DocumentReadyEvent
  | StepFailedEvent;
