import {
  pageListEntry,
  parsePage,
  validate,
  type TypedError
} from '@metriccanvas/page';
import type { FormulaTrace } from './unit-verification';

/**
 * 沉淀(Promote,ADR-0030):把临时页面态显式转为长期资产的纯函数改写。
 * 两个方向,时间语义相反:
 *
 * - 沉淀为 Data App:临时页面 id 换为经确认的正式页面 id,其余不动,
 *   产物交由既有 saveRevision 通道保存为页面修订。含临时口径(ADR-0036)
 *   时必须由调用方显式传入用户接受,否则拒绝——沉淀处设闸。
 * - 沉淀为报告:同样换上正式页面 id,保留查询定义与采集时点的内嵌初始行,
 *   去掉全部筛选绑定。依据 ADR-0020,默认状态存在内嵌初始行且无筛选变化
 *   时统一运行时不重新查询,报告因此冻结在采集时点,同时保住口径溯源;
 *   不引入新的数据源类型或渲染路径。
 *
 * 改写是纯函数:不依赖平台、浏览器与 IO,不改动输入文档。页面合法性只信
 * validate()——两个方向的产物都在出口整体过页面校验,失败时透传原始错误。
 * 结构化相对时间(ADR-0035)不在 V0 沉淀路径内,因此 Data App 方向的产物
 * 缺少滚动时间语义,这一已知限制以 knownLimitations 显式返回,由界面原样
 * 告知用户,不得靠临时加字段绕过。
 */

/** 已知限制文案单点:Data App 方向缺少滚动时间语义(界面必须原样告知)。 */
export const DATA_APP_ROLLING_TIME_LIMITATION =
  '沉淀出的 Data App 当前缺少滚动时间语义:页面时间冻结在提问时的绝对区间,' +
  '不会随周期滚动(结构化相对时间不在当前版本范围,ADR-0035)。';

/** 页面文档中检出的一处临时口径(ADR-0036):formula 及其留痕。 */
export interface AdHocDefinitionUsage {
  dataSourceId: string;
  /** formula 项的 DQE 输出字段名(alias);查询体未声明时为 null。 */
  alias: string | null;
  expression: string;
  /** 留痕的问题原文;formulaTraces 按表达式匹配到时携带,否则为 null。 */
  question: string | null;
}

export interface PromotionIssue {
  code:
    | 'PAGE_ID_PLACEHOLDER'
    | 'PAGE_ID_UNCHANGED'
    | 'AD_HOC_DEFINITIONS_NOT_ACCEPTED'
    | 'REPORT_INITIAL_ROWS_MISSING'
    | 'TRANSIENT_ID_TRACE_REMAINING'
    | 'PAGE_VALIDATION_FAILED';
  message: string;
  /** 出问题的页面数据源;页面级问题时缺省。 */
  dataSourceId?: string;
  /** 未被接受的临时口径清单(AD_HOC_DEFINITIONS_NOT_ACCEPTED)。 */
  adHocDefinitions?: AdHocDefinitionUsage[];
  /** validate() 的原始错误,逐条透传(PAGE_VALIDATION_FAILED)。 */
  errors?: TypedError[];
}

export interface PromotedPage {
  ok: true;
  /** 换上正式页面 id 且整体通过 validate() 的页面文档。 */
  document: Record<string, unknown>;
  /** 文档中检出的临时口径(Data App 方向即用户已显式接受的清单)。 */
  adHocDefinitions: AdHocDefinitionUsage[];
  /** 报告方向各查询数据源的采集时点;Data App 方向为空数组。 */
  frozenAt: Array<{ dataSourceId: string; capturedAt: string }>;
  /** 已知限制文案;Data App 方向恒含缺少滚动时间语义一条。 */
  knownLimitations: string[];
}

export type PromoteResult = PromotedPage | { ok: false; issues: PromotionIssue[] };

export interface PromoteToDataAppInput {
  /** 完整临时页面态(问数编排 outcome 帧的已校验文档)。 */
  document: Record<string, unknown>;
  /** 经确认的正式页面 id。 */
  pageId: string;
  /** 文档含临时口径时必须为 true(用户已显式接受其无人负责)。 */
  acceptAdHocDefinitions?: boolean;
  /** 临时口径留痕(#66 ask 会话状态携带),用于警告的问题原文溯源。 */
  formulaTraces?: readonly FormulaTrace[];
}

