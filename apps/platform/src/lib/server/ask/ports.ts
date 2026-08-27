import type {
  AssembleTransientPageInput,
  AssembleTransientPageResult,
  BusinessDomainSummary,
  DataRequestUnitVerification,
  DomainSemanticSurface
} from '@metriccanvas/mcp';
import type { AnalysisIntent, MetricGapOccurrence } from '../session/step-event';

/**
 * 问数编排的注入端口(#66,ADR-0037)。
 *
 * 编排模块框架无关:不 import SvelteKit、不感知 HTTP 与凭据,模型提供方、
 * 数据上下文检索、取数单元验真与临时页面装配全部经这里的端口注入。
 * 人机分工(用户拍板的架构决策):模型只产出结构化决策(域选择、取数单元
 * 填充、意图确认);检索、消歧排序、执行与装配全部由确定性代码接管。
 *
 * 上下文裁剪:域路由只注入域清单(BusinessDomainSummary);路由后只注入
 * 命中域的语义面投影(DomainSemanticSurface);候选消歧由确定性检索排序,
 * 模型只看 top-N 候选卡。接口按「检索结果注入」设计:V0 两域可全量注入,
 * 形状为多域留好——检索面收窄发生在端口实现内,编排不感知域的总量。
 */

/* ---------- 取数单元(创作期状态,CONTEXT.md / ADR-0032) ---------- */

/** 取数单元的指标项:命中指标条目,或临时指标 formula(ADR-0036)。 */
export type AskUnitMetric =
  | { kind: 'metric'; name: string }
  | {
      kind: 'formula';
      expression: string;
      /** 输出字段名与展示标签;formula 无指标条目,由生成时显式声明。 */
      label: string;
      /** 单位同样必须显式声明,不得从数值猜测(ADR-0032)。 */
      unit?: string;
      description?: string;
    };

export interface AskUnitFilter {
  dimension: string;
  values: string[];
}

export interface AskUnitTime {
  granularity: string;
  /** 时间范围端点,粒度对应的字面(如 2026-01 / 2026-01-15)。 */
  start: string;
  end: string;
  /** 时间口径来源:模型补全而非用户明说时触发取数核对阻塞(ADR-0037)。 */
  providedBy: 'user' | 'model';
}

/** 取数单元:业务语言描述「要什么数」;查询定义是它的派生物,不在这层手写。 */
export interface AskDataRequestUnitState {
  businessDomain: string;
  metrics: AskUnitMetric[];
  groupBy: string[];
  filters: AskUnitFilter[];
  time: AskUnitTime | null;
  title?: string;
}

/** 会话中一个取数单元与其稳定页面数据源名的绑定(多单元模型的寻址单位)。 */
export interface AskUnitBinding {
  dataSourceId: string;
  unit: AskDataRequestUnitState;
}

/* ---------- 检索端口:确定性候选排序 ---------- */

/** 排序后的指标候选:口径差异说明来自指标条目的口径原文。 */
export interface RankedMetricCandidate {
  metricName: string;
  businessDomain: string;
  /** 口径说明(候选卡与口径差异说明的内容来源)。 */
  definition: string;
  unit?: string;
  /** 命中依据:问题中出现的指标名或别名;消歧的确定性输入。 */
  matchedTerm: string;
  score: number;
}

export interface AskRetrievalPort {
  /** 域清单:域路由阶段注入模型的全部内容。 */
  domainInventory(): Promise<BusinessDomainSummary[]>;
  /** 命中域的语义面投影(敏感字段已标注,#80)。 */
  domainSurfaces(businessDomains: readonly string[]): Promise<DomainSemanticSurface[]>;
  /** 确定性检索排序:返回排序候选,不做选择。 */
  searchMetricCandidates(input: {
    question: string;
    businessDomains: readonly string[];
    limit?: number;
  }): Promise<RankedMetricCandidate[]>;
}

/* ---------- 模型端口:每阶段最多一次调用,只产出结构化决策 ---------- */

export interface AskDomainRoutingInput {
  question: string;
  domains: BusinessDomainSummary[];
  signal?: AbortSignal;
}

export interface AskDomainRoutingDecision {
  /** 收窄后的一到两个业务域,必须取自注入的域清单。 */
  businessDomains: string[];
}

export interface AskUnitFormingInput {
  question: string;
  surfaces: DomainSemanticSurface[];
  /** top-N 候选卡:确定性检索排序的产物。 */
  candidates: RankedMetricCandidate[];
  /**
   * 确定性消歧的结论:按命中词各自唯一胜出的候选。歧义未决的命中词不在
   * 此列——模型不得代替用户在近义候选间做选择(ADR-0037)。
   */
  selectedMetrics: Array<{ businessDomain: string; metricName: string }>;
  /** 追问轮的定向单元操作基线:当前全部取数单元(带数据源名);首轮为空。 */
  previousUnits: AskUnitBinding[];
  /**
   * 本轮定向修改的默认目标单元(请求 target 映射到的数据源名):用户说
   * 「这个」「改成饼图」时的指代锚点;无 target 时为 null。
   */
  targetDataSourceId: string | null;
  /** 清单校验被拒后的违规反馈(每阶段一次修复重试)。 */
  violationFeedback?: string[];
  signal?: AbortSignal;
}

