const MAX_RECEIPTS = 32;
export const MAX_CACHED_CANDIDATES = 32_768;

/** @internal Historical candidate results, owned and disposed by one page session. */
export function createCandidateCache<T>(count: (result: T) => number) {
  const entries = new Map<string, { value: T; count: number }>();
  let candidates = 0;

  function discard(key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    candidates -= entry.count;
  }

  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T) {
      const size = count(value);
      discard(key);
      if (size > MAX_CACHED_CANDIDATES) return;
      entries.set(key, { value, count: size });
      candidates += size;
      while (entries.size > MAX_RECEIPTS || candidates > MAX_CACHED_CANDIDATES) {
        discard(entries.keys().next().value!);
      }
    },
    delete: discard,
    keys: () => entries.keys(),
    clear() {
      entries.clear();
      candidates = 0;
    }
  };
}