export interface PromoteToReportInput {
  document: Record<string, unknown>;
  pageId: string;
  formulaTraces?: readonly FormulaTrace[];
}

/** 沉淀为 Data App:换正式页面 id,临时口径设闸,其余原样保留。 */
export function promoteToDataApp(input: PromoteToDataAppInput): PromoteResult {
  const precondition = pageIdIssues(input.document, input.pageId);
  if (precondition.length > 0) return { ok: false, issues: precondition };

  const adHocDefinitions = adHocDefinitionsOf(input.document, input.formulaTraces);
  if (adHocDefinitions.length > 0 && input.acceptAdHocDefinitions !== true) {
    return {
      ok: false,
      issues: [{
        code: 'AD_HOC_DEFINITIONS_NOT_ACCEPTED',
        message:
          '页面含临时口径,沉淀为 Data App 前必须由用户显式接受其无人负责:' +
          adHocDefinitions.map((usage) => usage.expression).join('、'),
        adHocDefinitions
      }]
    };
  }

  const document = { ...input.document, id: input.pageId };
  const issues = rewrittenPageIssues(document, transientIdOf(input.document));
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    document,
    adHocDefinitions,
    frozenAt: [],
    knownLimitations: [DATA_APP_ROLLING_TIME_LIMITATION]
  };
}

/** 沉淀为报告:换正式页面 id,保留查询定义与内嵌初始行,去掉筛选绑定。 */
export function promoteToReport(input: PromoteToReportInput): PromoteResult {
  const issues = pageIdIssues(input.document, input.pageId);

  const dataSources = recordOf(input.document.dataSources);
  const frozenAt: Array<{ dataSourceId: string; capturedAt: string }> = [];
  const rewrittenSources: Record<string, unknown> = {};
  for (const [dataSourceId, dataSource] of Object.entries(dataSources)) {
    const query = queryPartsOf(dataSource);
    if (query === null) {
      // inline 数据源本就随页面修订静态保存,原样保留(不引入新数据源类型)。
      rewrittenSources[dataSourceId] = dataSource;
      continue;
    }
    if (query.initial === null) {
      // 无内嵌初始行时默认状态会立即执行查询(ADR-0020),报告无从冻结。
      issues.push({
        code: 'REPORT_INITIAL_ROWS_MISSING',
        dataSourceId,
        message:
          `查询数据源 ${dataSourceId} 缺少内嵌初始行,` +
          '默认状态会重新查询,无法冻结在采集时点'
      });
      continue;
    }
    frozenAt.push({ dataSourceId, capturedAt: query.initial.capturedAt });
    rewrittenSources[dataSourceId] = query.withoutFilterBindings;
  }
  if (issues.length > 0) return { ok: false, issues };

  const document = {
    ...input.document,
    id: input.pageId,
    dataSources: rewrittenSources
  };
  const rewritten = rewrittenPageIssues(document, transientIdOf(input.document));
  if (rewritten.length > 0) return { ok: false, issues: rewritten };
  return {
    ok: true,
    document,
    adHocDefinitions: adHocDefinitionsOf(input.document, input.formulaTraces),
    frozenAt,
    knownLimitations: []
  };
}

/**
 * 扫描页面文档 query 数据源的 DQE 查询体,列出全部临时口径(formula 项)。
 * 文档本身是「本页面含临时口径」的唯一真源;formulaTraces 只补充问题原文。
 */
export function adHocDefinitionsOf(
  document: Record<string, unknown>,
  formulaTraces: readonly FormulaTrace[] = []
): AdHocDefinitionUsage[] {
  const usages: AdHocDefinitionUsage[] = [];
  for (const [dataSourceId, dataSource] of Object.entries(recordOf(document.dataSources))) {
    const query = queryPartsOf(dataSource);
    if (query === null) continue;
    for (const entry of query.outputMetrics) {
      if (!isRecord(entry) || typeof entry.formula !== 'string') continue;
      const expression = entry.formula;
      usages.push({
        dataSourceId,
        alias: typeof entry.alias === 'string' ? entry.alias : null,
        expression,
        question:
          formulaTraces.find((trace) => trace.expression === expression)?.question ?? null
      });
    }
  }
  return usages;
}