/** 定向增量 patch:只包含要改变的层,未提及的显式设置结构上保持不变。 */
export type AskUnitPatch = Partial<
  Pick<AskDataRequestUnitState, 'metrics' | 'groupBy' | 'filters' | 'time' | 'title'>
>;

/**
 * 定向单元操作(多单元模型的唯一操作词汇):
 * - add:新增一个完整取数单元(数据源名由编排分配,模型不指定);
 * - replace:整单元重写指定单元(重新成形,如「换成完全不同的口径」);
 * - modify:对指定单元做定向增量 patch(未提及的层结构上保持不变);
 * - remove:删除指定单元。
 * 一轮可含多个操作(「换成两个图表,分别展示」= modify 原单元 + add 新单元);
 * 未被操作触及的单元结构性不变(ADR-0037)。
 */
export type AskUnitOperation =
  | { op: 'add'; unit: AskDataRequestUnitState }
  | { op: 'replace'; dataSourceId: string; unit: AskDataRequestUnitState }
  | { op: 'modify'; dataSourceId: string; patch: AskUnitPatch }
  | { op: 'remove'; dataSourceId: string };

/**
 * 部分可答时缺的那一部分(ADR-0036、#67):问题里语义面无法回答的口径,
 * 与可答部分结构上分离——它不进入取数单元,因此不会混入同一数字或同一
 * 组件;由编排单独列出,经用户确认后登记为指标需求条目。
 */
export interface AskUnitGapAspect {
  /** 缺失口径的业务描述(如「NPS 趋势」)。 */
  aspect: string;
  reason: string;
}

export type AskUnitFormingDecision =
  /** 定向单元操作集(多单元模型的完整口径成形出口)。 */
  | { outcome: 'operations'; operations: AskUnitOperation[]; gaps?: AskUnitGapAspect[] }
  /** 单单元简写:等价于对目标单元的 replace(首轮等价于 add)。 */
  | { outcome: 'unit'; unit: AskDataRequestUnitState; gaps?: AskUnitGapAspect[] }
  /** 单单元简写:等价于对目标单元的 modify。 */
  | { outcome: 'patch'; patch: AskUnitPatch; gaps?: AskUnitGapAspect[] }
  /** 语义面之外的问题:降级而不是编造(ADR-0036)。 */
  | { outcome: 'out_of_scope'; reason: string };

export interface AskIntentInput {
  /**
   * 该取数单元对应的那句问法:一轮多个单元时是该单元的业务标题,单单元轮次
   * 是问题原文。不传整句问题——整句里的「走势」会把同一轮按维度切分的单元
   * 也判成趋势(ADR-0055)。
   */
  question: string;
  unit: AskDataRequestUnitState;
  /** 上一轮意图;追问未提及展示变化时应保持不变。 */
  previousIntent: AnalysisIntent | null;
  signal?: AbortSignal;
}

export interface AskIntentDecision {
  intent: AnalysisIntent;
}

export interface AskModelPort {
  routeDomains(input: AskDomainRoutingInput): Promise<AskDomainRoutingDecision>;
  formUnit(input: AskUnitFormingInput): Promise<AskUnitFormingDecision>;
  decideIntent(input: AskIntentInput): Promise<AskIntentDecision>;
}

/* ---------- 装配端口 ---------- */

export type AssembleTransientPage = (
  input: AssembleTransientPageInput
) => AssembleTransientPageResult;

/* ---------- 缺口登记端口(#67,ADR-0036) ---------- */

/**
 * 缺口条目登记口:编排在降级分支(临时指标 / 面外)于用户确认后交出
 * 结构化缺口出现,不感知存储。
 *
 * 落库通道只有一条:编排同时以 metric_gap_recorded 步骤事件产出同一
 * 形状,随会话事件流落库并按存储侧聚合计数(ADR-0036:不另建采集通道)。
 * 本端口供不消费步骤事件流的宿主(评测、离线回放)观察登记时点;
 * 注入实现不得成为第二份缺口存储。
 */
export type GapEntrySink = (occurrence: MetricGapOccurrence) => void | Promise<void>;

/* ---------- 编排端口汇总 ---------- */

export interface AskOrchestrationPorts {
  model: AskModelPort;
  retrieval: AskRetrievalPort;
  /** 取数单元验真(#64):清单校验 → 真实执行 → 回传字段与样例行。 */
  verifyUnit: DataRequestUnitVerification;
  /** 临时页面装配(#62):出口过 validate,钉住语义由 recommendComponents 承载。 */
  assemblePage: AssembleTransientPage;
  /** 缺口登记口(#67):缺省不注入,登记只走步骤事件流。 */
  gapSink?: GapEntrySink;
  /** 内嵌初始行 capturedAt 的时钟;测试注入固定时钟。 */
  clock?: () => Date;
}
