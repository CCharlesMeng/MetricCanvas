import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linkAbortSignals, withAbortSignals } from '../src/abort-signals';

describe('combined request signals without native AbortSignal.any', () => {
  beforeEach(() => { vi.stubGlobal('AbortSignal', class extends AbortSignal { static any = undefined as never; }); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('uses the first already-aborted source in input order', () => {
    const first = new AbortController(), second = new AbortController();
    second.abort('second');
    first.abort('first');
    expect(linkAbortSignals([null, first.signal, undefined, second.signal]).signal.reason).toBe('first');
  });

  it('forwards the first cancellation or timeout including its reason and detaches all listeners', () => {
    const first = new AbortController(), second = new AbortController();
    const detach = vi.spyOn(first.signal, 'removeEventListener');
    const { signal, dispose } = linkAbortSignals([first.signal, second.signal, first.signal]);
    const timeout = new DOMException('timed out', 'TimeoutError');
    second.abort(timeout);
    first.abort();
    dispose();
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(timeout);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('releases long-lived sources after success, synchronous throws and async rejection', async () => {
    const lifetime = new AbortController();
    const attach = vi.spyOn(lifetime.signal, 'addEventListener');
    const detach = vi.spyOn(lifetime.signal, 'removeEventListener');
    await expect(withAbortSignals([lifetime.signal], async () => 42)).resolves.toBe(42);
    await expect(withAbortSignals([lifetime.signal], () => { throw Error('sync'); })).rejects.toThrow('sync');
    await expect(withAbortSignals([lifetime.signal], async () => { throw Error('async'); })).rejects.toThrow('async');
    expect(attach.mock.calls).toEqual(detach.mock.calls);
    expect(attach).toHaveBeenCalledTimes(3);
  });
});
