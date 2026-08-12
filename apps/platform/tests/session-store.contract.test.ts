import { describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { createMemoryAnalysisSessionStore } from '../src/lib/server/session/memory';
import {
  SESSION_RETENTION_MS,
  type AnalysisSessionStore
} from '../src/lib/server/session/store';
import {
  FAILURE_STAGES,
  type AnalysisStepEvent
} from '../src/lib/server/session/step-event';

/**
 * 分析会话存储的行为契约,按「内存 / PostgreSQL 同契约」的既有做法参数化
 * (参照 packages/page-lifecycle/tests/contract.ts)。本轮只有内存实现;
 * PostgreSQL 实现接入(#52 版本化迁移)时,新建 postgres 契约测试文件导入
 * runAnalysisSessionStoreContract,用同一批用例喂它,任何断言在某一实现下
 * 失败都说明两份实现出现了行为漂移。
 */

export interface AnalysisSessionStoreHarness {
  create(options: { clock: { now(): Date } }): Promise<AnalysisSessionStore>;
}

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

function routed(question: string): AnalysisStepEvent {
  return {
    type: 'domain_routed',
    question,
    routedDomains: ['运营分析'],
    overriddenByUser: false
  };
}

/** 覆盖全部七种事件的一条完整编排轨迹(域路由 → … → 文档就绪,外加一次失败)。 */
function fullTrace(question: string): AnalysisStepEvent[] {
  return [
    routed(question),
    {
      type: 'candidates_retrieved',
      candidates: [
        { metricName: '客户数', businessDomain: '运营分析', definitionDifference: '含试用客户' },
        { metricName: '客户数', businessDomain: '客户经营', definitionDifference: '仅付费客户' }
      ],
      selectedMetric: '客户数',
      adHocDefinition: null
    },
    {
      type: 'scope_card_presented',
      businessDomain: '运营分析',
      metricName: '客户数',
      adHocDefinition: null,
      timeRange: '2026-01-01..2026-06-30',
      granularity: 'month',
      filters: [{ dimension: '区域', values: ['华东'] }],
      blockedOnConfirmation: true
    },
    {
      type: 'execution_started',
      effectiveQuery: {
        output_metrics: ['客户数'],
        output_dims: ['月份'],
        filters: { 区域: ['华东'] }
      }
    },
    {
      type: 'rows_ready',
      summary: { rowCount: 6, totalCount: 6, outputFields: ['月份', '客户数'] }
    },
    {
      type: 'document_ready',
      intent: 'trend',
      components: [{ componentType: 'lineChart', pinnedByUser: false }],
      transientPageId: 'transient-page-1'
    },
    {
      type: 'step_failed',
      stage: 'presentation',
      code: 'COMPONENT_UNSUPPORTED_SHAPE',
      message: '结果形状不满足组件硬闸'
    }
  ];
}

export function runAnalysisSessionStoreContract(harness: AnalysisSessionStoreHarness): void {
  describe('分析会话存储契约(内存与未来 postgres 必须一致)', () => {
    it('事件按追加顺序落库,序号从 1 起且同一时钟毫秒内仍稳定', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      const trace = fullTrace('华东各月客户数走势?');
      for (const event of trace) {
        const appended = await store.appendEvent({ sessionId: 's-1', event }, developerOne);
        expect(appended.ok).toBe(true);
      }

      const result = await store.getSession({ sessionId: 's-1' }, developerOne);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.session.events.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(result.session.events.map((entry) => entry.event)).toEqual(trace);
      expect(result.session.eventCount).toBe(7);
      expect(result.session.question).toBe('华东各月客户数走势?');
      expect(result.session.actorId).toBe('developer-1');
    });

    it('失败事件完整保留发现/生成/执行/呈现四段分类', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      for (const stage of FAILURE_STAGES) {
        await store.appendEvent(
          {
            sessionId: 'failures',
            event: { type: 'step_failed', stage, code: `E_${stage}`, message: stage }
          },
          developerOne
        );
      }
      const result = await store.getSession({ sessionId: 'failures' }, developerOne);
      if (!result.ok) throw new Error(result.error.message);
      expect(
        result.session.events.map((entry) =>
          entry.event.type === 'step_failed' ? entry.event.stage : null
        )
      ).toEqual([...FAILURE_STAGES]);
    });

    it('换用户读不到他人会话:不可见与不存在同响应', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 'owned-by-one', event: routed('q1') }, developerOne);

      const result = await store.getSession({ sessionId: 'owned-by-one' }, developerTwo);
      expect(result).toEqual({
        ok: false,
        error: { code: 'SESSION_NOT_FOUND', message: expect.any(String) }
      });
      const listed = await store.listSessions(developerTwo);
      expect(listed.sessions).toEqual([]);
    });

    it('向他人会话追加事件被拒,原会话不被篡改', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 'owned-by-one', event: routed('q1') }, developerOne);

      const denied = await store.appendEvent(
        { sessionId: 'owned-by-one', event: routed('q2') },
        developerTwo
      );
      expect(denied.ok).toBe(false);
      if (denied.ok) throw new Error('expected failure');
      expect(denied.error.code).toBe('SESSION_ACTOR_MISMATCH');

      // admin 的特权只在读取侧,追加同样只限本人。
      const deniedForAdmin = await store.appendEvent(
        { sessionId: 'owned-by-one', event: routed('q3') },
        platformAdmin
      );
      expect(deniedForAdmin.ok).toBe(false);

      const owner = await store.getSession({ sessionId: 'owned-by-one' }, developerOne);
      if (!owner.ok) throw new Error(owner.error.message);
      expect(owner.session.eventCount).toBe(1);
      expect(owner.session.question).toBe('q1');
    });

    it('admin 能读取任何人的会话并列出全部', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 'one-a', event: routed('q1') }, developerOne);
      clock.advanceMs(1000);
      await store.appendEvent({ sessionId: 'one-b', event: routed('q2') }, developerOne);
      clock.advanceMs(1000);
      await store.appendEvent({ sessionId: 'two-a', event: routed('q3') }, developerTwo);

      const read = await store.getSession({ sessionId: 'two-a' }, platformAdmin);
      expect(read.ok).toBe(true);

      const all = await store.listSessions(platformAdmin);
      expect(all.sessions.map((session) => session.sessionId)).toEqual([
        'two-a',
        'one-b',
        'one-a'
      ]);

      const own = await store.listSessions(developerOne);
      expect(own.sessions.map((session) => session.sessionId)).toEqual(['one-b', 'one-a']);
    });

    it('列表按最后活跃时间倒序,同刻按 sessionId 稳定排序', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 'b-session', event: routed('q1') }, developerOne);
      await store.appendEvent({ sessionId: 'a-session', event: routed('q2') }, developerOne);
      clock.advanceMs(1000);
      await store.appendEvent({ sessionId: 'c-session', event: routed('q3') }, developerOne);

      const listed = await store.listSessions(developerOne);
      expect(listed.sessions.map((session) => session.sessionId)).toEqual([
        'c-session',
        'a-session',
        'b-session'
      ]);
    });

    it('保留期恰满 90 天仍可见,超过后读与列出都看不到', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 'aging', event: routed('q1') }, developerOne);

      clock.advanceMs(SESSION_RETENTION_MS);
      const atBoundary = await store.getSession({ sessionId: 'aging' }, developerOne);
      expect(atBoundary.ok).toBe(true);

      clock.advanceMs(1);
      const expired = await store.getSession({ sessionId: 'aging' }, developerOne);
      expect(expired.ok).toBe(false);
      const listed = await store.listSessions(platformAdmin);
      expect(listed.sessions).toEqual([]);
    });

    it('保留期按最后活跃时间计:持续追加的会话不过期', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
      await store.appendEvent({ sessionId: 'active', event: routed('q1') }, developerOne);
      clock.advanceMs(sixtyDaysMs);
      await store.appendEvent(
        {
          sessionId: 'active',
          event: { type: 'step_failed', stage: 'execution', code: 'E', message: 'retry' }
        },
        developerOne
      );
      // 距首个事件已 120 天,但距最后事件仅 60 天,仍在保留期内。
      clock.advanceMs(sixtyDaysMs);
      const result = await store.getSession({ sessionId: 'active' }, developerOne);
      expect(result.ok).toBe(true);
    });

    it('过期清理按注入时钟可复现,并返回删除数量', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      await store.appendEvent({ sessionId: 'first', event: routed('q1') }, developerOne);
      clock.advanceMs(tenDaysMs);
      await store.appendEvent({ sessionId: 'second', event: routed('q2') }, developerTwo);

      clock.advanceMs(SESSION_RETENTION_MS - tenDaysMs + 1);
      expect(await store.pruneExpiredSessions()).toEqual({ removedSessions: 1 });
      expect(await store.pruneExpiredSessions()).toEqual({ removedSessions: 0 });
      const remaining = await store.listSessions(platformAdmin);
      expect(remaining.sessions.map((session) => session.sessionId)).toEqual(['second']);

      clock.advanceMs(tenDaysMs);
      expect(await store.pruneExpiredSessions()).toEqual({ removedSessions: 1 });
      expect((await store.listSessions(platformAdmin)).sessions).toEqual([]);
    });

    it('读取返回隔离副本,外部修改不影响已落库事件', async () => {
      const clock = testClock('2026-08-01T00:00:00Z');
      const store = await harness.create({ clock });
      await store.appendEvent({ sessionId: 's-1', event: routed('原始问题') }, developerOne);

      const first = await store.getSession({ sessionId: 's-1' }, developerOne);
      if (!first.ok) throw new Error(first.error.message);
      const event = first.session.events[0].event;
      if (event.type === 'domain_routed') {
        (event as { question: string }).question = '被篡改的问题';
      }

      const second = await store.getSession({ sessionId: 's-1' }, developerOne);
      if (!second.ok) throw new Error(second.error.message);
      expect(second.session.question).toBe('原始问题');
    });
  });
}

runAnalysisSessionStoreContract({
  create: async (options) => createMemoryAnalysisSessionStore(options)
});
