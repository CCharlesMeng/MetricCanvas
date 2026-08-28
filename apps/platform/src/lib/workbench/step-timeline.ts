import type { RunStep, ScopeCardView } from './run-state';

/**
 * 步骤时间线的呈现折叠(ADR-0055 多单元轮次)。
 *
 * 一轮问数触及多个取数单元时,取数核对、真实执行、结果就绪三类步骤按单元
 * 各产出一次。逐条渲染会出现逐字相同的行——三行「完整生效范围已回显,直接
 * 执行」不比一行多说明任何事,而单元之间真正的差别(指标、切分、时间窗口)
 * 反而没露出来。这里把按单元重复的步骤折成一条,并只列出组内真正不同的那些
 * 口径面,同时保持 run-state 的事件序列逐条保真(回放与既有测试不受折叠
 * 影响)。
 *
 * 折的是「重复出现的步骤周期」而不只是连续同类:单元的执行是流水的,真实
 * 会话里三个单元产生的是 执行→就绪→执行→就绪→执行→就绪,同类步骤并不相邻。
 * 周期识别把这段折成「真实执行 ×3」+「结果就绪 ×3」两条,周期内的先后顺序
 * 就是原顺序。
 *
 * 只折叠这三类:其余步骤本就一轮一条,或(工具调用)各自带不同名称。
 */

/** 可折叠的步骤类别:这三类按取数单元重复出现。 */
const COLLAPSIBLE_KINDS = ['scope_card', 'execution_started', 'rows_ready'] as const;

/** 周期最长为可折叠类别的全集:取数核对、真实执行、结果就绪各一次。 */
const MAX_CYCLE_LENGTH = COLLAPSIBLE_KINDS.length;

export interface TimelineEntry {
  /** 组内首个步骤:决定图标与标题。 */
  head: RunStep;
  /** 组内步骤数;1 表示未发生折叠。 */
  count: number;
  /**
   * 该条的说明文字。可折叠的三类在此给出(含单条形态),其余为 null,由呈现
   * 侧按自己的结构渲染(工具调用状态、失败错误码等带内联标记,不是纯文本)。
   */
  detail: string | null;
}

