import { describe, expect, it } from 'vitest';
import type { RunStep, ScopeCardView } from '../../src/lib/workbench/run-state';
import { collapseSteps } from '../../src/lib/workbench/step-timeline';

/**
 * 时间线折叠(ADR-0055 多单元轮次):连续同类步骤折成一条,并只列出组内
 * 真正不同的口径面。基线取自真实会话
 * d7cbcbcf-092a-41ac-a417-f1e16b1be393——一句问题点到三个 Tokens 指标,
 * 折叠前时间线有三条逐字相同的取数核对与三条逐字相同的真实执行。
 */

function card(overrides: Partial<ScopeCardView> = {}): ScopeCardView {
  return {
    businessDomain: '运营分析',
    metricName: 'Tokens消耗量',
    adHocDefinition: null,
    groupBy: ['统计周期'],
    timeRange: '2026-01 ~ 2026-06',
    granularity: 'month',
    filters: [],
    blockedOnConfirmation: false,
    awaitingConfirmation: false,
    ...overrides
  };
}

function rows(outputMetric: string, rowCount = 6): RunStep {
  return {
    kind: 'rows_ready',
    summary: { rowCount, totalCount: rowCount, outputFields: ['统计周期', outputMetric] }
  };
}

/**
 * 真实会话的十二步:三张取数核对连着出,随后三个单元流水执行——真实执行
 * 与结果就绪交替出现,同类步骤并不相邻。
 */
const THREE_METRIC_RUN: RunStep[] = [
  {
    kind: 'domain_routed',
    question: '2026年上半年每个月的Tokens消耗量、计费Tokens量和Tokens请求量走势如何?',
    routedDomains: ['运营分析'],
    overriddenByUser: false
  },
  {
    kind: 'candidates_retrieved',
    candidates: [],
    selectedMetrics: ['Tokens消耗量', '计费Tokens量', 'Tokens请求量'],
    adHocDefinition: null
  },
  { kind: 'scope_card', card: card() },
  { kind: 'scope_card', card: card({ metricName: '计费Tokens量' }) },
  { kind: 'scope_card', card: card({ metricName: 'Tokens请求量' }) },
  { kind: 'execution_started' },
  rows('Tokens消耗量'),
  { kind: 'execution_started' },
  rows('计费Tokens量'),
  { kind: 'execution_started' },
  rows('Tokens请求量'),
  {
    kind: 'document_ready',
    components: [
      { componentType: 'lineChart', pinnedByUser: false, dataSourceId: 'result', intent: 'trend' }
    ],
    transientPageId: 'ask-transient-51456344'
  }
];

describe('时间线折叠:多单元轮次不重复同一句话', () => {
  it('三单元轮次的十二步折成六条', () => {
    const entries = collapseSteps(THREE_METRIC_RUN);
    expect(entries.map((entry) => [entry.head.kind, entry.count])).toEqual([
      ['domain_routed', 1],
      ['candidates_retrieved', 1],
      ['scope_card', 3],
      ['execution_started', 3],
      ['rows_ready', 3],
      ['document_ready', 1]
    ]);
  });

  it('取数核对合并后只列出组内不同的口径面:本例是指标', () => {
    const entries = collapseSteps(THREE_METRIC_RUN);
    expect(entries[2]!.detail).toBe(
      '3 个取数单元 · Tokens消耗量 / 计费Tokens量 / Tokens请求量 · 完整生效范围已回显,直接执行'
    );
  });

  it('结果就绪合并后只报规模,不重复各批取了什么指标', () => {
    const entries = collapseSteps(THREE_METRIC_RUN);
    expect(entries[3]!.detail).toBe('3 个生效查询已提交服务端取数入口');
    expect(entries[4]!.detail).toBe('3 批结果 · 各 6 行');
  });

  it('行数不一致时报总数与各批行数', () => {
    const entries = collapseSteps([rows('A', 6), rows('B', 4), rows('C', 1)]);
    expect(entries[0]!.detail).toBe('3 批结果 · 共 11 行(6 / 4 / 1)');
  });

  it('指标相同而切分不同时列出切分:同一指标多视角是最常见的多单元形态', () => {
    const entries = collapseSteps([
      { kind: 'scope_card', card: card({ groupBy: [] }) },
      { kind: 'scope_card', card: card({ groupBy: ['统计周期'] }) },
      { kind: 'scope_card', card: card({ groupBy: ['行业'] }) }
    ]);
    expect(entries[0]!.detail).toBe(
      '3 个取数单元 · 不切分 / 统计周期 / 行业 · 完整生效范围已回显,直接执行'
    );
  });

  it('组内逐字相同时如实说口径一致,不编造差别', () => {
    const entries = collapseSteps([
      { kind: 'scope_card', card: card() },
      { kind: 'scope_card', card: card() }
    ]);
    expect(entries[0]!.detail).toBe('2 个取数单元 · 口径一致 · 完整生效范围已回显,直接执行');
  });

  it('等待确认的取数核对不被并进直接执行的组里', () => {
    const blocked = card({
      metricName: null,
      adHocDefinition: { formula: '消耗量 / 总量', description: null },
      blockedOnConfirmation: true,
      awaitingConfirmation: true
    });
    const entries = collapseSteps([
      { kind: 'scope_card', card: card() },
      { kind: 'scope_card', card: blocked }
    ]);
    expect(entries.map((entry) => entry.count)).toEqual([1, 1]);
    expect(entries[1]!.detail).toBe('消耗量 / 总量 · 命中阻塞条件,执行前等待确认');
  });

  it('单条步骤保留完整说明:取数核对带指标名,结果就绪带输出字段', () => {
    const entries = collapseSteps([{ kind: 'scope_card', card: card() }, rows('Tokens消耗量')]);
    expect(entries[0]!.detail).toBe('Tokens消耗量 · 完整生效范围已回显,直接执行');
    expect(entries[1]!.detail).toBe('6 行 · 总数 6 · 输出字段 统计周期、Tokens消耗量');
  });

  it('工具调用不折叠:各自带不同名称与状态', () => {
    const entries = collapseSteps([
      {
        kind: 'tool_call',
        toolCallId: 'c1',
        toolName: 'search_data_context',
        status: 'succeeded',
        errorCode: null
      },
      {
        kind: 'tool_call',
        toolCallId: 'c2',
        toolName: 'execute_query',
        status: 'running',
        errorCode: null
      }
    ]);
    expect(entries.map((entry) => entry.count)).toEqual([1, 1]);
    expect(entries.map((entry) => entry.detail)).toEqual([null, null]);
  });
});
