import { describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { createMemoryAnalysisSessionStore } from '../src/lib/server/session/memory';
import {
  adHocGapKey,
  aggregateMetricGapEntries,
  createSessionMetricGapLedger,
  normalizeExpressionShape,
  scopeGapKey,
  type MetricGapLedger
} from '../src/lib/server/session/metric-gap';
import type {
  AnalysisSessionStore
} from '../src/lib/server/session/store';
import type { MetricGapOccurrence } from '../src/lib/server/session/step-event';

/**
 * 指标需求条目台账自证(#67,ADR-0036):
 * - 幂等键去重与出现次数累加,不产生重复条目;
 * - 高频缺口与高频表达式形状同键合并,一份排行,不建两套;
 * - 状态流转 open → accepted → fulfilled/rejected,fulfilled 必须关联
 *   真实存在的指标条目;
 * - 采集通道只有会话事件流,可见性沿用会话存储规则(ADR-0030)。
 */

const developerOne: LifecycleContext = {
  actorId: 'developer-1',
  clientId: 'workbench',
  roles: ['publisher']
};
const developerTwo: LifecycleContext = {
  actorId: 'developer-2',
  clientId: 'workbench',
  roles: ['publisher']
};
const platformAdmin: LifecycleContext = {
  actorId: 'admin-1',
  clientId: 'workbench',
  roles: ['publisher', 'admin']
};

function testClock(startIso: string): { now(): Date; advanceMs(ms: number): void } {
  let current = new Date(startIso).getTime();
  return {
    now: () => new Date(current),
    advanceMs(ms: number) {
      current += ms;
    }
  };
}

function occurrence(overrides: Partial<MetricGapOccurrence> = {}): MetricGapOccurrence {
  return {
    idempotencyKey: adHocGapKey('运营分析', '计费Tokens量 / Tokens消耗量'),
    question: '上个月各区域的计费占比是多少?',
    searchTerms: ['计费Tokens量'],
    closestCandidates: [
      { metricName: '计费Tokens量', businessDomain: '运营分析', definitionDifference: '仅计费部分' }
    ],
    adHocDefinition: { formula: '计费Tokens量 / Tokens消耗量', description: '计费占比' },
    expectedDimensions: ['区域'],
    expectedGranularity: 'month',
    businessDomain: '运营分析',
    ...overrides
  };
}

async function appendGap(
  store: AnalysisSessionStore,
  sessionId: string,
  gap: MetricGapOccurrence,
  context: LifecycleContext = developerOne
): Promise<void> {
  const appended = await store.appendEvent(
    { sessionId, event: { type: 'metric_gap_recorded', gap } },
    context
  );
  expect(appended.ok).toBe(true);
}

function ledgerOver(
  store: AnalysisSessionStore,
  knownMetrics: ReadonlyArray<{ businessDomain: string; metricName: string }> = [
    { businessDomain: '运营分析', metricName: '计费占比' }
  ]
): MetricGapLedger {
  return createSessionMetricGapLedger({
    sessions: store,
    metricExists: async (reference) =>
      knownMetrics.some(
        (metric) =>
          metric.businessDomain === reference.businessDomain &&
          metric.metricName === reference.metricName
      )
  });
}

describe('幂等键派生:同一缺口的重复出现共享同一键', () => {
  it('表达式形状归一:大小写、空白与数字字面不改变口径形状', () => {
    expect(normalizeExpressionShape('计费Tokens量 / Tokens消耗量')).toBe(
      normalizeExpressionShape('计费tokens量/TOKENS消耗量')
    );
    expect(normalizeExpressionShape('消耗量 * 0.85')).toBe(
      normalizeExpressionShape('消耗量*0.9')
    );
    expect(normalizeExpressionShape('a / b')).not.toBe(normalizeExpressionShape('a * b'));
  });

  it('临时口径键 = 业务域 + 表达式形状;面外键 = 业务域 + 归一化检索对象', () => {
    expect(adHocGapKey('运营分析', '计费Tokens量 / Tokens消耗量')).toBe(
      adHocGapKey('运营分析', '计费tokens量/Tokens消耗量')
    );
    expect(adHocGapKey('运营分析', 'a/b')).not.toBe(adHocGapKey('客户经营', 'a/b'));
    expect(scopeGapKey('客户经营', '员工离职率是多少?')).toBe(
      scopeGapKey('客户经营', '员工离职率 是多少')
    );
    expect(scopeGapKey('客户经营', 'NPS')).not.toBe(scopeGapKey('客户经营', '离职率'));
  });
});

describe('聚合:去重、计数与合并排行', () => {
  it('同一幂等键折叠为一个条目并累加出现次数,内容取最近一次出现', () => {
    const key = adHocGapKey('运营分析', '计费Tokens量 / Tokens消耗量');
    const entries = aggregateMetricGapEntries([
      { occurredAt: '2026-08-01T00:00:00.000Z', gap: occurrence({ question: '第一次问法' }) },
      {
        occurredAt: '2026-08-02T00:00:00.000Z',
        gap: occurrence({ question: '第二次问法', expectedDimensions: ['区域', '客户级别'] })
      },
      { occurredAt: '2026-08-03T00:00:00.000Z', gap: occurrence({ question: '第二次问法' }) }
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      idempotencyKey: key,
      status: 'open',
      occurrenceCount: 3,
      firstSeenAt: '2026-08-01T00:00:00.000Z',
      lastSeenAt: '2026-08-03T00:00:00.000Z',
      question: '第二次问法',
      fulfilledMetric: null
    });
    // distinct 问题原文,最近优先。
    expect(entries[0]!.questions).toEqual(['第二次问法', '第一次问法']);
  });

  it('高频缺口与高频表达式形状在同一份排行里,按出现次数降序', () => {
    const formulaGap = occurrence();
    const scopeGap = occurrence({
      idempotencyKey: scopeGapKey('客户经营', 'NPS'),
      searchTerms: ['NPS'],
      adHocDefinition: null,
      businessDomain: '客户经营'
    });
    const entries = aggregateMetricGapEntries([
      { occurredAt: '2026-08-01T00:00:00.000Z', gap: scopeGap },
      { occurredAt: '2026-08-02T00:00:00.000Z', gap: formulaGap },
      { occurredAt: '2026-08-03T00:00:00.000Z', gap: scopeGap },
      { occurredAt: '2026-08-04T00:00:00.000Z', gap: scopeGap }
    ]);

    // 一份排行合并两类缺口:临时口径(表达式形状)与面外(检索对象)。
    expect(entries.map((entry) => [entry.idempotencyKey, entry.occurrenceCount])).toEqual([
      [scopeGap.idempotencyKey, 3],
      [formulaGap.idempotencyKey, 1]
    ]);
  });
});

describe('台账:会话事件流是唯一采集通道,可见性沿用会话存储', () => {
  it('跨会话的同一缺口合并为一个条目;换用户看不到他人缺口,admin 可见全部', async () => {
    const clock = testClock('2026-08-01T00:00:00Z');
    const store = createMemoryAnalysisSessionStore({ clock });
    await appendGap(store, 'session-a', occurrence());
    clock.advanceMs(1000);
    await appendGap(store, 'session-b', occurrence({ question: '换个说法再问一次' }));
    clock.advanceMs(1000);
    await appendGap(
      store,
      'session-c',
      occurrence({ question: '第三个人也问了' }),
      developerTwo
    );

    const ledger = ledgerOver(store);
    // 本人视角:developer-1 的两次出现合并为一个条目,计数 2。
    const own = await ledger.listEntries(developerOne);
    expect(own.entries).toHaveLength(1);
    expect(own.entries[0]).toMatchObject({ occurrenceCount: 2, status: 'open' });

    // developer-2 看不到 developer-1 的会话,只有自己的一次出现。
    const other = await ledger.listEntries(developerTwo);
    expect(other.entries).toHaveLength(1);
    expect(other.entries[0]).toMatchObject({ occurrenceCount: 1 });

    // admin 聚合全部会话:同一幂等键跨 actor 合并,计数 3,不产生重复条目。
    const all = await ledger.listEntries(platformAdmin);
    expect(all.entries).toHaveLength(1);
    expect(all.entries[0]).toMatchObject({ occurrenceCount: 3 });
  });
});

describe('状态流转:open → accepted → fulfilled/rejected(#36 内核)', () => {
  async function storeWithGap(): Promise<{ store: AnalysisSessionStore; key: string }> {
    const store = createMemoryAnalysisSessionStore({
      clock: testClock('2026-08-01T00:00:00Z')
    });
    const gap = occurrence();
    await appendGap(store, 'session-a', gap);
    return { store, key: gap.idempotencyKey };
  }

  it('open 必须先 accepted;accepted 后可 fulfilled(关联真实指标)或 rejected', async () => {
    const { store, key } = await storeWithGap();
    const ledger = ledgerOver(store);

    // open → fulfilled 越级不放行。
    const skipped = await ledger.transition(
      { idempotencyKey: key, to: 'fulfilled', fulfilledMetric: { businessDomain: '运营分析', metricName: '计费占比' } },
      developerOne
    );
    expect(skipped).toMatchObject({ ok: false, error: { code: 'GAP_TRANSITION_INVALID' } });

    const accepted = await ledger.transition({ idempotencyKey: key, to: 'accepted' }, developerOne);
    expect(accepted).toMatchObject({ ok: true, entry: { status: 'accepted' } });

    const fulfilled = await ledger.transition(
      { idempotencyKey: key, to: 'fulfilled', fulfilledMetric: { businessDomain: '运营分析', metricName: '计费占比' } },
      developerOne
    );
    expect(fulfilled).toMatchObject({
      ok: true,
      entry: {
        status: 'fulfilled',
        fulfilledMetric: { businessDomain: '运营分析', metricName: '计费占比' }
      }
    });

    // 终态不再流转;状态叠加在后续读取上保持。
    const reopened = await ledger.transition({ idempotencyKey: key, to: 'accepted' }, developerOne);
    expect(reopened).toMatchObject({ ok: false, error: { code: 'GAP_TRANSITION_INVALID' } });
    const listed = await ledger.listEntries(developerOne);
    expect(listed.entries[0]).toMatchObject({ status: 'fulfilled' });
  });

  it('fulfilled 必须关联真实存在的指标条目:缺关联或指标不存在都不放行', async () => {
    const { store, key } = await storeWithGap();
    const ledger = ledgerOver(store);
    await ledger.transition({ idempotencyKey: key, to: 'accepted' }, developerOne);

    const missing = await ledger.transition({ idempotencyKey: key, to: 'fulfilled' }, developerOne);
    expect(missing).toMatchObject({
      ok: false,
      error: { code: 'GAP_FULFILLED_METRIC_UNKNOWN' }
    });

    const unknown = await ledger.transition(
      {
        idempotencyKey: key,
        to: 'fulfilled',
        fulfilledMetric: { businessDomain: '运营分析', metricName: '不存在的指标' }
      },
      developerOne
    );
    expect(unknown).toMatchObject({
      ok: false,
      error: { code: 'GAP_FULFILLED_METRIC_UNKNOWN' }
    });
    // 失败的流转不改变状态。
    expect((await ledger.listEntries(developerOne)).entries[0]).toMatchObject({
      status: 'accepted'
    });
  });

  it('accepted → rejected 放行;不可见的条目按不存在处理', async () => {
    const { store, key } = await storeWithGap();
    const ledger = ledgerOver(store);
    await ledger.transition({ idempotencyKey: key, to: 'accepted' }, developerOne);
    const rejected = await ledger.transition({ idempotencyKey: key, to: 'rejected' }, developerOne);
    expect(rejected).toMatchObject({ ok: true, entry: { status: 'rejected' } });

    // developer-2 不可见 developer-1 的缺口:与不存在同响应。
    const invisible = await ledger.transition(
      { idempotencyKey: key, to: 'accepted' },
      developerTwo
    );
    expect(invisible).toMatchObject({ ok: false, error: { code: 'GAP_NOT_FOUND' } });
  });
});