export function collapseSteps(steps: readonly RunStep[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let index = 0;
  while (index < steps.length) {
    const cycle = cycleAt(steps, index);
    if (cycle === null) {
      const head = steps[index]!;
      entries.push({
        head,
        count: 1,
        detail: isCollapsible(head) ? detailOf([head]) : null
      });
      index += 1;
      continue;
    }
    for (let offset = 0; offset < cycle.length; offset += 1) {
      const group = Array.from(
        { length: cycle.repeats },
        (_, repeat) => steps[index + repeat * cycle.length + offset]!
      );
      entries.push({ head: group[0]!, count: group.length, detail: detailOf(group) });
    }
    index += cycle.length * cycle.repeats;
  }
  return entries;
}

/**
 * 从 index 起的重复周期:周期内各步骤类别互不相同且都可折叠,整段至少重复
 * 两轮。优先取最短周期(连续同类是长度 1 的特例)。
 */
function cycleAt(
  steps: readonly RunStep[],
  index: number
): { length: number; repeats: number } | null {
  for (let length = 1; length <= MAX_CYCLE_LENGTH; length += 1) {
    if (index + length * 2 > steps.length) break;
    const pattern = steps.slice(index, index + length);
    if (!pattern.every(isCollapsible)) break;
    if (new Set(pattern.map((step) => step.kind)).size !== length) continue;
    let repeats = 1;
    while (
      index + (repeats + 1) * length <= steps.length &&
      pattern.every((step, offset) => groupsWith(step, steps[index + repeats * length + offset]!))
    ) {
      repeats += 1;
    }
    if (repeats >= 2) return { length, repeats };
  }
  return null;
}

function isCollapsible(step: RunStep): boolean {
  return (COLLAPSIBLE_KINDS as readonly string[]).includes(step.kind);
}

/**
 * 同类且可并入同一条。取数核对额外要求确认状态一致:等待确认的那张卡是
 * 本轮唯一需要用户动作的步骤,不能被并进「直接执行」的组里消失。
 */
function groupsWith(head: RunStep, next: RunStep): boolean {
  if (head.kind !== next.kind) return false;
  if (head.kind === 'scope_card' && next.kind === 'scope_card') {
    return (
      head.card.blockedOnConfirmation === next.card.blockedOnConfirmation &&
      head.card.awaitingConfirmation === next.card.awaitingConfirmation
    );
  }
  return true;
}

function detailOf(group: readonly RunStep[]): string | null {
  const head = group[0]!;
  switch (head.kind) {
    case 'scope_card':
      return scopeDetail(group.map((step) => (step as Extract<RunStep, { kind: 'scope_card' }>).card));
    case 'execution_started':
      return group.length === 1
        ? '生效查询已提交服务端取数入口'
        : `${group.length} 个生效查询已提交服务端取数入口`;
    case 'rows_ready':
      return rowsDetail(
        group.map((step) => (step as Extract<RunStep, { kind: 'rows_ready' }>).summary)
      );
    default:
      return null;
  }
}

/** 口径面:取数核对之间可能不同的维度,顺序即呈现顺序。 */
const SCOPE_FACETS: ReadonlyArray<{ label: string; of: (card: ScopeCardView) => string }> = [
  { label: '业务域', of: (card) => card.businessDomain },
  { label: '指标', of: metricLabelOf },
  { label: '切分', of: (card) => (card.groupBy.length > 0 ? card.groupBy.join('、') : '不切分') },
  { label: '时间', of: (card) => `${card.timeRange} · ${card.granularity}` },
  { label: '筛选', of: filtersLabelOf }
];

function scopeDetail(cards: readonly ScopeCardView[]): string {
  const base = cards[0]!.blockedOnConfirmation
    ? '命中阻塞条件,执行前等待确认'
    : '完整生效范围已回显,直接执行';
  if (cards.length === 1) {
    const metric = metricLabelOf(cards[0]!);
    return metric === '' ? base : `${metric} · ${base}`;
  }
  // 只列组内真正不同的口径面:相同的部分逐卡重复一遍才是噪声,而卡片区
  // 本来就完整回显了每个单元的全部生效范围。
  const differing = SCOPE_FACETS.filter(
    (facet) => new Set(cards.map((card) => facet.of(card))).size > 1
  );
  const spread =
    differing.length === 0
      ? '口径一致'
      : cards
          .map((card) => differing.map((facet) => facet.of(card)).join(' · '))
          .join(' / ');
  return `${cards.length} 个取数单元 · ${spread} · ${base}`;
}

function metricLabelOf(card: ScopeCardView): string {
  if (card.metricName !== null) return card.metricName;
  return card.adHocDefinition?.formula ?? '';
}

function filtersLabelOf(card: ScopeCardView): string {
  if (card.filters.length === 0) return '无筛选';
  return card.filters
    .map((filter) => `${filter.dimension}=${filter.values.join(',')}`)
    .join(';');
}

/**
 * 结果就绪折叠后只报规模。各批取了什么指标由同轮的取数核对那条承担,
 * 在这里再列一遍输出字段就是把同一件事说两次。
 */
function rowsDetail(
  summaries: ReadonlyArray<{
    rowCount: number;
    totalCount: number | null;
    outputFields: readonly string[];
  }>
): string {
  const first = summaries[0]!;
  if (summaries.length === 1) {
    const total = first.totalCount !== null ? ` · 总数 ${first.totalCount}` : '';
    return `${first.rowCount} 行${total} · 输出字段 ${first.outputFields.join('、')}`;
  }
  const counts = summaries.map((summary) => summary.rowCount);
  const uniform = new Set(counts).size === 1;
  const scale = uniform
    ? `各 ${first.rowCount} 行`
    : `共 ${counts.reduce((sum, count) => sum + count, 0)} 行(${counts.join(' / ')})`;
  return `${summaries.length} 批结果 · ${scale}`;
}
