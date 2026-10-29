export type IdleSchedule = (work: () => void) => () => void;

/** No timeout: prefetch waits for spare browser time; a menu click remains immediate. */
export const scheduleCandidateIdle: IdleSchedule = work => {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(work);
    return () => globalThis.cancelIdleCallback(id);
  }
  const id = setTimeout(work, 50);
  return () => clearTimeout(id);
};

/** Only a visible rendered table opts in; warm one eligible column at a time. */
export function createCandidatePreload(input: {
  fields(): readonly string[];
  needed(field: string): boolean;
  load(field: string): Promise<void>;
  cancel(field: string): void;
  schedule?: IdleSchedule;
}) {
  let visible = false, disposed = false, generation = 0;
  let scheduled: (() => void) | undefined;
  let running: { field: string; generation: number } | undefined;
  function sync() {
    if (!visible || disposed || scheduled || running) return;
    const field = input.fields().find(input.needed);
    if (field === undefined) return;
    scheduled = (input.schedule ?? scheduleCandidateIdle)(() => {
      scheduled = undefined;
      const current = { field, generation: ++generation };
      running = current;
      void input.load(field).finally(() => {
        if (running !== current) return;
        running = undefined;
        sync();
      });
    });
  }
  function pause() {
    scheduled?.(); scheduled = undefined;
    const previous = running;
    running = undefined;
    if (previous) input.cancel(previous.field);
  }
  return {
    sync,
    visible(value: boolean) { visible = value; if (value) sync(); else pause(); },
    dispose() { disposed = true; pause(); }
  };
}
