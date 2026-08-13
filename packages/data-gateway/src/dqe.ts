import {
  normalizeQueryRows,
  type QueryErrorCode,
  type QueryRowNormalizationIssue,
  type EffectiveQuery,
  type JsonObject,
  type JsonValue,
  type Row
} from '@metriccanvas/page';
import type {
  DataGateway,
  DataGatewayResult,
  DimensionValuesGateway,
  DimensionValuesResult,
  QueryDiagnosticContext
} from '@metriccanvas/runtime';
import type { DqeDevDetail } from './dev-detail';

export const DEFAULT_DQE_ENDPOINT =
  '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';

export type DqeDiagnosticStatus = 'success' | 'error';

/**
 * 查询诊断记录:生产态查询诊断的唯一形状(issue #47)。
 *
 * 只保留定位标识(看板页面、页面修订、页面数据源、执行与上游请求)、
 * 开始时间、耗时、结果行数、状态与结构化错误分类。形状封闭且字段全部为
 * 标量或标识列表——原始响应、数据行、字段值、筛选值与上游错误正文
 * 没有任何字段可以进入。开发期明细走独立的 DqeDevDetail 通道。
 */
export interface DqeDiagnosticRecord {
  /** 数据网关生成的执行标识;一次生效查询执行恰好一条记录。 */
  executionId: string;
  /** 批量请求标识;进入批次前已失败的执行没有。 */
  batchId?: string;
  /** 上游响应头 x-request-id。 */
  requestId?: string;
  pageId?: string;
  pageRevisionId?: string;
  /** 本次执行服务的页面数据源 id;生效查询去重后可能对应多个。 */
  dataSourceIds?: readonly string[];
  startedAt: string;
  durationMs: number;
  status: DqeDiagnosticStatus;
  rowCount?: number;
  totalCount?: number;
  errorCode?: DqeGatewayError['code'] | 'UNKNOWN';
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
  /** 开发期明细通道:显式注入才存在,生产渲染通道不得注入。 */
  devDetail?: DqeDevDetail;
}

interface PendingQuery {
  executionId: string;
  startedAt: string;
  startedMs: number;
  context?: QueryDiagnosticContext;
  query: EffectiveQuery;
  item: JsonObject;
  resolve(result: DataGatewayResult): void;
  reject(error: unknown): void;
}

