import { finalizationDate } from '@metriccanvas/page/internal';

const prefix = 'metriccanvas:finalization:v1:';

export async function finalizationStorageKey(scope: string): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !globalThis.crypto?.subtle) return;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope));
    return prefix + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { /* Browser storage and crypto are optional. */ }
}

export function readStoredFinalizations(key: string, day: string): ReadonlyMap<string, string> | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const entry: { day?: string; dates?: unknown } = JSON.parse(raw);
    if (entry.day !== day) { removeStoredFinalizations(key); return; }
    return dateEntries(entry.dates);
  } catch { /* Treat inaccessible or malformed entries as misses. */ }
}

function dateEntries(value: unknown): ReadonlyMap<string, string> | undefined {
  if (!Array.isArray(value) || !value.length || value.length >= 10000) return;
  const dates = new Map<string, string>();
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !pair[0].trim()) return;
    const date = finalizationDate(pair[1]);
    if (!date || dates.has(pair[0])) return;
    dates.set(pair[0], date);
  }
  return dates;
}

export function storeFinalizations(key: string, day: string, dates: ReadonlyMap<string, string>): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify({ day, dates: [...dates] }));
    return true;
  } catch { return false; }
}

export function removeStoredFinalizations(key: string): void {
  try { window.localStorage.removeItem(key); }
  catch { /* Storage can be disabled by the host. */ }
}
