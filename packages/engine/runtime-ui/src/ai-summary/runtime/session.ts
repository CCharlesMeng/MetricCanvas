import type { AiSummaryGenerationInput } from './input';
import { summaryContent } from '../view/content';
import type { AiSummaryConfig, AiSummarySnapshot } from '../types';

type Subscriber = (snapshot: AiSummarySnapshot) => void;
interface Entry {
  input: AiSummaryGenerationInput;
  state: 'queued' | 'running' | 'complete';
  snapshot: AiSummarySnapshot;
  touched: number;
  listeners: Set<Subscriber>;
}
const pageInvalidators = new WeakMap<AiSummaryTaskSession, (pageId: string) => void>();
export interface AiSummaryTaskSession {
  watch(input: AiSummaryGenerationInput, listener: Subscriber, retry?: boolean): () => void;
  dispose(): void;
}

/** 应用持有；组件取消订阅只释放观察者，不取消生成或删除结果。 */
export function createAiSummaryTaskSession(config: AiSummaryConfig): AiSummaryTaskSession {
  const entries = new Map<string, Entry>();
  const queued = new Map<string, Entry>();
  const lastStarted = new Map<string, number>();
  const throttle = bounded(config.throttleMs, 1000, 0);
  const concurrency = bounded(config.concurrency, 2, 1);
  const maxEntries = bounded(config.maxEntries, 100, 1);
  const ttl = bounded(config.ttlMs, 30 * 60_000, 1);
  const running = new Set<Entry>();
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function publish(entry: Entry, snapshot: AiSummarySnapshot) {
    entry.snapshot = snapshot;
    for (const listener of entry.listeners) listener(snapshot);
  }

  function prune() {
    const completed = [...entries.values()].filter(entry => entry.state === 'complete')
      .sort((a, b) => a.touched - b.touched);
    const now = Date.now();
    for (const [index, entry] of completed.entries()) {
      if (entry.listeners.size) continue;
      if (now - entry.touched > ttl || completed.length - index > maxEntries) entries.delete(entry.input.key);
    }
    const owners = new Set([...entries.values()].map(entry => entry.input.owner));
    for (const owner of lastStarted.keys()) if (!owners.has(owner)) lastStarted.delete(owner);
  }

  function complete(entry: Entry, snapshot: AiSummarySnapshot) {
    if (disposed || entries.get(entry.input.key) !== entry) return;
    entry.state = 'complete';
    entry.touched = Date.now();
    if (!disposed) publish(entry, snapshot);
    prune();
  }

  async function generate(entry: Entry) {
    try {
      const text = await config.generate(entry.input.question, structuredClone(entry.input.contextInfo));
      complete(entry, summaryContent(text));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'AI 总结生成失败';
      complete(entry, { status: 'error', error: { message } });
    } finally {
      running.delete(entry);
      schedule();
    }
  }

  function start(entry: Entry) {
    queued.delete(entry.input.owner);
    entry.state = 'running';
    lastStarted.set(entry.input.owner, Date.now());
    running.add(entry);
    void generate(entry);
  }

  function pump() {
    timer = undefined;
    if (disposed || running.size >= concurrency) return;
    let delay = Infinity;
    for (const entry of queued.values()) {
      const remaining = (lastStarted.get(entry.input.owner) ?? -Infinity) + throttle - Date.now();
      if (remaining > 0) { delay = Math.min(delay, remaining); continue; }
      start(entry);
      if (running.size >= concurrency) return;
    }
    if (Number.isFinite(delay)) timer = setTimeout(pump, delay);
  }

  function schedule() {
    if (disposed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(pump, 0);
  }

  function supersedeQueued(owner: string, key: string) {
    const previous = queued.get(owner);
    if (!previous || previous.input.key === key) return;
    queued.delete(owner);
    entries.delete(previous.input.key);
    publish(previous, { status: 'empty' });
  }

  function enqueue(entry: Entry) {
    supersedeQueued(entry.input.owner, entry.input.key);
    queued.set(entry.input.owner, entry);
    schedule();
  }

  function find(input: AiSummaryGenerationInput, retry: boolean): Entry {
    prune();
    const cached = entries.get(input.key);
    if (cached && (!retry || cached.state !== 'complete')) return cached;
    const snapshot = initialSnapshot(input.initialBody, retry);
    const entry: Entry = { input: structuredClone(input), state: snapshot.status === 'ready' ? 'complete' : 'queued',
      snapshot, touched: Date.now(), listeners: new Set() };
    entries.set(input.key, entry);
    if (entry.state === 'queued') enqueue(entry);
    return entry;
  }

  function forgetPage(pageId: string) {
    for (const [key, entry] of entries) {
      if (entry.input.contextInfo.pageId !== pageId) continue;
      entries.delete(key);
      running.delete(entry);
      if (queued.get(entry.input.owner) === entry) queued.delete(entry.input.owner);
      lastStarted.delete(entry.input.owner);
      entry.listeners.clear();
    }
    schedule();
  }

  const session: AiSummaryTaskSession = {
    watch(input, listener, retry = false) {
      if (disposed) { listener({ status: 'error', error: { message: 'AI 总结会话已关闭' } }); return () => {}; }
      supersedeQueued(input.owner, input.key);
      const entry = find(input, retry);
      entry.touched = Date.now();
      entry.listeners.add(listener);
      listener(entry.snapshot);
      return () => { entry.listeners.delete(listener); prune(); };
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const entry of entries.values()) entry.listeners.clear();
      entries.clear(); queued.clear(); lastStarted.clear(); running.clear();
    }
  };
  pageInvalidators.set(session, forgetPage);
  return session;
}

function initialSnapshot(body: string | undefined, retry: boolean): AiSummarySnapshot {
  if (!body || retry) return { status: 'loading' };
  try { return summaryContent(body); }
  catch { return { status: 'loading' }; }
}

function bounded(value: number | undefined, fallback: number, minimum: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

const applicationSessions = new WeakMap<AiSummaryConfig, AiSummaryTaskSession>();
/** Authentication termination discards this page's cross-mount results and late work. */
export function invalidateAiSummaryPage(config: AiSummaryConfig | undefined, pageId: string): void {
  if (!config) return;
  const session = applicationSessions.get(config);
  if (session) pageInvalidators.get(session)?.(pageId);
}
/** 以注入对象为应用会话身份；同一对象跨报表与挂载复用，身份变化应创建新对象。 */
export function aiSummaryTaskSession(config: AiSummaryConfig): AiSummaryTaskSession {
  let session = applicationSessions.get(config);
  if (!session) { session = createAiSummaryTaskSession(config); applicationSessions.set(config, session); }
  return session;
}
