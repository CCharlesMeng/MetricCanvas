import type {
  EffectiveQuery,
  FieldType,
  JsonObject,
  JsonValue,
  Row
} from '@metriccanvas/page';
import type { DataGateway, DataGatewayResult } from '@metriccanvas/runtime';

export const DEFAULT_DQE_ENDPOINT =
  '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';

export type DqeDiagnosticPhase =
  | 'base'
  | 'effective'
  | 'batch'
  | 'response'
  | 'normalized'
  | 'error';

export interface DqeDiagnosticRecord {
  executionId: string;
  phase: DqeDiagnosticPhase;
  recordedAt: string;
  batchId?: string;
  resultIndex?: number;
  detail: unknown;
}

export interface DqeDiagnostics {
  record(event: DqeDiagnosticRecord): void;
}

export interface InMemoryDqeDiagnostics extends DqeDiagnostics {
  records(): readonly DqeDiagnosticRecord[];
  clear(): void;
  subscribe(run: (records: readonly DqeDiagnosticRecord[]) => void): () => void;
}

export function createInMemoryDqeDiagnostics(limit = 100): InMemoryDqeDiagnostics {
  const entries: DqeDiagnosticRecord[] = [];
  const subscribers = new Set<(records: readonly DqeDiagnosticRecord[]) => void>();
  const publish = () => {
    const snapshot = entries.slice();
    for (const subscriber of subscribers) subscriber(snapshot);
  };
  return {
    record(event) {
      entries.push(event);
      if (entries.length > limit) entries.splice(0, entries.length - limit);
      publish();
    },
    records: () => entries.slice(),
    clear() {
      entries.length = 0;
      publish();
    },
    subscribe(run) {
      subscribers.add(run);
      run(entries.slice());
      return () => subscribers.delete(run);
    }
  };
}

export interface DqeGatewayConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxConcurrentBatches?: number;
  credentials?: RequestCredentials;
  diagnostics?: DqeDiagnostics;
}

interface PendingQuery {
  executionId: string;
  query: EffectiveQuery;
  item: JsonObject;
  resolve(result: DataGatewayResult): void;
  reject(error: unknown): void;
}

export class DqeGatewayError extends Error {
  constructor(
    readonly code:
      | 'DQE_CONFIG_ERROR'
      | 'DQE_FILTER_BINDING_ERROR'
      | 'DQE_TRANSPORT_ERROR'
      | 'DQE_ENVELOPE_ERROR'
      | 'DQE_ITEM_ERROR'
      | 'DQE_FIELD_MAPPING_ERROR'
      | 'DQE_ROW_CONTRACT_ERROR',
    message: string,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = 'DqeGatewayError';
  }
}

/**
 * DQE 数据网关 Adapter。
 *
 * 外部 interface 仍是一条生效查询进、标准化数据行出；批量信封、并发、错误信封、
 * 字段映射和筛选覆盖全部隐藏在实现中。
 */
