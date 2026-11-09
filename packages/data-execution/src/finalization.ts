import {
  finalizationDate, finalizationName, localCalendarDate,
  type DqeRequestBody, type Page
} from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from './ports';

/** Fixed, trusted query configuration supplied with the gateway. No page inputs or credentials. */
export interface FinalizationSourceDefinition {
  body: DqeRequestBody;
  nameField: string;
  dateField: string;
  timeoutMs?: number;
}

/** One call per page instance, shared by every filter and never cached across pages. */
export async function resolveFinalizationDates(
  page: Pick<Page, 'id' | 'filters'>,
  gateway: RuntimeDataGateway,
  now: Date,
  signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> {
  signal?.throwIfAborted();
  const names = new Set((page.filters ?? []).map(finalizationName).filter((name): name is string => !!name));
  const fallback = new Map([...names].map(name => [name, localCalendarDate(now)]));
  if (!names.size) return fallback;
  try {
    const dates = await queryFinalizations(gateway, page.id, signal);
    signal?.throwIfAborted();
    for (const name of names) {
      const date = dates.get(name);
      if (date) fallback.set(name, date);
    }
  } catch (cause) {
    signal?.throwIfAborted();
    // Business values and upstream messages must not escape through diagnostics.
    console.warn('[MetricCanvas] 定稿日期查询不可用，默认时间回退当前日期');
  }
  return fallback;
}

async function queryFinalizations(gateway: RuntimeDataGateway, pageId: string, signal?: AbortSignal) {
  const source = gateway.finalizationSource;
  if (!source) throw new Error('定稿查询未配置');
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = finalizationTimeout(source.timeoutMs);
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

function finalizationTimeout(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(value, 2147483647) : 5000;
}

function indexFinalizations(rows: readonly Record<string, unknown>[]): Map<string, string> {
  if (rows.length >= 10000) throw new Error('定稿结果超过完整读取上限');
  const dates = new Map<string, string>(), invalid = new Set<string>();
  for (const row of rows) {
    if (typeof row.name !== 'string') continue;
    const name = row.name.trim(), date = finalizationDate(row.date);
    if (!date || dates.has(name) && dates.get(name) !== date) invalid.add(name);
    else dates.set(name, date);
  }
  for (const name of invalid) dates.delete(name);
  return dates;
}
