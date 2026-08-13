import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { MetricGapOccurrence } from './step-event';
import type { AnalysisSessionStore } from './store';

/**
 * 指标需求条目(CONTEXT.md:Metric Gap Entry)的聚合与治理(ADR-0036、#67)。
 *
 * 采集通道只有一条:缺口出现以 metric_gap_recorded 步骤事件随会话事件流
 * 落库(./step-event.ts 是出现形状的唯一真源)。本模块在其上做三件事:
 *
 * 1. 幂等键派生:临时口径缺口按「业务域 + 表达式形状」,面外缺口按
 *    「业务域 + 归一化检索对象」。高频缺口与高频 formula 形状因此指向
 *    同一批条目,一份排行即可合并查看,不建两套(ADR-0036)。
 * 2. 聚合:同一幂等键的多次出现折叠为一个条目并累加出现次数,不产生
 *    重复条目;结构化内容取最近一次出现(口径差异随快照演进)。
 * 3. 状态流转(#36 内核的继承):open → accepted → fulfilled/rejected;
 *    fulfilled 必须关联真实存在的指标条目,由注入的 metricExists 端口裁决。
 *
 * 可见性沿用会话存储的规则(ADR-0030):条目从调用者可见的会话聚合而来,
 * 本人只见自己会话产生的缺口,平台管理员可见全部。状态台账当前为进程内
 * 实现;PostgreSQL 落库等 #52 的版本化迁移接入。
 */

export const METRIC_GAP_STATUSES = ['open', 'accepted', 'fulfilled', 'rejected'] as const;
export type MetricGapStatus = (typeof METRIC_GAP_STATUSES)[number];

/** 合法流转的唯一声明:open 先被数据侧接受,接受后才有履约或拒绝。 */
const LEGAL_TRANSITIONS: Record<MetricGapStatus, readonly MetricGapStatus[]> = {
  open: ['accepted'],
  accepted: ['fulfilled', 'rejected'],
  fulfilled: [],
  rejected: []
};

/* ---------- 幂等键派生 ---------- */

/**
 * 表达式形状归一:大小写、空白与具体数字字面不改变口径形状。
 * `计费Tokens量/2` 与 `计费tokens量 / 2.0` 是同一形状。
 */
export function normalizeExpressionShape(expression: string): string {
  return expression
    .toLowerCase()
    .replaceAll(/\d+(?:\.\d+)?/gu, '#')
    .replaceAll(/\s+/gu, '');
}

/** 临时口径缺口的幂等键:业务域 + 表达式形状。 */
export function adHocGapKey(businessDomain: string, expression: string): string {
  return `adhoc:${businessDomain}:${normalizeExpressionShape(expression)}`;
}

/** 面外缺口的幂等键:业务域 + 归一化的检索对象(缺失口径描述或问题原文)。 */
export function scopeGapKey(businessDomain: string, sought: string): string {
  const normalized = sought
    .toLowerCase()
    .replaceAll(/[\s??。.!!,,、;;::""''()()]+/gu, '');
  return `scope:${businessDomain}:${normalized}`;
}

/* ---------- 聚合 ---------- */

/** 一次已落库的缺口出现:事件本体加上会话存储分配的落库时刻。 */
export interface RecordedMetricGapOccurrence {
  occurredAt: string;
  gap: MetricGapOccurrence;
}

/** 条目保留的 distinct 问题原文条数上限(最近优先)。 */
const MAX_QUESTIONS_PER_ENTRY = 5;

/** 指标需求条目:同一幂等键的全部出现聚合而成,带出现次数与状态。 */
export interface MetricGapEntry {
  idempotencyKey: string;
  status: MetricGapStatus;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** 以下结构化内容取最近一次出现。 */
  question: string;
  searchTerms: MetricGapOccurrence['searchTerms'];
  closestCandidates: MetricGapOccurrence['closestCandidates'];
  adHocDefinition: MetricGapOccurrence['adHocDefinition'];
  expectedDimensions: MetricGapOccurrence['expectedDimensions'];
  expectedGranularity: MetricGapOccurrence['expectedGranularity'];
  businessDomain: string;
  /** distinct 问题原文,最近优先,至多 MAX_QUESTIONS_PER_ENTRY 条。 */
  questions: readonly string[];
  /** fulfilled 时关联的真实指标条目;其余状态为 null。 */
  fulfilledMetric: { businessDomain: string; metricName: string } | null;
}

/**
 * 纯函数聚合:按幂等键去重、累加出现次数。状态一律 open,由台账叠加。
 * 排序即合并排行:出现次数降序,同次数按最近出现降序。
 */
