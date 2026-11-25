import { canonicalizeJson, localCalendarDate } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from './ports';
import {
  finalizationStorageKey, readStoredFinalizations, removeStoredFinalizations, storeFinalizations
} from './finalization-browser-cache';

export interface FinalizationLookup { dates: ReadonlyMap<string, string>; cacheable: boolean }

type ReadIdentity = () => readonly string[] | undefined;
interface Session {
  revision: number;
  readIdentity?: ReadIdentity;
  browserKey?: string;
  cached?: { key: string; day: string; dates: ReadonlyMap<string, string> };
}
const sessions = new WeakMap<RuntimeDataGateway, Session>();
const sessionKey = Symbol('finalization-cache-session');
type IdentifiedGateway = RuntimeDataGateway & { [sessionKey]?: () => Session };

function session(gateway: RuntimeDataGateway): Session {
  let value = (gateway as IdentifiedGateway)[sessionKey]?.() ?? sessions.get(gateway);
  if (!value) { value = { revision: 0 }; sessions.set(gateway, value); }
  return value;
}

export function identifyFinalizationCache(gateway: RuntimeDataGateway, readIdentity: ReadIdentity): void {
  const scope = session(gateway);
  scope.readIdentity = readIdentity;
  // A gateway's cache scope survives reactive proxies and transport decorators.
  Object.defineProperty(gateway, sessionKey, { enumerable: true, value: () => scope });
}

export function inheritFinalizationCache(wrapper: RuntimeDataGateway, base: RuntimeDataGateway): void {
  sessions.set(wrapper, session(base));
}

export function invalidateFinalizationCache(gateway: RuntimeDataGateway): void {
  const scope = session(gateway);
  scope.revision++;
  delete scope.cached;
  if (scope.browserKey) removeStoredFinalizations(scope.browserKey);
  delete scope.browserKey;
}

function cacheContext(gateway: RuntimeDataGateway, scope: Session) {
  const identity = scope.readIdentity?.();
  const key = canonicalizeJson([gateway.finalizationSource ?? null, identity ?? null]);
  return { key, identity, day: localCalendarDate(new Date()) };
}

function coversNames(dates: ReadonlyMap<string, string> | undefined, names: ReadonlySet<string>): dates is ReadonlyMap<string, string> {
  return !!dates && [...names].every(name => dates.has(name));
}

/** Completed values only. Simultaneous misses execute and cancel independently. */
export async function cachedFinalizations(
  gateway: RuntimeDataGateway, names: ReadonlySet<string>, load: () => Promise<FinalizationLookup>, signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> {
  signal?.throwIfAborted();
  const scope = session(gateway);
  const revision = scope.revision;
  const { key, day, identity } = cacheContext(gateway, scope);
  const cached = scope.cached;
  if (cached?.key === key && cached.day === day && coversNames(cached.dates, names)) return new Map(cached.dates);

  const browserKey = identity ? await finalizationStorageKey(key) : undefined;
  signal?.throwIfAborted();
  if (browserKey && current()) {
    scope.browserKey = browserKey;
    const stored = readStoredFinalizations(browserKey, day);
    if (coversNames(stored, names)) return new Map(stored);
  }

  const result = await load();
  signal?.throwIfAborted();
  if (result.cacheable && current()) {
    if (!browserKey || !storeFinalizations(browserKey, day, result.dates))
      scope.cached = { key, day, dates: new Map(result.dates) };
  }
  return result.dates;

  function current(): boolean {
    const next = cacheContext(gateway, scope);
    return scope.revision === revision && next.key === key && next.day === day;
  }
}