export function createDqeGateway(config: DqeGatewayConfig = {}): DataGateway {
  const {
    endpoint = DEFAULT_DQE_ENDPOINT,
    headers = {},
    fetchImpl = fetch,
    timeoutMs = 30_000,
    maxConcurrentBatches = 5,
    credentials = 'same-origin',
    diagnostics
  } = config;

  let sequence = 0;
  let batchSequence = 0;
  let scheduled = false;
  let pending: PendingQuery[] = [];
  let activeBatches = 0;
  const batchWaiters: Array<() => void> = [];

  function diagnostic(
    executionId: string,
    phase: DqeDiagnosticPhase,
    detail: unknown,
    batchId?: string,
    resultIndex?: number
  ): void {
    diagnostics?.record({
      executionId,
      phase,
      recordedAt: new Date().toISOString(),
      ...(batchId ? { batchId } : {}),
      ...(resultIndex !== undefined ? { resultIndex } : {}),
      detail
    });
  }

  function acquireBatch(): Promise<void> {
    if (activeBatches < maxConcurrentBatches) {
      activeBatches += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => batchWaiters.push(resolve));
  }

  function releaseBatch(): void {
    const next = batchWaiters.shift();
    if (next) next();
    else activeBatches -= 1;
  }

  async function executeBatch(calls: PendingQuery[]): Promise<void> {
    await acquireBatch();
    const batchId = `dqe-batch-${++batchSequence}`;
    calls.forEach((call, index) =>
      diagnostic(call.executionId, 'batch', { endpoint }, batchId, index)
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=utf-8', ...headers },
        credentials,
        body: JSON.stringify({ dsl_list: calls.map((call) => call.item) }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new DqeGatewayError(
          'DQE_TRANSPORT_ERROR',
          `DQE HTTP 请求失败:${response.status}`,
          { status: response.status }
        );
      }
      const requestId = response.headers.get('x-request-id') ?? undefined;
      const envelope = await response.json();
      if (!isRecord(envelope) || envelope.retCode !== 'CBC.0000') {
        throw new DqeGatewayError(
          'DQE_ENVELOPE_ERROR',
          `DQE 返回失败:${String(isRecord(envelope) ? envelope.retCode : 'INVALID')}`,
          envelope
        );
      }
      if (!Array.isArray(envelope.results) || envelope.results.length !== calls.length) {
        throw new DqeGatewayError(
          'DQE_ENVELOPE_ERROR',
          `DQE results 数量与 dsl_list 不一致:期望 ${calls.length},实际 ${
            Array.isArray(envelope.results) ? envelope.results.length : '非数组'
          }`,
          envelope
        );
      }

      envelope.results.forEach((rawResult, index) => {
        const call = calls[index]!;
        diagnostic(
          call.executionId,
          'response',
          { ...(requestId ? { requestId } : {}), result: rawResult },
          batchId,
          index
        );
        try {
          if (!isRecord(rawResult) || rawResult.code !== 'SUCCESS') {
            throw new DqeGatewayError(
              'DQE_ITEM_ERROR',
              `DQE 查询项执行失败:${String(isRecord(rawResult) ? rawResult.code : 'INVALID')}`,
              rawResult
            );
          }
          const rows = normalizeRows(rawResult.data, call.query);
          if (
            typeof rawResult.total_count !== 'number' ||
            !Number.isInteger(rawResult.total_count) ||
            rawResult.total_count < 0
          ) {
            throw new DqeGatewayError(
              'DQE_ITEM_ERROR',
              'DQE 成功查询项的 total_count 必须是非负整数',
              rawResult
            );
          }
          const totalCount = rawResult.total_count;
          diagnostic(
            call.executionId,
            'normalized',
            { rowCount: rows.length, totalCount, rows: rows.slice(0, 20) },
            batchId,
            index
          );
          call.resolve({ rows, totalCount });
        } catch (cause) {
          diagnostic(call.executionId, 'error', diagnosticError(cause), batchId, index);
          call.reject(cause);
        }
      });
    } catch (cause) {
      const error =
        cause instanceof DqeGatewayError
          ? cause
          : new DqeGatewayError('DQE_TRANSPORT_ERROR', `DQE 请求不可达:${String(cause)}`, cause);
      for (const call of calls) {
        diagnostic(call.executionId, 'error', diagnosticError(error), batchId);
        call.reject(error);
      }
    } finally {
      clearTimeout(timer);
      releaseBatch();
    }
  }

  function flush(): void {
    scheduled = false;
    const calls = pending;
    pending = [];
    if (calls.length > 0) void executeBatch(calls);
  }

  return {
    fetchData(query) {
      if (query.language !== 'dqe') {
        return Promise.reject(
          new DqeGatewayError('DQE_CONFIG_ERROR', 'DQE 数据网关收到非 DQE 生效查询')
        );
      }
      if (query.body.dsl_list.length !== 1) {
        return Promise.reject(
          new DqeGatewayError(
            'DQE_CONFIG_ERROR',
            `一个命名页面数据源必须包含一个 DQE 查询项,收到 ${query.body.dsl_list.length} 个`
          )
        );
      }
      const executionId = `dqe-exec-${++sequence}`;
      diagnostic(executionId, 'base', query.body);
      let item: JsonObject;
      try {
        item = effectiveDqeItem(query);
        diagnostic(executionId, 'effective', item);
      } catch (cause) {
        diagnostic(executionId, 'error', diagnosticError(cause));
        return Promise.reject(cause);
      }
      return new Promise<DataGatewayResult>((resolve, reject) => {
        pending.push({ executionId, query, item, resolve, reject });
        if (!scheduled) {
          scheduled = true;
          queueMicrotask(flush);
        }
      });
    },
    async fetchDimensionValues() {
      return [];
    }
  };
}

