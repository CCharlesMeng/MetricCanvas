import { describe, expect, it } from 'vitest';

const DQE_SIM_HEALTH_URL = 'http://127.0.0.1:18228/__health';

describe('平台取数入口联机检查', () => {
  it('DQE 仿真健康检查可达(探测不到即跳过)', async (ctx) => {
    let health: Response;
    try {
      health = await fetch(DQE_SIM_HEALTH_URL, { signal: AbortSignal.timeout(1_000) });
    } catch {
      ctx.skip();
      return;
    }
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok', service: 'dqe-sim' });
  });
});