export class DqeGatewayError extends Error {
  /**
   * code 是查询错误分类的抛出根:类型即 @metriccanvas/page 的
   * QueryErrorCode 封闭联合,不在本包另列一份(issue #51)。
   *
   * detail 只允许结构化事实(类型名、数量、字段名、上游返回码):
   * 原始响应、数据行、字段值、筛选值与上游错误正文不得进入,
   * 否则会经错误日志泄漏业务数据(issue #47)。
   */
  constructor(
    readonly code: QueryErrorCode,
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
 *
 * 同时实现独立的维度候选值端口(issue #54):候选值查询是单项 DQE 执行,
 * 返回真实去重候选值;上游明确拒答该查询时按能力不可用返回,不伪装成空结果。
 */
export function createDqeGateway(
  config: DqeGatewayConfig = {}
): DataGateway & DimensionValuesGateway {
  const {
    endpoint = DEFAULT_DQE_ENDPOINT,
    headers = {},
    fetchImpl = fetch,
    timeoutMs = 30_000,
    maxConcurrentBatches = 5,
    credentials = 'same-origin',
    diagnostics,
    devDetail
  } = config;

  let sequence = 0;
  let batchSequence = 0;
  let scheduled = false;
  let pending: PendingQuery[] = [];
  let activeBatches = 0;
  const batchWaiters: Array<() => void> = [];

  interface ExecutionOutcome {
    status: DqeDiagnosticStatus;
    batchId?: string;
    requestId?: string;
    rowCount?: number;
    totalCount?: number;
    errorCode?: DqeDiagnosticRecord['errorCode'];
  }

  function recordDiagnostic(
    call: Pick<PendingQuery, 'executionId' | 'startedAt' | 'startedMs' | 'context'>,
    outcome: ExecutionOutcome
  ): void {
    if (!diagnostics) return;
    const { pageId, pageRevisionId, dataSourceIds } = call.context ?? {};
    diagnostics.record({
      executionId: call.executionId,
      ...(outcome.batchId !== undefined ? { batchId: outcome.batchId } : {}),
      ...(outcome.requestId !== undefined ? { requestId: outcome.requestId } : {}),
      ...(pageId !== undefined ? { pageId } : {}),
      ...(pageRevisionId !== undefined ? { pageRevisionId } : {}),
      ...(dataSourceIds !== undefined ? { dataSourceIds } : {}),
      startedAt: call.startedAt,
      durationMs: Math.max(0, Date.now() - call.startedMs),
      status: outcome.status,
      ...(outcome.rowCount !== undefined ? { rowCount: outcome.rowCount } : {}),
      ...(outcome.totalCount !== undefined ? { totalCount: outcome.totalCount } : {}),
      ...(outcome.errorCode !== undefined ? { errorCode: outcome.errorCode } : {})
    });
  }

  function settleSuccess(
    call: PendingQuery,
    result: DataGatewayResult,
    batchId: string,
    requestId?: string
  ): void {
    recordDiagnostic(call, {
      status: 'success',
      batchId,
      ...(requestId !== undefined ? { requestId } : {}),
      rowCount: result.rows.length,
      ...(result.totalCount !== undefined ? { totalCount: result.totalCount } : {})
    });
    call.resolve(result);
  }

  function settleFailure(
    call: PendingQuery,
    cause: unknown,
    batchId?: string,
    requestId?: string
  ): void {
    recordDiagnostic(call, {
      status: 'error',
      ...(batchId !== undefined ? { batchId } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
      errorCode: cause instanceof DqeGatewayError ? cause.code : 'UNKNOWN'
    });
    call.reject(cause);
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
    let requestId: string | undefined;
    let timedOut = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=utf-8', ...headers },
        credentials,
        body: JSON.stringify({ dsl_list: calls.map((call) => call.item) }),
        signal: controller.signal
      });
      requestId = response.headers.get('x-request-id') ?? undefined;
      if (!response.ok) {
        throw httpStatusError(response.status);
      }
      const results = envelopeResults(await response.json(), calls.length);

      results.forEach((rawResult, index) => {
        const call = calls[index]!;
        try {
          if (!isRecord(rawResult)) {
            throw new DqeGatewayError(
              'DQE_ITEM_ERROR',
              `DQE 查询项结果必须是对象,实际是 ${describeType(rawResult)}`,
              { resultType: describeType(rawResult) }
            );
          }
          if (rawResult.code !== 'SUCCESS') {
            // 上游对本查询项的明确拒答;retDesc 属上游错误正文,不进入错误对象。
            throw new DqeGatewayError(
              'DQE_QUERY_REJECTED',
              `DQE 拒绝执行查询项:${String(rawResult.code)}`,
              { resultCode: String(rawResult.code) }
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
              { totalCountType: describeType(rawResult.total_count) }
            );
          }
          settleSuccess(call, { rows, totalCount: rawResult.total_count }, batchId, requestId);
        } catch (cause) {
          settleFailure(call, cause, batchId, requestId);
        }
      });
    } catch (cause) {
      const error = classifiedFetchError(cause, timedOut, timeoutMs);
      for (const call of calls) {
        settleFailure(call, error, batchId, requestId);
      }
    } finally {
      clearTimeout(timer);
      releaseBatch();
    }
  }

  /**
   * 维度候选值查询:单项 DQE 执行,独立于生效查询批次——它有自己的
   * 取消信号,不能与批内其他查询共享一个 AbortController;并发额度仍
   * 与批量执行共享。候选值查询不是生效查询,不落查询诊断记录(issue #47
   * 的诊断形状按生效查询声明)。
   */
  async function fetchDimensionValuesOnce(
    dimension: string,
    signal?: AbortSignal
  ): Promise<DimensionValuesResult> {
    if (signal?.aborted) {
      throw new DqeGatewayError('DQE_CANCELLED', '候选值请求已被取消');
    }
    await acquireBatch();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortByCaller = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abortByCaller, { once: true });
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=utf-8', ...headers },
        credentials,
        body: JSON.stringify({ dsl_list: [dimensionValuesDqeItem(dimension)] }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw httpStatusError(response.status);
      }
      const [result] = envelopeResults(await response.json(), 1);
      if (!isRecord(result)) {
        throw new DqeGatewayError(
          'DQE_ITEM_ERROR',
          `DQE 候选值结果必须是对象,实际是 ${describeType(result)}`,
          { resultType: describeType(result) }
        );
      }
      // 上游对候选值查询的明确拒答 = 该维度的候选值能力不可用,
      // 不伪装成空结果;retDesc 属上游错误正文,不进入任何对象。
      if (result.code !== 'SUCCESS') return { kind: 'unavailable' };
      return { kind: 'values', values: dedupedDimensionValues(result.data, dimension) };
    } catch (cause) {
      throw classifiedFetchError(cause, timedOut, timeoutMs);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortByCaller);
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
    fetchData(query, diagnosticContext) {
      const execution = {
        executionId: `dqe-exec-${++sequence}`,
        startedAt: new Date().toISOString(),
        startedMs: Date.now(),
        ...(diagnosticContext ? { context: diagnosticContext } : {})
      };
      const failEarly = (cause: unknown) => {
        recordDiagnostic(execution, {
          status: 'error',
          errorCode: cause instanceof DqeGatewayError ? cause.code : 'UNKNOWN'
        });
        return Promise.reject(cause);
      };
      if (query.language !== 'dqe') {
        return failEarly(
          new DqeGatewayError('DQE_CONFIG_ERROR', 'DQE 数据网关收到非 DQE 生效查询')
        );
      }
      if (query.body.dsl_list.length !== 1) {
        return failEarly(
          new DqeGatewayError(
            'DQE_CONFIG_ERROR',
            `一个命名页面数据源必须包含一个 DQE 查询项,收到 ${query.body.dsl_list.length} 个`
          )
        );
      }
      let item: JsonObject;
      try {
        item = effectiveDqeItem(query);
      } catch (cause) {
        return failEarly(cause);
      }
      devDetail?.record(execution.executionId, item);
      return new Promise<DataGatewayResult>((resolve, reject) => {
        pending.push({ ...execution, query, item, resolve, reject });
        if (!scheduled) {
          scheduled = true;
          queueMicrotask(flush);
        }
      });
    },
    fetchDimensionValues(dimension, options) {
      return fetchDimensionValuesOnce(dimension, options?.signal);
    }
  };
}

