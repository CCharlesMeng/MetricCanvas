import { vi } from 'vitest';

/** Node's native AbortSignal.timeout does not follow Vitest's virtual clock. */
export function useDqeTimeoutClock(): void {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
}
