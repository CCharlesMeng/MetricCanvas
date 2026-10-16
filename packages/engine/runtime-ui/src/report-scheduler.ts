/** Time-budgeted main-thread work; yielding must schedule a task, not another microtask. */
export function reportScheduler(signal: AbortSignal, budgetMs = 6): () => Promise<void> | undefined {
  let deadline = performance.now() + budgetMs, yields = 0;
  return () => {
    signal.throwIfAborted();
    if (performance.now() < deadline) return;
    const scheduler = (globalThis as typeof globalThis & {scheduler?: {yield(): Promise<void>}}).scheduler;
    // Boosted scheduler continuations can starve ordinary timer/network tasks in a long chain.
    // Periodically join the ordinary task queue as well, so the rest of the application runs.
    const next = scheduler && ++yields % 4 !== 0 ? scheduler.yield() : new Promise<void>(resolve => setTimeout(resolve, 0));
    return next.then(() => {
      signal.throwIfAborted();
      deadline = performance.now() + budgetMs;
    });
  };
}
