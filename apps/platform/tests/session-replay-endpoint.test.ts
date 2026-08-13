import { describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { createMemoryAnalysisSessionStore } from '../src/lib/server/session/memory';
import { handleSessionReplayRequest } from '../src/lib/server/session/replay-endpoint';
import type { AnalysisStepEvent } from '../src/lib/server/session/step-event';

/**
 * 会话回放端点(#69):按会话 id 返回全量步骤事件流;可见性过滤由
 * 会话存储真实执行(存储契约见 session-store.contract.test.ts),
 * 端点只做结果 → HTTP 的映射,不做第二份权限判断。
 */

const OWNER: LifecycleContext = { actorId: 'developer-1', clientId: 'workbench', roles: [] };
const OTHER: LifecycleContext = { actorId: 'developer-2', clientId: 'workbench', roles: [] };
const ADMIN: LifecycleContext = {
  actorId: 'admin-1',
  clientId: 'workbench',
  roles: ['admin']
};

const EVENTS: AnalysisStepEvent[] = [
  {
    type: 'domain_routed',
    question: '上个月各行业的新增客户数是多少?',
    routedDomains: ['客户经营'],
    overriddenByUser: false
  },
  {
    type: 'rows_ready',
    summary: { rowCount: 5, totalCount: 5, outputFields: ['行业', '新增客户数'] }
  }
];

async function storeWithSession() {
  const sessions = createMemoryAnalysisSessionStore();
  for (const event of EVENTS) {
    await sessions.appendEvent({ sessionId: 'session-1', event }, OWNER);
  }
  return sessions;
}

describe('会话回放端点', () => {
  it('归属者按会话 id 读回全部步骤,顺序与序号保持', async () => {
    const response = await handleSessionReplayRequest({
      sessionId: 'session-1',
      identity: OWNER,
      sessions: await storeWithSession()
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      session: {
        sessionId: string;
        question: string | null;
        events: Array<{ sequence: number; event: AnalysisStepEvent }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.session.sessionId).toBe('session-1');
    expect(payload.session.question).toBe('上个月各行业的新增客户数是多少?');
    expect(payload.session.events.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(payload.session.events.map((entry) => entry.event.type)).toEqual([
      'domain_routed',
      'rows_ready'
    ]);
  });

  it('换 mock 用户看不到他人会话:不可见与不存在同为 404', async () => {
    const sessions = await storeWithSession();
    const invisible = await handleSessionReplayRequest({
      sessionId: 'session-1',
      identity: OTHER,
      sessions
    });
    expect(invisible.status).toBe(404);
    const missing = await handleSessionReplayRequest({
      sessionId: 'no-such-session',
      identity: OWNER,
      sessions
    });
    expect(missing.status).toBe(404);
    // 不可见与不存在共用同一错误码,不经由错误码暴露存在性。
    const invisibleBody = (await invisible.json()) as { error: { code: string } };
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(invisibleBody.error.code).toBe('SESSION_NOT_FOUND');
    expect(missingBody.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('平台管理员可读取任何人的会话(ADR-0030)', async () => {
    const response = await handleSessionReplayRequest({
      sessionId: 'session-1',
      identity: ADMIN,
      sessions: await storeWithSession()
    });
    expect(response.status).toBe(200);
  });
});
