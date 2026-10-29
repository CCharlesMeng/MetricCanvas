import { createInjectedDqeGateway } from '@metriccanvas/application-runtime';
import { dqeRecord, type JsonObject, type Row } from '@metriccanvas/page/internal';

function trace(phase: 'start' | 'abort', items: readonly JsonObject[]) {
  if (typeof globalThis.dispatchEvent !== 'function') return;
  for (const item of items) {
    const order = dqeRecord(item.order);
    globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-column-query', {
      detail: { phase, kind: Number(order.limit) > 20 ? 'candidate' : 'table', offset: Number(order.offset ?? 0) }
    }));
  }
}

function blockedCandidate(signal: AbortSignal | null | undefined, items: readonly JsonObject[]): Promise<never> {
  return new Promise((_resolve, reject) => {
    const abort = () => { trace('abort', items); reject(Object.assign(new Error('synthetic cancelled'), { name: 'AbortError' })); };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

/** 620 synthetic rows: offices 61–80 appear only after the first three 200-row batches. */
const rows: Row[] = Array.from({ length: 620 }, (_, index) => ({
  编号: index + 1,
  区域: index < 600 ? '华北' : '华南',
  代表处: `办事处${String(index < 600 ? index % 60 + 1 : index - 539).padStart(2, '0')}`,
  收入: 1000 + index
}));
const overLimitRows = [...rows, ...Array.from({ length: 381 }, (_, index) => ({
  编号: 621 + index, 区域: '华北', 代表处: `办事处${String(index % 80 + 1).padStart(2, '0')}`, 收入: 1620 + index
}))];

function matches(row: Row, item: JsonObject): boolean {
  const filter = dqeRecord(item.filter);
  const dims = Array.isArray(filter.dims) ? filter.dims : [];
  const metrics = Array.isArray(filter.metrics) ? filter.metrics : [];
  return dims.every(value => {
    const entry = dqeRecord(value);
    return Array.isArray(entry.dim_value_list) && entry.dim_value_list.includes(row[String(entry.dim_name)] as string);
  }) && metrics.every(value => {
    const entry = dqeRecord(value), amount = Number(row[String(entry.metric_name)]);
    const bound = Number(Array.isArray(entry.metric_value_list) ? entry.metric_value_list[0] : entry.value);
    return entry.operator === '>=' ? amount >= bound : amount <= bound;
  });
}

function receipt(item: JsonObject, state: string): JsonObject {
  if (!Array.isArray(item.output_metrics) || !item.output_metrics.length) throw Error('模拟 DQE 要求至少一个 output_metrics');
  const order = dqeRecord(item.order), offset = Number(order.offset ?? 0), limit = Number(order.limit ?? 20);
  const source = state === 'over-limit' || state === 'raised-limit' ? overLimitRows : rows;
  const selected = source.filter(row => matches(row, item));
  const data = selected.slice(offset, offset + limit);
  if (state === 'truncated' && limit > 20) data.pop();
  return { code: 'SUCCESS', data, total_count: selected.length };
}

/** Exercise the registered application gateway through native DQE envelopes, without a real service. */
export function createFullQueryCandidatesPreview(state = 'ready') {
  const requests: JsonObject[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    init?.signal?.throwIfAborted();
    const body = JSON.parse(String(init?.body)) as { dsl_list: JsonObject[] };
    requests.push(...structuredClone(body.dsl_list));
    trace('start', body.dsl_list);
    if (state === 'blocked-candidates' && body.dsl_list.some(item => Number(dqeRecord(item.order).limit) > 20)) await blockedCandidate(init?.signal, body.dsl_list);
    return Response.json({ retCode: 'CBC.0000', results: body.dsl_list.map(item => receipt(item, state)) });
  };
  const dataGateway = createInjectedDqeGateway(fetchImpl, undefined, () => ({
    dqeEndpoint: '/synthetic-dqe', pageMetadataBaseUrl: '/synthetic-pages',
    authToken: 'synthetic', operatorId: 'synthetic', workspaceId: 'synthetic',
    ...(state === 'raised-limit' ? { columnCandidatesMaxRows: 1200 } : {})
  }));
  return { dataGateway, requests };
}