export function aggregateMetricGapEntries(
  occurrences: readonly RecordedMetricGapOccurrence[]
): MetricGapEntry[] {
  const byKey = new Map<string, RecordedMetricGapOccurrence[]>();
  for (const occurrence of occurrences) {
    const group = byKey.get(occurrence.gap.idempotencyKey) ?? [];
    group.push(occurrence);
    byKey.set(occurrence.gap.idempotencyKey, group);
  }
  const entries: MetricGapEntry[] = [];
  for (const [idempotencyKey, group] of byKey) {
    const ordered = [...group].sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt)
    );
    const latest = ordered.at(-1)!.gap;
    const questions: string[] = [];
    for (const { gap } of [...ordered].reverse()) {
      if (questions.includes(gap.question)) continue;
      questions.push(gap.question);
      if (questions.length >= MAX_QUESTIONS_PER_ENTRY) break;
    }
    entries.push({
      idempotencyKey,
      status: 'open',
      occurrenceCount: ordered.length,
      firstSeenAt: ordered[0]!.occurredAt,
      lastSeenAt: ordered.at(-1)!.occurredAt,
      question: latest.question,
      searchTerms: latest.searchTerms,
      closestCandidates: latest.closestCandidates,
      adHocDefinition: latest.adHocDefinition,
      expectedDimensions: latest.expectedDimensions,
      expectedGranularity: latest.expectedGranularity,
      businessDomain: latest.businessDomain,
      questions,
      fulfilledMetric: null
    });
  }
  return entries.sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      left.idempotencyKey.localeCompare(right.idempotencyKey)
  );
}

/* ---------- 台账(聚合视图 + 状态流转) ---------- */

export type MetricGapTransitionErrorCode =
  | 'GAP_NOT_FOUND'
  | 'GAP_TRANSITION_INVALID'
  | 'GAP_FULFILLED_METRIC_UNKNOWN';

export interface MetricGapTransitionCommand {
  idempotencyKey: string;
  to: Exclude<MetricGapStatus, 'open'>;
  /** to = fulfilled 时必填,且必须指向数据上下文中真实存在的指标条目。 */
  fulfilledMetric?: { businessDomain: string; metricName: string };
}

export type MetricGapTransitionResult =
  | { ok: true; entry: MetricGapEntry }
  | { ok: false; error: { code: MetricGapTransitionErrorCode; message: string } };

export interface MetricGapLedger {
  /** 合并排行(唯一一份):出现次数降序;可见性沿用会话存储规则。 */
  listEntries(context: LifecycleContext): Promise<{ entries: MetricGapEntry[] }>;
  /** 状态流转:open → accepted → fulfilled/rejected。 */
  transition(
    command: MetricGapTransitionCommand,
    context: LifecycleContext
  ): Promise<MetricGapTransitionResult>;
}

export interface SessionMetricGapLedgerOptions {
  sessions: Pick<AnalysisSessionStore, 'listSessions' | 'getSession'>;
  /** fulfilled 关联校验端口:指标条目是否真实存在于数据上下文。 */
  metricExists(reference: {
    businessDomain: string;
    metricName: string;
  }): Promise<boolean>;
}

export function createSessionMetricGapLedger(
  options: SessionMetricGapLedgerOptions
): MetricGapLedger {
  /** 状态台账:进程内实现,PostgreSQL 落库等 #52。 */
  const statuses = new Map<
    string,
    { status: MetricGapStatus; fulfilledMetric: MetricGapEntry['fulfilledMetric'] }
  >();

  async function entriesVisibleTo(context: LifecycleContext): Promise<MetricGapEntry[]> {
    const occurrences: RecordedMetricGapOccurrence[] = [];
    const { sessions } = await options.sessions.listSessions(context);
    for (const summary of sessions) {
      const result = await options.sessions.getSession(
        { sessionId: summary.sessionId },
        context
      );
      if (!result.ok) continue;
      for (const recorded of result.session.events) {
        if (recorded.event.type !== 'metric_gap_recorded') continue;
        occurrences.push({ occurredAt: recorded.occurredAt, gap: recorded.event.gap });
      }
    }
    return aggregateMetricGapEntries(occurrences).map((entry) => {
      const overlay = statuses.get(entry.idempotencyKey);
      return overlay === undefined
        ? entry
        : { ...entry, status: overlay.status, fulfilledMetric: overlay.fulfilledMetric };
    });
  }

  return {
    async listEntries(context) {
      return { entries: await entriesVisibleTo(context) };
    },

    async transition(command, context) {
      const entries = await entriesVisibleTo(context);
      const entry = entries.find((item) => item.idempotencyKey === command.idempotencyKey);
      if (entry === undefined) {
        return failure('GAP_NOT_FOUND', `缺口条目 ${command.idempotencyKey} 不存在`);
      }
      if (!LEGAL_TRANSITIONS[entry.status].includes(command.to)) {
        return failure(
          'GAP_TRANSITION_INVALID',
          `缺口条目状态不允许 ${entry.status} → ${command.to};合法流转为 open → accepted → fulfilled/rejected`
        );
      }
      let fulfilledMetric: MetricGapEntry['fulfilledMetric'] = null;
      if (command.to === 'fulfilled') {
        if (command.fulfilledMetric === undefined) {
          return failure(
            'GAP_FULFILLED_METRIC_UNKNOWN',
            'fulfilled 必须关联真实存在的指标条目'
          );
        }
        if (!(await options.metricExists(command.fulfilledMetric))) {
          return failure(
            'GAP_FULFILLED_METRIC_UNKNOWN',
            `指标条目「${command.fulfilledMetric.businessDomain}·${command.fulfilledMetric.metricName}」不存在于数据上下文`
          );
        }
        fulfilledMetric = command.fulfilledMetric;
      }
      statuses.set(command.idempotencyKey, { status: command.to, fulfilledMetric });
      return { ok: true, entry: { ...entry, status: command.to, fulfilledMetric } };
    }
  };
}

function failure(
  code: MetricGapTransitionErrorCode,
  message: string
): { ok: false; error: { code: MetricGapTransitionErrorCode; message: string } } {
  return { ok: false, error: { code, message } };
}
