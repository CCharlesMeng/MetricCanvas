import type { EffectiveQuery, FilterCondition, Row } from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';

/**
 * 数据服务适配器(无状态纯翻译层,solution.md §4):
 * 生效查询 → apiQuery 方言(指标行式表:metric_code 过滤 + 维度分组 + 聚合字段),
 * 响应归一化(信封解包 + 行式转列),@where 操作符白名单防注入,超时 + 幂等重试。
 * 协议依据《中间层分析.md》;开发期对数据服务仿真(tools/data-service-sim),
 * 真实联调(#3)核对其中标注的假设。
 */
export interface DataServiceConfig {
  baseUrl: string;
  /** 指标行式表的服务码(一期单表;多表路由待真实目录联调后设计) */
  serviceCode: string;
  /** 时间范围条件写到哪一列(时间粒度映射表进元数据快照是 #3 事项)【假设】 */
  timeColumn?: string;
  /** 【假设,#3 核对】isTest 生产语义未知,先固定传值 */
  isTest?: boolean;
  /** 鉴权头(x-operator-id/tenantId/appId/cftk),真实值 #3/#11 联调注入 */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /** 超时,报告无约定、按启示自实现(§1.4),默认 30s */
  timeoutMs?: number;
  /** 幂等查询重试次数(指数退避),默认 2 */
  retries?: number;
  /** 退避基数(测试注入用),默认 300ms */
  retryBaseMs?: number;
}

export function createDataServiceGateway(config: DataServiceConfig): DataGateway {
  const {
    baseUrl,
    serviceCode,
    timeColumn = 'mtime',
    isTest = true,
    headers = {},
    fetchImpl = fetch,
    timeoutMs = 30_000,
    retries = 2,
    retryBaseMs = 300
  } = config;

  async function graphql(apiQuery: string): Promise<Record<string, unknown>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(retryBaseMs * 2 ** (attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/rest/cbc/cbcbidynamicapiservice/v1/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json;charset=utf-8', ...headers },
          body: JSON.stringify({ apiQuery, isTest }),
          signal: controller.signal
        });
        const envelope = (await response.json()) as {
          retCode?: string;
          retDesc?: string;
          data?: Record<string, unknown>;
        };
        // 业务级错误(含未登录信号)不重试:重试改变不了结果
        if (envelope.retCode !== 'CBC.0000') {
          throw new DataServiceError(envelope.retCode ?? 'UNKNOWN', envelope.retDesc ?? '未知错误');
        }
        return envelope.data ?? {};
      } catch (cause) {
        if (cause instanceof DataServiceError) throw cause;
        lastError = cause; // 网络错误/超时:查询幂等,退避后重试
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`数据服务不可达(已重试 ${retries} 次):${String(lastError)}`);
  }

  async function execute(query: EffectiveQuery): Promise<Row[]> {
    const apiQuery = translateQuery(query, { serviceCode, timeColumn });
    const data = await graphql(apiQuery);
    return pivotRows(rowsOf(data, serviceCode), query);
  }

  return {
    async fetchData(query: EffectiveQuery): Promise<Row[]> {
      if (!needsWideRowStrategy(query)) return execute(query);

      // 本地策略会移除窗口声明,须先复用翻译器的数值防线,不能让改写绕过校验。
      if (query.limit !== undefined) assertPageNumber('limit', query.limit);
      if (query.offset !== undefined) assertPageNumber('offset', query.offset);
      const metricOrderFields = validateWideRowOrderBy(query);
      const distinctMetricOrderFields = [...new Set(metricOrderFields)];
      const dimensions = query.dimensions ?? [];
      if (dimensions.length !== 1 || distinctMetricOrderFields.length > 1) {
        // 多维度或多指标排序无法安全拆成"单指标取键 + 多指标回填"。此处可能取全量,
        // 先在适配器内恢复生效查询语义;未来由元数据目录/数据服务能力声明替换。
        const rows = await execute(withoutRowLevelWindow(query));
        return applyLocalWindow(rows, query);
      }

      const dimension = dimensions[0];
      const orderingMetric = metricOrderFields[0] ?? query.metrics[0];
      const keyRows = await execute({ ...query, metrics: [orderingMetric] });
      const keys = orderedDimensionKeys(keyRows, dimension);
      if (keys.length === 0) return [];

      const fullQuery = withoutRowLevelWindow({
        ...query,
        conditions: [
          ...query.conditions,
          { dimension, operator: 'in', value: keys }
        ]
      });
      const rows = await execute(fullQuery);
      return orderRowsByDimensionKeys(rows, dimension, keys);
    },

    async fetchDimensionValues(dimension: string): Promise<string[]> {
      // 【假设,#3 核对】去重取值借"维度列 + cnt 保留字段"的分组查询实现 distinct,
      // 方言无 distinct 指令是报告空白;真实服务若有专用取值接口,联调后替换
      const apiQuery = `{query{${serviceCode}{${assertColumn(dimension)} cnt}}}`;
      const data = await graphql(apiQuery);
      return rowsOf(data, serviceCode).map((row) => String(row[dimension]));
    }
  };
}

