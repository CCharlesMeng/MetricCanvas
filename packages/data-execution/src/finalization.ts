import { debugWarn } from './debug-warnings';
import { dqeTimeoutMs } from './dqe-timeout';
import {
  finalizationDate, finalizationName, localCalendarDate, supportsNativePreparation,
  type DqeRequestBody, type Page
} from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from './ports';
import {cachedFinalizations,type FinalizationLookup} from './finalization-cache';

/** Fixed, trusted query configuration supplied with the gateway. No page inputs or credentials. */
export interface FinalizationSourceDefinition {
  body: DqeRequestBody;
  nameField: string;
  dateField: string;
  /** Defaults to 180000ms; shorter values use the engine minimum. */
  timeoutMs?: number;
}

/** Each page owns its lookup; 6.120 pages reuse only completed results for the current day. */
export async function resolveFinalizationDates(
  page: Pick<Page, 'id' | 'filters'> & Partial<Pick<Page,'schemaVersion'>>,
  gateway: RuntimeDataGateway,
  now: Date,
  signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> {
  const dates = await lookupFinalizationDates(page, gateway, signal);
  const names = (page.filters ?? []).map(finalizationName);
  const candidates = new Set(names.filter(Array.isArray).flat());
  const current = localCalendarDate(now);
  const resolved = new Map<string, string>();
  for (const name of names.flat()) {
    if (name === undefined) continue;
    // A missing array candidate must stay absent even when a single-name filter also uses it.
    const date = dates.get(name) ?? (candidates.has(name) ? undefined : current);
    if (date !== undefined) resolved.set(name, date);
  }
  return resolved;
}

/** Successful dates only. Consumers apply the clock appropriate to their operation. */
export async function lookupFinalizationDates(
  page: Pick<Page, 'id' | 'filters'> & Partial<Pick<Page,'schemaVersion'>>,
  gateway: RuntimeDataGateway,
  signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> {
  signal?.throwIfAborted();
  const names = new Set((page.filters ?? []).flatMap(filter => finalizationName(filter) ?? []));
  if (!names.size) return new Map();
  try {
    const load=()=>queryFinalizations(gateway,page.id,signal);
    const dates = page.schemaVersion&&supportsNativePreparation({schemaVersion:page.schemaVersion})
      ? await cachedFinalizations(gateway,names,load,signal)
      : (await load()).dates;
    signal?.throwIfAborted();
    return new Map([...dates].filter(([name]) => names.has(name)));
  } catch (cause) {
    signal?.throwIfAborted();
    // Business values and upstream messages must not escape through diagnostics.
    debugWarn('[MetricCanvas] 定稿日期查询不可用，默认时间回退当前日期');
  }
  return new Map();
}

async function queryFinalizations(gateway: RuntimeDataGateway, pageId: string, signal?: AbortSignal) {
  const source = gateway.finalizationSource;
  if (!source) throw new Error('定稿查询未配置');
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = dqeTimeoutMs(source.timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('定稿查询超时')); }, timeout);
    });
    const cancelled = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('定稿查询取消')), { once: true });
    });
    const result = await Promise.race([gateway.fetchData({
      language: 'dqe', body: JSON.parse(JSON.stringify(source.body)), filterValues: [],
      fieldMappings: {
        name: { type: 'string', role: 'dimension', queryField: source.nameField },
        date: { type: 'date', role: 'dimension', queryField: source.dateField }
      }
    }, { pageId }, controller.signal), expired, cancelled]);
    if (result.totalCount !== undefined && result.totalCount !== result.rows.length) throw new Error('定稿结果不完整');
    return indexFinalizations(result.rows);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function indexFinalizations(rows: readonly Record<string, unknown>[]): FinalizationLookup {
  if (rows.length >= 10000) throw new Error('定稿结果超过完整读取上限');
  const dates = new Map<string, string>(), invalid = new Set<string>();
  let complete=true;
  for (const row of rows) {
    if (typeof row.name !== 'string') {complete=false;continue;}
    const name = row.name.trim(), date = finalizationDate(row.date);
    if (!name)complete=false;
    if (!date || dates.has(name) && dates.get(name) !== date) invalid.add(name);
    else dates.set(name, date);
  }
  for (const name of invalid) dates.delete(name);
  return {dates,cacheable:complete&&invalid.size===0&&dates.size>0};
}