/**
 * 维度候选值的 DQE 查询项:只输出目标维度、不取指标,由上游完成维度
 * 枚举,适配器再去重。候选项不做时间收窄——候选值是维度取值域,不是
 * 某时间窗内的出现值;真实环境协议复验归 issue #3。
 */
export function dimensionValuesDqeItem(dimension: string): JsonObject {
  return {
    output_dims: [dimension],
    output_metrics: [],
    filter: { dims: [], metrics: [] },
    order: {}
  };
}

/** 候选值提取与去重:错误只携带行号与类型事实,不回显业务值(issue #47)。 */
function dedupedDimensionValues(data: unknown, dimension: string): string[] {
  if (!Array.isArray(data)) {
    throw new DqeGatewayError('DQE_ITEM_ERROR', 'DQE 候选值 data 必须是数组', {
      dataType: describeType(data)
    });
  }
  const values = new Set<string>();
  data.forEach((row, rowIndex) => {
    if (!isRecord(row)) {
      throw new DqeGatewayError(
        'DQE_ITEM_ERROR',
        `DQE 候选值 data[${rowIndex}] 必须是对象`,
        { rowIndex }
      );
    }
    const value = row[dimension];
    // null/缺失不是候选项;维度值以字符串呈现给筛选状态。
    if (value === null || value === undefined) return;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new DqeGatewayError(
        'DQE_ITEM_ERROR',
        `DQE 候选值 data[${rowIndex}] 的维度值必须是字符串或数字`,
        { rowIndex, valueType: describeType(value) }
      );
    }
    values.add(String(value));
  });
  return [...values];
}

/** 校验 DQE 响应信封并返回结果项数组;信封失败按 DQE_ENVELOPE_ERROR 分类。 */
function envelopeResults(envelope: unknown, expected: number): unknown[] {
  if (!isRecord(envelope) || envelope.retCode !== 'CBC.0000') {
    throw new DqeGatewayError(
      'DQE_ENVELOPE_ERROR',
      `DQE 返回失败:${String(isRecord(envelope) ? envelope.retCode : 'INVALID')}`,
      { retCode: isRecord(envelope) ? String(envelope.retCode) : 'INVALID' }
    );
  }
  if (!Array.isArray(envelope.results) || envelope.results.length !== expected) {
    throw new DqeGatewayError(
      'DQE_ENVELOPE_ERROR',
      `DQE results 数量与 dsl_list 不一致:期望 ${expected},实际 ${
        Array.isArray(envelope.results) ? envelope.results.length : '非数组'
      }`,
      {
        expected,
        actual: Array.isArray(envelope.results)
          ? envelope.results.length
          : describeType(envelope.results)
      }
    );
  }
  return envelope.results;
}

/**
 * fetch 失败的稳定分类:已分类错误原样保留,网关自身超时(timedOut 旗标)、
 * 外部取消(AbortError)与传输失败各有独立分类。
 */
function classifiedFetchError(
  cause: unknown,
  timedOut: boolean,
  timeoutMs: number
): DqeGatewayError {
  if (cause instanceof DqeGatewayError) return cause;
  if (timedOut) {
    return new DqeGatewayError('DQE_TIMEOUT', `DQE 请求超过 ${timeoutMs}ms 未返回`, {
      timeoutMs
    });
  }
  if (isAbortError(cause)) {
    return new DqeGatewayError('DQE_CANCELLED', 'DQE 请求已被取消');
  }
  return new DqeGatewayError('DQE_TRANSPORT_ERROR', `DQE 请求不可达:${String(cause)}`);
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
  const normalized = normalizeQueryRows(value, query.fieldMappings);
  if (normalized.ok) return normalized.rows;
  throw gatewayNormalizationError(normalized.issues[0]!);
}

