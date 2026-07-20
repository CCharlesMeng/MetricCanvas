import { DialectError, type FieldNode, type ParsedQuery, type TableNode } from './dialect';
import { parseWhere } from './where';
import { findTable, metricBaseInfo, tables, type SimRow } from './tables';

/**
 * 方言执行器:对种子表真执行 @where 过滤、@function/保留字段聚合、@order 排序、
 * @limit/@offset 分页。响应 data 以服务码为 key(《中间层分析.md》§3.2.2),
 * 不返回总条数(§3.2.3 的现实怪癖,照搬)。
 */
export function executeQuery(query: ParsedQuery): Record<string, unknown> {
  if (query.kind === 'introspection') {
    const table = findTable(query.typeName);
    // 【假设,#3 核对】未知服务的内省:真实服务行为未记录,仿真返回空字段而非报错
    const fields = table
      ? [...table.columns, `${measureColumn(table.columns)}_sum`, 'cnt'].map((name) => ({ name }))
      : [];
    return { [query.alias === '__type' ? query.typeName : query.alias]: { fields } };
  }

  if (query.kind === 'rest') {
    if (query.resolver !== 'MetricBaseInfo') {
      throw new DialectError(`restQuery 只支持 MetricBaseInfo resolver,收到 ${query.resolver}`);
    }
    // 【假设,#3 核对】request 参数形状按 §3.4 录制样例强制,缺 metric_type/limit/offset 即报错
    for (const required of ['metric_type', 'limit', 'offset']) {
      if (!(required in query.request)) {
        throw new DialectError(`MetricBaseInfo 缺少 request 参数 ${required}`);
      }
    }
    const code = query.request['metric_code'];
    const list = code ? metricBaseInfo.filter((m) => m.metric_code === code) : metricBaseInfo;
    return { restQuery: { MetricBaseInfo: list.map((m) => pick(m, query.fields)) } };
  }

  // 【假设,#3 核对——且是对已记录机制的改写】报告 §1.1 记录的批量是 `?ids=ds1,...` 查询参数
  // 上限 5;仿真按"单请求表块数 ≤ 5"执行同等约束(适配器/编排器不用 ?ids 通道)。
  // 真实服务对多表块单请求的上限行为未记录,联调时核对两种口径。
  if (query.tables.length > 5) {
    throw new DialectError(`单请求查询数超上限 5(收到 ${query.tables.length} 个表块)`);
  }
  const data: Record<string, unknown> = {};
  for (const tableNode of query.tables) {
    data[tableNode.name] = executeTable(tableNode, query);
  }
  return data;
}

function executeTable(node: TableNode, query: Extract<ParsedQuery, { kind: 'common' }>): SimRow[] {
  const table = findTable(node.name);
  if (!table) throw new DialectError(`服务不存在:${node.name}(数据服务目录内可用:${tables.map((t) => t.serviceCode).join('、')})`);

  // 过滤:全局 @where 与表级 @where 取合取;条件引用未知列即报错,
  // 防止"时间列名配错→过滤永假→静默空集"这类适配层配置错误被吞掉
  let rows = table.rows;
  for (const condition of [query.where, node.where]) {
    if (condition) {
      const predicate = parseWhere(condition, table.columns);
      rows = rows.filter(predicate);
    }
  }

  // 字段分类:聚合字段(@function / cnt / *_sum 保留字段)与普通字段(分组键)
  const measure = measureColumn(table.columns);
  const aggregates: Array<{ field: FieldNode; kind: 'sum' | 'avg' | 'count'; column: string }> = [];
  const plains: FieldNode[] = [];
  for (const field of node.fields) {
    const fn = field.directives['function'];
    if (fn) {
      const kind = String(fn.value);
      if (kind !== 'sum' && kind !== 'avg' && kind !== 'count') {
        // 【假设,#3 核对】@function 完整清单未知(PRD 待确认 2),仿真先只认 sum/avg/count
        throw new DialectError(`@function 不支持 ${kind}(仿真按假设只认 sum/avg/count,联调后修订)`);
      }
      aggregates.push({ field, kind, column: field.name });
    } else if (field.name === 'cnt') {
      aggregates.push({ field, kind: 'count', column: measure });
    } else if (field.name.endsWith('_sum')) {
      const column = field.name.slice(0, -'_sum'.length);
      if (!table.columns.includes(column)) throw new DialectError(`保留字段 ${field.name} 无对应列 ${column}`);
      aggregates.push({ field, kind: 'sum', column });
    } else {
      if (!table.columns.includes(field.name)) throw new DialectError(`字段不存在:${node.name}.${field.name}`);
      plains.push(field);
    }
  }

  let out: SimRow[];
  if (aggregates.length > 0) {
    out = groupAggregate(rows, plains, aggregates);
  } else {
    out = rows.map((row) => pick(row, plains.map((f) => f.name)));
  }

  out = applyOrder(out, node.fields);
  const offset = query.offset ?? 0;
  const limit = query.limit ?? out.length;
  return out.slice(offset, offset + limit);
}

function groupAggregate(
  rows: SimRow[],
  plains: FieldNode[],
  aggregates: Array<{ field: FieldNode; kind: 'sum' | 'avg' | 'count'; column: string }>
): SimRow[] {
  const keys = plains.map((f) => f.name);
  const groups = new Map<string, SimRow[]>();
  for (const row of rows) {
    const key = JSON.stringify(keys.map((k) => row[k]));
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }
  // 【假设,#3 核对】分组结果顺序(按首次出现序)与聚合值两位小数舍入均为仿真选择,
  // 真实服务的返回序与数值精度未记录;适配器不得依赖顺序,展示精度归组件展示配置
  return [...groups.values()].map((members) => {
    const out: SimRow = {};
    for (const key of keys) out[key] = members[0][key];
    for (const { field, kind, column } of aggregates) {
      const values = members.map((m) => Number(m[column] ?? 0));
      if (kind === 'count') out[field.name] = members.length;
      else if (kind === 'sum') out[field.name] = round2(values.reduce((a, b) => a + b, 0));
      else out[field.name] = round2(values.reduce((a, b) => a + b, 0) / (values.length || 1));
    }
    return out;
  });
}

function applyOrder(rows: SimRow[], fields: FieldNode[]): SimRow[] {
  const orders = fields
    .filter((f) => f.directives['order'])
    .map((f) => ({
      column: f.name,
      desc: String(f.directives['order'].type) === 'desc',
      priority: Number(f.directives['order'].priority ?? 1)
    }))
    .sort((a, b) => a.priority - b.priority);
  if (orders.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, desc } of orders) {
      const cmp = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

/** 指标行式表的度量列:约定 metric_value 系列;种子表均含之 */
function measureColumn(columns: string[]): string {
  return columns.find((c) => c.startsWith('metric_value')) ?? 'metric_value';
}

function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): SimRow {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in obj) out[key] = obj[key];
  return out as SimRow;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
