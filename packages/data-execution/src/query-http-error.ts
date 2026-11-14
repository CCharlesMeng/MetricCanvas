/** Internal request-scoped observation, before the Adapter releases its transport slot. */
const observers = new WeakMap<AbortSignal, (status: number) => void>();

export function observeQueryHttpError(signal: AbortSignal, observe: (status: number) => void): () => void {
  observers.set(signal, observe);
  return () => { observers.delete(signal); };
}

export function reportQueryHttpError(signal: AbortSignal | undefined, status: number): void {
  if (signal && !signal.aborted) observers.get(signal)?.(status);
}