/**
 * 指标行式表的 @limit/@offset 作用于原始指标行,不能直接表达多指标宽行窗口。
 * 仅在多指标查询确实需要窗口或按指标排序时启用适配器内部策略。
 */
function needsWideRowStrategy(query: EffectiveQuery): boolean {
  return (
    query.metrics.length > 1 &&
    (query.limit !== undefined ||
      query.offset !== undefined ||
      (query.orderBy ?? []).some((rule) => query.metrics.includes(rule.field)))
  );
}

/**
 * 宽行策略会在部分阶段去掉 orderBy,因此先复用 translateQuery 的声明级防线语义,
 * 防止重复、非法字段或非法方向被内部改写掩盖。
 */
function validateWideRowOrderBy(query: EffectiveQuery): string[] {
  const seen = new Set<string>();
  const metricFields: string[] = [];
  const dimensions = query.dimensions ?? [];
  for (const rule of query.orderBy ?? []) {
    if (rule.direction !== 'asc' && rule.direction !== 'desc') {
      throw new Error(`排序方向须为 asc/desc:${String(rule.direction)}`);
    }
    if (seen.has(rule.field)) throw new Error(`排序字段重复:${rule.field}`);
    seen.add(rule.field);
    if (!dimensions.includes(rule.field) && !query.metrics.includes(rule.field)) {
      throw new Error(`排序字段不在查询的 dimensions/metrics 中:${rule.field}`);
    }
    if (query.metrics.includes(rule.field)) metricFields.push(rule.field);
  }
  return metricFields;
}

/** 去掉会错误截断指标行的窗口/排序声明,其余查询语义原样保留。 */
function withoutRowLevelWindow(query: EffectiveQuery): EffectiveQuery {
  const result = { ...query };
  delete result.orderBy;
  delete result.limit;
  delete result.offset;
  return result;
}

function orderedDimensionKeys(rows: Row[], dimension: string): Array<string | number> {
  return rows.map((row) => {
    const value = row[dimension];
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`数据服务返回的维度键须为字符串或数字:${dimension}`);
    }
    return value;
  });
}

/** 第二阶段响应顺序不可信;仅按第一阶段键集合取行并严格恢复其 Top N 顺序。 */
function orderRowsByDimensionKeys(
  rows: Row[],
  dimension: string,
  keys: Array<string | number>
): Row[] {
  const byKey = new Map(
    rows.map((row) => [serializedDimensionKey(row[dimension]), row] as const)
  );
  return keys.flatMap((key) => {
    const row = byKey.get(serializedDimensionKey(key));
    return row ? [row] : [];
  });
}

function serializedDimensionKey(value: Row[string] | undefined): string {
  return JSON.stringify([typeof value, value]);
}

