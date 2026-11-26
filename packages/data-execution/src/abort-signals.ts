type SignalInput = AbortSignal | null | undefined;

const noop = () => {};

/** Owns the listeners for one operation when the browser lacks AbortSignal.any. */
export function linkAbortSignals(inputs: readonly SignalInput[]) {
  const signals = inputs.filter((signal): signal is AbortSignal => signal != null);
  if (typeof AbortSignal.any === 'function') return { signal: AbortSignal.any(signals), dispose: noop };

  const controller = new AbortController();
  const sources = new Set(signals);
  function dispose() {
    for (const source of sources) source.removeEventListener('abort', forward);
    sources.clear();
  }
  function forward(this: AbortSignal) {
    if (!this.aborted) return;
    dispose();
    controller.abort(this.reason);
  }
  for (const source of sources) {
    if (source.aborted) {
      forward.call(source);
      break;
    }
    source.addEventListener('abort', forward);
  }
  return { signal: controller.signal, dispose };
}

export async function withAbortSignals<T>(inputs: readonly SignalInput[], run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const linked = linkAbortSignals(inputs);
  try {
    return await run(linked.signal);
  } finally {
    linked.dispose();
  }
}