/**
 * 归一化问题 → 数据网关错误。与结果字段契约校验一致,错误只携带
 * 行号、字段名、错误分类与预期类型,不回显业务字段值(issue #47/#50:
 * 原始行与原始值在 issue 形状上即被结构性排除)。
 */
function gatewayNormalizationError(
  issue: QueryRowNormalizationIssue
): DqeGatewayError {
  switch (issue.code) {
    case 'ROWS_NOT_ARRAY':
      return new DqeGatewayError('DQE_ROW_CONTRACT_ERROR', 'DQE data 必须是数组');
    case 'ROW_NOT_OBJECT':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `DQE data[${issue.rowIndex}] 必须是对象`,
        { rowIndex: issue.rowIndex }
      );
    case 'MISSING_QUERY_FIELD':
      return new DqeGatewayError(
        'DQE_FIELD_MAPPING_ERROR',
        `响应缺少映射字段:${issue.queryField}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          queryField: issue.queryField,
          actual: issue.actualFields
        }
      );
    case 'NULL_NOT_ALLOWED':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `字段 ${issue.queryField} 为 null,契约声明 nullable=false`,
        { rowIndex: issue.rowIndex, fieldId: issue.fieldId }
      );
    case 'TYPE_MISMATCH':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `字段 ${issue.queryField} 不符合类型 ${issue.expectedType}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          expectedType: issue.expectedType
        }
      );
    case 'DETAIL_LIST_TOO_LARGE':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.queryField} 超过 ${issue.maximum} 项上限`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          actualLength: issue.actualLength
        }
      );
    case 'SEMANTIC_HTML_TOO_LARGE':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `语义 HTML 字段 ${issue.queryField} 超过 ${issue.maximum} 字符上限`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          actualLength: issue.actualLength
        }
      );
    case 'DETAIL_ITEM_NOT_OBJECT':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.queryField}[${issue.itemIndex}] 必须是对象`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemIndex: issue.itemIndex
        }
      );
    case 'MISSING_DETAIL_QUERY_FIELD':
      return new DqeGatewayError(
        'DQE_FIELD_MAPPING_ERROR',
        `嵌套明细 ${issue.queryField}[${issue.itemIndex}] 缺少映射字段:${issue.itemQueryField}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemFieldId: issue.itemFieldId,
          actual: issue.actualFields
        }
      );
    case 'DETAIL_UNDECLARED_FIELD':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.queryField}[${issue.itemIndex}] 包含未声明字段:${issue.itemFieldId}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemIndex: issue.itemIndex,
          itemFieldId: issue.itemFieldId
        }
      );
    case 'DETAIL_MISSING_FIELD':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.queryField}[${issue.itemIndex}] 缺少字段:${issue.itemFieldId}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemIndex: issue.itemIndex,
          itemFieldId: issue.itemFieldId
        }
      );
    case 'DETAIL_NULL_NOT_ALLOWED':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.itemQueryField ?? issue.itemFieldId} 为 null,契约声明 nullable=false`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemFieldId: issue.itemFieldId,
          itemIndex: issue.itemIndex
        }
      );
    case 'DETAIL_TYPE_MISMATCH':
      return new DqeGatewayError(
        'DQE_ROW_CONTRACT_ERROR',
        `嵌套明细字段 ${issue.itemQueryField ?? issue.itemFieldId} 不符合类型 ${issue.expectedType}`,
        {
          rowIndex: issue.rowIndex,
          fieldId: issue.fieldId,
          itemFieldId: issue.itemFieldId,
          itemIndex: issue.itemIndex,
          expectedType: issue.expectedType
        }
      );
  }
}

/** HTTP 状态 → 稳定分类:401 需要登录、403 无权限,其余为上游失败。 */
function httpStatusError(status: number): DqeGatewayError {
  if (status === 401) {
    return new DqeGatewayError(
      'DQE_AUTH_REQUIRED',
      '需要登录后才能执行查询(401)',
      { status }
    );
  }
  if (status === 403) {
    return new DqeGatewayError(
      'DQE_FORBIDDEN',
      '没有执行该查询的权限(403)',
      { status }
    );
  }
  return new DqeGatewayError(
    'DQE_TRANSPORT_ERROR',
    `DQE HTTP 请求失败:${status}`,
    { status }
  );
}

/** 外部取消(fetch AbortError)与网关自身超时分开分类;超时由 timedOut 旗标判定。 */
function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 错误 detail 只描述值的类型,不回显值本身。 */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}
