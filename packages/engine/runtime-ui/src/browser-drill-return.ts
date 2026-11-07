/** Host-owned drill-through provenance, attached to actual browser entries, never URL inputs. */
export interface DrillReturnContext {
  entryId: string;
  targetPageId: string;
  sourceHref: string;
  sourceEntryKey?: string;
}
interface ReturnEntry { key: string; index: number; url: string | null; getState(): unknown }
export interface DrillReturnBrowser {
  location: { href: string };
  navigation?: {
    currentEntry: ReturnEntry | null;
    entries(): ReturnEntry[];
    updateCurrentEntry(options: { state: unknown }): void;
    addEventListener?(type: 'currententrychange', listener: () => void, options?: {once: boolean}): void;
    removeEventListener?(type: 'currententrychange', listener: () => void): void;
  };
}
type PageIdentity = (url: URL) => string | undefined;
type Visit = (href: string) => Promise<boolean | void>;
const stateKey = '__metriccanvasDrillReturn';

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function decode(value: unknown): DrillReturnContext | undefined {
  const record = object(value);
  if (typeof record.entryId !== 'string' || !record.entryId) return;
  if (typeof record.targetPageId !== 'string' || typeof record.sourceHref !== 'string') return;
  if (typeof record.sourceEntryKey !== 'string' || !record.sourceEntryKey) return;
  return record as unknown as DrillReturnContext;
}
function entryContext(entry: ReturnEntry): DrillReturnContext | undefined {
  return decode(object(entry.getState())[stateKey]);
}

/** Unsupported/opaque history fails closed; hosts may supply their own validated returnContext instead. */
export function createBrowserDrillReturn(
  pageIdentity: PageIdentity,
  browser: DrillReturnBrowser | undefined = typeof window === 'undefined' ? undefined : window
) {
  let revision = 0;
  function identity(href: string): string | undefined {
    if (!browser) return;
    const url = new URL(href, browser.location.href);
    if (url.origin !== new URL(browser.location.href).origin) return;
    return pageIdentity(url);
  }
  function valid(context: DrillReturnContext, pageId: string): boolean {
    const source = new URL(context.sourceHref);
    const entry = browser?.navigation?.entries().find(value=>value.key===context.sourceEntryKey);
    return context.targetPageId === pageId && !!entry && !!identity(source.href) && identity(source.href) !== pageId;
  }
  function write(context: DrillReturnContext | undefined): void {
    const navigation = browser?.navigation;
    if (!navigation?.currentEntry) return;
    const previous=navigation.currentEntry.getState();
    if (previous !== undefined && (previous === null || typeof previous !== 'object' || Array.isArray(previous))) return;
    const state = { ...object(previous) };
    if (context && entryContext(navigation.currentEntry)?.entryId === context.entryId) return;
    if (!context && !(stateKey in state)) return;
    delete state[stateKey];
    if (context) state[stateKey] = context;
    navigation.updateCurrentEntry({ state });
  }
  function find(): DrillReturnContext | undefined {
    const navigation = browser?.navigation;
    if (!navigation?.currentEntry || !browser) return;
    const pageId = identity(browser.location.href);
    if (!pageId) return;
    const entries = navigation.entries();
    for (let index = navigation.currentEntry.index; index >= 0; index--) {
      const entry = entries[index];
      if (!entry?.url || identity(entry.url) !== pageId) return;
      const context = entryContext(entry);
      if (stateKey in object(entry.getState())) return context && valid(context, pageId) ? context : undefined;
    }
  }
  function current(): DrillReturnContext | undefined {
    try {
      return find();
    } catch { return undefined; }
  }
  function capture(href: string, sourcePageId?: string): DrillReturnContext | undefined {
    if (!browser?.navigation || !sourcePageId) return;
    const targetPageId = identity(href);
    if (!targetPageId || targetPageId === sourcePageId || identity(browser.location.href) !== sourcePageId) return;
    restore(current());
    return { entryId: crypto.randomUUID(), targetPageId, sourceHref: browser.location.href,
      sourceEntryKey: browser.navigation.currentEntry?.key };
  }
  function restore(context: DrillReturnContext | undefined): void {
    try { write(context); } catch { /* Unavailable history never creates return eligibility. */ }
  }
  async function navigate(href: string, sourcePageId: string | undefined, visit: Visit): Promise<boolean> {
    const intent = ++revision;
    let context: DrillReturnContext | undefined;
    try { context = capture(href, sourcePageId); } catch { /* Navigation remains available without provenance. */ }
    const allowed = await visit(href);
    if (allowed === false || intent !== revision) return false;
    if (browser && new URL(href, browser.location.href).href === browser.location.href) restore(context);
    return true;
  }
  function parent(context: DrillReturnContext): DrillReturnContext | undefined {
    const entry = browser?.navigation?.entries().find(value => value.key === context.sourceEntryKey);
    return entry ? entryContext(entry) : undefined;
  }
  async function back(visit: Visit): Promise<boolean> {
    const context = current();
    if (!context) return false;
    const inherited = parent(context);
    const intent = ++revision;
    const allowed = await visit(context.sourceHref);
    if (allowed === false || intent !== revision) return false;
    if (browser?.location.href === context.sourceHref) restore(inherited);
    return true;
  }
  function subscribe(listener: () => void): () => void {
    const navigation=browser?.navigation;
    let active=true;
    const notify=()=>queueMicrotask(()=>{if(active)listener();});
    navigation?.addEventListener?.('currententrychange',notify);
    return ()=>{active=false;navigation?.removeEventListener?.('currententrychange',notify);};
  }
  return { current, navigate, back, restore, subscribe };
}
export type BrowserDrillReturn = ReturnType<typeof createBrowserDrillReturn>;

/** history.replaceState replaces Navigation API state too; retain unrelated entry-owned data. */
export function preserveNavigationEntry(action: () => void, browser: DrillReturnBrowser | undefined = typeof window === 'undefined' ? undefined : window): void {
  const navigation = browser?.navigation;
  let state: unknown;
  try { state = navigation?.currentEntry?.getState(); } catch { /* Opaque history. */ }
  action();
  if (state !== undefined) {
    try { navigation?.updateCurrentEntry({ state }); } catch { /* Navigation itself still succeeds. */ }
  }
}