function applyLocalWindow(rows: Row[], query: EffectiveQuery): Row[] {
  const orderBy = query.orderBy ?? [];
  const sorted =
    orderBy.length === 0
      ? rows
      : rows
          .map((row, index) => ({ row, index }))
          .sort((left, right) => {
            for (const rule of orderBy) {
              const leftValue = left.row[rule.field] ?? '';
              const rightValue = right.row[rule.field] ?? '';
              const comparison =
                leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
              if (comparison !== 0) return rule.direction === 'desc' ? -comparison : comparison;
            }
            return left.index - right.index;
          })
          .map(({ row }) => row);
  const start = query.offset ?? 0;
  return sorted.slice(start, query.limit !== undefined ? start + query.limit : undefined);
}

export class DataServiceError extends Error {
  constructor(
    public retCode: string,
    retDesc: string
  ) {
    super(`数据服务返回错误 ${retCode}:${retDesc}`);
  }
}

/**
 * 生效查询 → apiQuery(指标行式表):
 * 指标集合进 metric_code 过滤,维度做分组键,聚合走 *_sum 保留字段(默认)或 @function;
 * conditions 与 timeRange 拼进 @where(操作符白名单,SQL-like 字面量与 GraphQL 字符串分层编码);
 * 分页进全局 @limit/@offset,排序按数组序映射 @order(type,priority) 挂到对应字段。
 * 【假设,#3 核对】granularity 不参与翻译:时间粒度在数据服务定义期固定(§2.3.4),
 * DSL granularity → 预定义服务的映射表随元数据快照落地。
 */
export function translateQuery(
  query: EffectiveQuery,
  options: { serviceCode: string; timeColumn: string }
): string {
  const conditions: string[] = [
    `metric_code in (${query.metrics.map(sqlLiteral).join(',')})`,
    ...query.conditions.map(conditionToWhere)
  ];
  if (query.timeRange) {
    conditions.push(
      `${assertColumn(options.timeColumn)} between ${sqlLiteral(query.timeRange.from)} and ${sqlLiteral(query.timeRange.to)}`
    );
  }

  // 聚合白名单与元数据快照默认口径一致(@function 完整清单待 #3 联调确认后扩);
  // aggregation 与其余注入面同等设防:白名单外不内插 apiQuery
  const aggregation = query.aggregation ?? 'sum';
  if (!['sum', 'avg', 'count'].includes(aggregation)) {
    throw new Error(`聚合方式不在白名单(sum/avg/count):${aggregation}`);
  }

  // 行式指标表下,一条透视行 = 每指标一条原始行:@limit/@offset 的行级分页会把
  // 多指标的透视行切开,盲翻语义不成立——单指标时两者一一对应,故分页限单指标
  // (page 校验器对表格组件有同款不变式,这里是运行时最后防线)
  if ((query.limit !== undefined || query.offset !== undefined) && query.metrics.length > 1) {
    throw new Error(`分页查询限单指标(行式指标表的透视行会被 @limit 切开),收到 ${query.metrics.length} 个`);
  }

  // 排序:数组序即优先级(1 起);维度列挂本列,指标列挂聚合值字段
  const orderOf = new Map<string, string>();
  (query.orderBy ?? []).forEach((rule, index) => {
    if (rule.direction !== 'asc' && rule.direction !== 'desc') {
      throw new Error(`排序方向须为 asc/desc:${String(rule.direction)}`);
    }
    if (orderOf.has(rule.field)) throw new Error(`排序字段重复:${rule.field}`);
    orderOf.set(rule.field, ` @order(type:"${rule.direction}",priority:${index + 1})`);
  });

  const valueField =
    aggregation === 'sum' ? 'metric_value_sum' : `metric_value @function(value:"${aggregation}")`;
  const fields = [
    ...(query.dimensions ?? []).map((code) => assertColumn(code) + takeOrder(orderOf, code)),
    'metric_code',
    // 指标列的排序作用于聚合值字段;单指标之外的场景已被上方分页约束与下方兜底拦住
    valueField + (query.metrics.length === 1 ? takeOrder(orderOf, query.metrics[0]) : '')
  ];
  if (orderOf.size > 0) {
    // 剩余排序字段按真实原因分型报错:字段确实在 metrics 中(多指标查询按指标列排序,
    // 行式指标表的透视行无单一排序值)≠ 字段根本不在查询里(写错了)
    const unattached = [...orderOf.keys()];
    const knownMetrics = unattached.filter((field) => query.metrics.includes(field));
    if (knownMetrics.length > 0) {
      throw new Error(
        `多指标查询不支持按指标列排序(行式指标表的透视行无单一排序值):${knownMetrics.join('、')}`
      );
    }
    throw new Error(`排序字段不在查询的 dimensions/metrics 中:${unattached.join('、')}`);
  }

  const globals = [
    ...(query.limit !== undefined ? [`@limit(value:${assertPageNumber('limit', query.limit)})`] : []),
    ...(query.offset !== undefined ? [`@offset(value:${assertPageNumber('offset', query.offset)})`] : [])
  ];
  const globalPart = globals.length > 0 ? ` ${globals.join(' ')}` : '';

  return `{query${globalPart}{${assertColumn(options.serviceCode)} @where(value:${encodeGraphqlString(conditions.join(' and '))}){${fields.join(' ')}}}}`;
}

