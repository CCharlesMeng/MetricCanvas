import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { streamAgentRun, type AgentRunOutcome } from '../../src/lib/server/agent/stream';
import { createMemoryAnalysisSessionStore } from '../../src/lib/server/session/memory';
import {
  createAskOrchestrationRunner,
  transientPageIdFor
} from '../../src/lib/server/ask/orchestrator';
import type { AskDataRequestUnitState } from '../../src/lib/server/ask/ports';
import { buildAskPorts, userTurn } from './support/ask-harness';

/**
 * 端到端脚本化验收(#66):一句话问题 → #32 推送通道的完整事件序列 →
 * 通过 validate 的页面文档。脚本化模型 + 注入的假执行端口,不启动
 * SvelteKit 与浏览器;步骤事件经通道按 ADR-0030 落库到分析会话。
 */

const IDENTITY: LifecycleContext = { actorId: 'analyst-1', clientId: 'workbench', roles: [] };

const UNIT: AskDataRequestUnitState = {
  businessDomain: '客户经营',
  metrics: [{ kind: 'metric', name: '新增客户数' }],
  groupBy: ['行业'],
  filters: [],
  time: { granularity: 'month', start: '2026-07', end: '2026-07', providedBy: 'user' },
  title: '上个月各行业新增客户数'
};

describe('问数端到端(脚本化模型 + 仿真执行端口)', () => {
  it('一句话问题经推送通道产出完整事件序列与通过校验的页面文档,步骤事件落库', async () => {
    const harness = buildAskPorts({
      script: {
        route: [{ businessDomains: ['客户经营'] }],
        unit: [{ outcome: 'unit', unit: UNIT }],
        intent: [{ intent: 'comparison' }]
      }
    });
    const sessions = createMemoryAnalysisSessionStore();
    let outcome: AgentRunOutcome | null = null;

    const frames: Array<{ sequence: number; type: string }> = [];
    let document: Record<string, unknown> | null = null;
    for await (const frame of streamAgentRun({
      runner: createAskOrchestrationRunner(harness.ports, { runId: 'run-e2e' }),
      runId: 'run-e2e',
      messages: userTurn('上个月各行业的新增客户数是多少?'),
      sessionId: 'session-e2e',
      persistStepEvent: async (sessionId, event) => {
        await sessions.appendEvent({ sessionId, event }, IDENTITY);
      },
      onOutcome: (finalOutcome) => {
        outcome = finalOutcome;
      },
      auditSink: () => {}
    })) {
      frames.push({ sequence: frame.sequence, type: frame.event.type });
    }

    // 完整事件序列:通道生命周期 + ADR-0037 固定阶段顺序,序号单调递增。
    expect(frames.map((frame) => frame.type)).toEqual([
      'run_started',
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented',
      'execution_started',
      'rows_ready',
      'document_ready',
      'assistant_replied',
      'run_completed'
    ]);
    expect(frames.map((frame) => frame.sequence)).toEqual(
      frames.map((_, index) => index + 1)
    );

    // 运行结果:通过页面校验的临时页面文档 + 可续跑的会话消息。
    expect(outcome).not.toBeNull();
    const finalOutcome = outcome as unknown as AgentRunOutcome;
    expect(finalOutcome.status).toBe('completed');
    document = finalOutcome.document;
    expect(document).not.toBeNull();
    expect(validate(document!)).toEqual([]);
    expect(document!.id).toBe(transientPageIdFor('run-e2e'));

    // 步骤事件按 ADR-0030 落库:只有步骤事件进入分析会话,顺序保持。
    const stored = await sessions.getSession({ sessionId: 'session-e2e' }, IDENTITY);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.session.events.map((entry) => entry.event.type)).toEqual([
      'domain_routed',
      'candidates_retrieved',
      'scope_card_presented',
      'execution_started',
      'rows_ready',
      'document_ready'
    ]);
    expect(stored.session.question).toBe('上个月各行业的新增客户数是多少?');
  });
});