/** 在不改变页面查询定义的前提下，克隆并覆盖当前生效筛选。 */
export function effectiveDqeItem(query: EffectiveQuery): JsonObject {
  const item = cloneJson(query.body.dsl_list[0]);
  for (const filter of query.filterValues) {
    if (filter.target === 'dimension') {
      setDimensionFilter(item, filter.queryField, filter.values);
    } else {
      setTimeFilter(item, filter.value.from, filter.value.to);
    }
  }
  if (query.pagination) {
    const order = isRecord(item.order) ? { ...item.order } : {};
    order.offset = query.pagination.offset;
    order.limit = query.pagination.limit;
    item.order = order;
  }
  return item;
}

function setDimensionFilter(
  item: JsonObject,
  queryField: string,
  values: Array<string | number>
): void {
  const filter = ensureRecord(item, 'filter');
  const existing = Array.isArray(filter.dims)
    ? filter.dims.filter(isRecord).map((entry) => ({ ...entry }))
    : [];
  const index = existing.findIndex((entry) => entry.dim_name === queryField);
  if (values.length === 0) {
    if (index >= 0) existing.splice(index, 1);
  } else {
    const next = { dim_name: queryField, dim_value_list: values } satisfies JsonObject;
    if (index >= 0) existing[index] = { ...existing[index], ...next };
    else existing.push(next);
  }
  filter.dims = existing;
}

function setTimeFilter(item: JsonObject, start: string, end: string): void {
  const filter = ensureRecord(item, 'filter');
  if (!isRecord(filter.time)) {
    throw new DqeGatewayError(
      'DQE_FILTER_BINDING_ERROR',
      'time 筛选绑定要求原始 DQE 声明 filter.time，以保留 period/is_aggregate'
    );
  }
  filter.time = { ...filter.time, start, end };
}

function ensureRecord(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (current === undefined) {
    const created: JsonObject = {};
    parent[key] = created;
    return created;
  }
  if (!isRecord(current)) {
    throw new DqeGatewayError(
      'DQE_FILTER_BINDING_ERROR',
      `DQE ${key} 必须是对象`
    );
  }
  const copy = { ...current };
  parent[key] = copy;
  return copy;
}

function normalizeRows(value: unknown, query: EffectiveQuery): Row[] {
  if (!Array.isArray(value)) {
    throw new DqeGatewayError('DQE_ROW_CONTRACT_ERROR', 'DQE data 必须是数组', value);
  }
  return value.map((rawRow, rowIndex) => {
    if (!isRecord(rawRow)) {
      throw new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `DQE data[${rowIndex}] 必须是对象`,
        rawRow
      );
    }
    const row: Row = {};
    for (const [fieldId, mapping] of Object.entries(query.fieldMappings)) {
      if (!Object.hasOwn(rawRow, mapping.queryField)) {
        throw new DqeGatewayError(
          'DQE_FIELD_MAPPING_ERROR',
          `响应缺少映射字段:${mapping.queryField}`,
          { fieldId, queryField: mapping.queryField, actual: Object.keys(rawRow) }
        );
      }
      const fieldValue = rawRow[mapping.queryField];
      if (!isScalar(fieldValue) || !matchesType(fieldValue, mapping.type)) {
        throw new DqeGatewayError(
          'DQE_ROW_CONTRACT_ERROR',
          `字段 ${mapping.queryField} 不符合类型 ${mapping.type}`,
          { fieldId, value: fieldValue }
        );
      }
      row[fieldId] = fieldValue;
    }
    return row;
  });
}

function matchesType(value: string | number | boolean | null, type: FieldType): boolean {
  if (value === null) return true;
  if (type === 'date' || type === 'datetime') return typeof value === 'string';
  return typeof value === type;
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diagnosticError(cause: unknown): unknown {
  return cause instanceof DqeGatewayError
    ? { code: cause.code, message: cause.message, detail: cause.detail }
    : { code: 'UNKNOWN', message: String(cause) };
}
