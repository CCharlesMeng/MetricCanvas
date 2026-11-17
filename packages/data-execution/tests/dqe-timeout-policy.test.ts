import { afterEach, expect, it, vi } from 'vitest';
import { recoveryContext } from '../src/table-recovery/read';
import { useDqeTimeoutClock } from '../../../tests/helpers/dqe-timeout-clock';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it.each([[undefined, 180_000], [1_000, 180_000], [60_000, 180_000], [240_000, 240_000]])(
  'recovery budget %s expires at %s ms', async (declared, effective) => {
    useDqeTimeoutClock();
    const context = recoveryContext('page', 'source', undefined, declared);
    await vi.advanceTimersByTimeAsync(effective! - 1);
    expect(context.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(context.signal.reason).toMatchObject({ name: 'TimeoutError' });
  }
);

it('cancels recovery immediately before the minimum timeout', () => {
  useDqeTimeoutClock();
  const controller = new AbortController();
  const context = recoveryContext('page', 'source', controller.signal, 1_000);
  controller.abort(new Error('disposed'));
  expect(context.signal.reason).toBe(controller.signal.reason);
});