/**
 * 页面 id 是否为占位符(必须换成可读且唯一的真实候选值)。
 * confirm_page_id 机制与沉淀入口共用这一份判定。
 */
export function isPlaceholderPageId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    /^__.*__$/u.test(normalized) ||
    /^<.*>$/u.test(normalized) ||
    ['pending', 'todo', 'tbd', 'placeholder', '待确认', '待定'].includes(normalized)
  );
}

export interface PageIdConfirmationPayload {
  pageId: string;
  title?: string;
  stablePath: string;
  immutableAfterSave: true;
  schemaVersion?: string;
}

/**
 * 结构化页面 id 确认载荷:MCP 客户端装饰器(confirm_page_id 交互)与
 * 工作台沉淀入口的等价显式确认共用同一份事实。标题经 parsePage 后由
 * pageListEntry 派生(#78);解析失败时不带标题。
 */
export function pageIdConfirmationPayload(
  document: Record<string, unknown>,
  pageId: string
): PageIdConfirmationPayload {
  const parsed = parsePage(document);
  return {
    pageId,
    ...(parsed.ok ? { title: pageListEntry(parsed.page).title } : {}),
    stablePath: `/pages/${pageId}`,
    immutableAfterSave: true,
    ...(typeof document.schemaVersion === 'string'
      ? { schemaVersion: document.schemaVersion }
      : {})
  };
}

function pageIdIssues(
  document: Record<string, unknown>,
  pageId: string
): PromotionIssue[] {
  if (isPlaceholderPageId(pageId)) {
    return [{
      code: 'PAGE_ID_PLACEHOLDER',
      message: `正式页面 id 必须是可读且唯一的真实候选值:${pageId}`
    }];
  }
  if (document.id === pageId) {
    return [{
      code: 'PAGE_ID_UNCHANGED',
      message: `沉淀必须把临时页面 id 换为不同的正式页面 id:${pageId}`
    }];
  }
  return [];
}

function transientIdOf(document: Record<string, unknown>): string {
  return typeof document.id === 'string' ? document.id : '';
}

/** 改写出口的统一裁决:无临时 id 痕迹残留,且整体通过页面校验。 */
function rewrittenPageIssues(
  document: Record<string, unknown>,
  transientPageId: string
): PromotionIssue[] {
  if (transientPageId !== '' && JSON.stringify(document).includes(transientPageId)) {
    return [{
      code: 'TRANSIENT_ID_TRACE_REMAINING',
      message: `沉淀产物仍包含临时页面 id 痕迹:${transientPageId}`
    }];
  }
  const errors = validate(document);
  if (errors.length > 0) {
    return [{
      code: 'PAGE_VALIDATION_FAILED',
      message: '沉淀产物未通过页面校验',
      errors
    }];
  }
  return [];
}

interface QueryParts {
  outputMetrics: unknown[];
  initial: { capturedAt: string } | null;
  /** 去掉查询定义 filterBindings 后的同形数据源(其余键序原样保留)。 */
  withoutFilterBindings: Record<string, unknown>;
}

/** 解出 query 数据源的查询体要素;inline 或形状不符时返回 null。 */
function queryPartsOf(dataSource: unknown): QueryParts | null {
  if (!isRecord(dataSource) || !isRecord(dataSource.source)) return null;
  const source = dataSource.source;
  if (source.type !== 'query' || !isRecord(source.query)) return null;
  const { filterBindings: _removed, ...query } = source.query;

  const body = isRecord(source.query.body) ? source.query.body : {};
  const item = Array.isArray(body.dsl_list) && isRecord(body.dsl_list[0])
    ? body.dsl_list[0]
    : {};
  const initial =
    isRecord(source.initial) && typeof source.initial.capturedAt === 'string'
      ? { capturedAt: source.initial.capturedAt }
      : null;

  return {
    outputMetrics: Array.isArray(item.output_metrics) ? item.output_metrics : [],
    initial,
    withoutFilterBindings: { ...dataSource, source: { ...source, query } }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
