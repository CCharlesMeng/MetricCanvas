import { describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { createAgentRunRegistry } from '../../src/lib/server/agent/run-registry';

const OWNER: LifecycleContext = { actorId: 'developer-1', clientId: 'workbench', roles: [] };
const OTHER: LifecycleContext = { actorId: 'developer-2', clientId: 'workbench', roles: [] };
const ADMIN: LifecycleContext = { actorId: 'admin-1', clientId: 'workbench', roles: ['admin'] };

describe('Agent 运行注册表', () => {
  it('注册返回该运行专属的取消信号;归属者取消即中止', () => {
    const registry = createAgentRunRegistry();
    const run = registry.register({ runId: 'run-1', actorId: OWNER.actorId });
    expect(run).not.toBeNull();
    expect(run?.signal.aborted).toBe(false);

    expect(registry.cancel('run-1', OWNER)).toBe('cancelled');
    expect(run?.signal.aborted).toBe(true);
    expect(run?.signal.reason).toBeInstanceOf(DOMException);
  });

  it('非归属者取消与不存在同响应,不暴露他人运行;平台管理员可取消', () => {
    const registry = createAgentRunRegistry();
    const run = registry.register({ runId: 'run-1', actorId: OWNER.actorId });

    expect(registry.cancel('run-1', OTHER)).toBe('not_found');
    expect(registry.cancel('missing-run', OTHER)).toBe('not_found');
    expect(run?.signal.aborted).toBe(false);

    expect(registry.cancel('run-1', ADMIN)).toBe('cancelled');
    expect(run?.signal.aborted).toBe(true);
  });

  it('同 runId 进行中不允许重复注册;结束(finish)后释放,取消随之失效', () => {
    const registry = createAgentRunRegistry();
    const run = registry.register({ runId: 'run-1', actorId: OWNER.actorId });
    expect(registry.register({ runId: 'run-1', actorId: OWNER.actorId })).toBeNull();

    run?.finish();
    expect(registry.cancel('run-1', OWNER)).toBe('not_found');

    const again = registry.register({ runId: 'run-1', actorId: OWNER.actorId });
    expect(again).not.toBeNull();
    expect(again?.signal.aborted).toBe(false);
  });

  it('并发运行各持独立信号,取消一个不影响另一个', () => {
    const registry = createAgentRunRegistry();
    const first = registry.register({ runId: 'run-1', actorId: OWNER.actorId });
    const second = registry.register({ runId: 'run-2', actorId: OTHER.actorId });

    expect(registry.cancel('run-1', OWNER)).toBe('cancelled');
    expect(first?.signal.aborted).toBe(true);
    expect(second?.signal.aborted).toBe(false);
  });
});