/** 取走某字段的 @order 指令(取走后剩余即"引用了查询外字段"的排序,一律拒绝) */
function takeOrder(orderOf: Map<string, string>, field: string): string {
  const directive = orderOf.get(field) ?? '';
  orderOf.delete(field);
  return directive;
}

/** @limit/@offset 的值直接内插 apiQuery,与其余注入面同等设防:须非负整数 */
function assertPageNumber(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} 须为非负整数:${value}`);
  }
  return value;
}

/** @where 操作符白名单(eq/in/between),生成类 SQL 条件;列名与操作符不接受自由文本。 */
function conditionToWhere(condition: FilterCondition): string {
  const column = assertColumn(condition.dimension);
  switch (condition.operator) {
    case 'eq':
      return `${column} = ${sqlLiteral(scalar(condition.value))}`;
    case 'in': {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      return `${column} in (${values.map(sqlLiteral).join(',')})`;
    }
    case 'between': {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new Error(`between 条件须为 [下界, 上界]:${condition.dimension}`);
      }
      return `${column} between ${sqlLiteral(condition.value[0])} and ${sqlLiteral(condition.value[1])}`;
    }
    default:
      throw new Error(`筛选操作符不在白名单(eq/in/between):${String(condition.operator)}`);
  }
}

function scalar(value: FilterCondition['value']): string | number {
  if (Array.isArray(value)) throw new Error('eq 条件的值须为标量');
  return value;
}

/** SQL-like 字符串字面量以标准单引号双写编码,避免值闭合字面量。 */
function sqlLiteral(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

/** GraphQL 普通字符串与 JSON 字符串共享转义规则;统一由此处编码自由文本。 */
function encodeGraphqlString(value: string): string {
  return JSON.stringify(value);
}

/** 列名白名单形态:标识符之外(空格/引号/括号)一律拒绝,防止列名位注入 */
function assertColumn(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`非法列名:${name}`);
  return name;
}

function rowsOf(data: Record<string, unknown>, serviceCode: string): Array<Record<string, unknown>> {
  const rows = data[serviceCode];
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

/**
 * 行式转列:按维度组合分组,把 metric_code 行铺成指标列。
 * 数据服务返回 [{region, metric_code:'gmv', metric_value_sum:190}, ...],
 * 组件消费 [{region, gmv:190}, ...](数据快照的行形状,与 mock 一致)。
 */
function pivotRows(raw: Array<Record<string, unknown>>, query: EffectiveQuery): Row[] {
  const dimensions = query.dimensions ?? [];
  const groups = new Map<string, Row>();
  for (const record of raw) {
    const key = JSON.stringify(dimensions.map((d) => record[d]));
    let row = groups.get(key);
    if (!row) {
      row = {};
      for (const d of dimensions) row[d] = record[d] as Row[string];
      groups.set(key, row);
    }
    const metric = String(record['metric_code']);
    const value = record['metric_value_sum'] ?? record['metric_value'];
    if (query.metrics.includes(metric) && value !== undefined) {
      row[metric] = value as Row[string];
    }
  }
  return [...groups.values()];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
