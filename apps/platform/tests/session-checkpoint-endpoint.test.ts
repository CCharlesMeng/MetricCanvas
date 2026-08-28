import { describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import inlineReport from '../../../packages/page/fixtures/contract-valid/inline-report.json';
import { initialAskState } from '../src/lib/ask/conversation';
import { handleSessionCheckpointUpdate } from '../src/lib/server/session/checkpoint-endpoint';
import { createMemoryAnalysisSessionStore } from '../src/lib/server/session/memory';

const OWNER: LifecycleContext = {
  actorId: 'developer-1',
  clientId: 'workbench',
  roles: []
};
const OTHER: LifecycleContext = {
  actorId: 'developer-2',
  clientId: 'workbench',
  roles: []
};

async function prepared() {
  const sessions = createMemoryAnalysisSessionStore();
  await sessions.appendEvent(
    {
      sessionId: 'session-1',
      event: {
        type: 'domain_routed',
        question: '成交总额是多少?',
        routedDomains: ['运营分析'],
        overriddenByUser: false
      }
    },
    OWNER
  );
  await sessions.saveCheckpoint(
    {
      sessionId: 'session-1',
      basedOnEventSequence: 1,
      runId: 'run-1',
      status: 'completed',
      document: structuredClone(inlineReport),
      contentHash: 'initial-hash',
      askState: initialAskState(),
      pinnedComponents: [],
      interaction: null,
      failure: null
    },
    OWNER
  );
  return sessions;
}

function request(body: unknown): Request {
  return new Request('http://platform.local/api/sessions/session-1/checkpoint', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('会话检查点本地编辑端点', () => {
  it('服务端复验页面文档后以期望版本更新', async () => {
    const sessions = await prepared();
    const document = structuredClone(inlineReport) as Record<string, any>;
    document.meta.description = '本地编辑后的描述';
    const response = await handleSessionCheckpointUpdate({
      sessionId: 'session-1',
      request: request({ expectedVersion: 1, document, pinnedComponents: [] }),
      identity: OWNER,
      sessions
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      checkpoint: { version: number; contentHash: string };
    };
    expect(payload.checkpoint.version).toBe(2);
    expect(payload.checkpoint.contentHash).toMatch(/^[0-9a-f]{64}$/u);

    const restored = await sessions.getSession({ sessionId: 'session-1' }, OWNER);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.session.checkpoint?.document).toMatchObject({
      meta: { description: '本地编辑后的描述' }
    });
  });

  it('拒绝未通过页面校验的文档,不污染既有检查点', async () => {
    const sessions = await prepared();
    const response = await handleSessionCheckpointUpdate({
      sessionId: 'session-1',
      request: request({ expectedVersion: 1, document: { id: 'broken' }, pinnedComponents: [] }),
      identity: OWNER,
      sessions
    });
    expect(response.status).toBe(422);
    const restored = await sessions.getSession({ sessionId: 'session-1' }, OWNER);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.session.checkpoint?.version).toBe(1);
  });

  it('过期版本返回 409,他人写入被拒绝', async () => {
    const sessions = await prepared();
    const stale = await handleSessionCheckpointUpdate({
      sessionId: 'session-1',
      request: request({
        expectedVersion: 2,
        document: inlineReport,
        pinnedComponents: []
      }),
      identity: OWNER,
      sessions
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: { code: 'SESSION_CHECKPOINT_STALE', currentCheckpointVersion: 1 }
    });

    const denied = await handleSessionCheckpointUpdate({
      sessionId: 'session-1',
      request: request({
        expectedVersion: 1,
        document: inlineReport,
        pinnedComponents: []
      }),
      identity: OTHER,
      sessions
    });
    expect(denied.status).toBe(404);
    expect(await denied.json()).toMatchObject({ error: { code: 'SESSION_NOT_FOUND' } });
  });
});
