import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 嵌入测试宿主的 DQE 端点：按 DQE 协议信封回答 `tools/dqe-sim` 的 IOC
 * 机会点清单夹具，供浏览器里的真实 `createDqeGateway` 往返。
 *
 * 为什么不直接引 `tools/dqe-sim`：本宿主要在 ADR-0074 的隔离基线里以
 * 纯 node 跑起来，那份消费者工程只装已发布的 tarball，没有工作区包，
 * 也没有 tsx。因此这里只复用夹具数据，不复用它的 TypeScript 实现；
 * 两侧对同一请求给出相同结果由 `tools/dqe-sim/tests/embed-host-parity.test.ts` 钉住。
 */

export const DQE_EXECUTE_PATH =
  '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';

const simFixtures = resolve(import.meta.dirname, '../../../tools/dqe-sim/fixtures');
const datasets = [
  readJson('ioc-opportunity-list.json'),
  ...Object.values(readJson('ioc-page-datasets.json').datasets)
];
const dimensionValues = readJson('ioc-dimension-values.json').dimensions;

function readJson(name) {
  return JSON.parse(readFileSync(resolve(simFixtures, name), 'utf8'));
}

export function executeFixtureItem(item) {
  if (!isRecord(item)) return unsupported('查询项必须是 JSON 对象');
  return listResult(item) ?? candidatesResult(item) ?? unsupported('夹具未覆盖的查询');
}

function listResult(item) {
  const fixture = datasets.find(
    (candidate) =>
      equalStrings(item.output_dims, candidate.output_dims) &&
      equalStrings(item.output_metrics, candidate.output_metrics)
  );
  if (!fixture) return undefined;
  if (!isRecord(item.filter) || !Array.isArray(item.filter.dims)) {
    return unsupported('机会点清单缺少 filter.dims');
  }
  if (!Array.isArray(fixture.filterableDims)) return unsupported('夹具缺少 filterableDims');
  const filterable = new Set([...fixture.filterableDims, ...fixture.output_dims]);
  let rows = fixture.rows;
  for (const entry of item.filter.dims) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return unsupported('维度筛选格式无效');
    }
    const name = entry.dim_name;
    if (!filterable.has(name)) return unsupported(`机会点清单不支持的维度筛选:${name}`);
    const values = stringArray(entry.dim_value_list);
    if (!values) return unsupported(`维度筛选 ${name} 必须是字符串数组`);
    if (values.length === 0) continue;
    if (entry.operator !== undefined) {
      if (values.length !== 1) return unsupported(`维度区间筛选 ${name} 需要单个端点`);
      const bound = values[0];
      const passes =
        entry.operator === '>='
          ? (value) => value >= bound
          : entry.operator === '<='
            ? (value) => value <= bound
            : undefined;
      if (!passes) return unsupported(`不支持的维度比较算子:${String(entry.operator)}`);
      rows = rows.filter((row) => passes(String(row[name] ?? '')));
      continue;
    }
    rows = rows.filter((row) => values.includes(String(row[name] ?? '')));
  }
  const sorted = sortRows(rows, item.order);
  if (sorted.error) return sorted.error;
  rows = sorted.rows;
  const metrics = item.filter.metrics;
  if (metrics !== undefined) {
    if (!Array.isArray(metrics)) return unsupported('filter.metrics 必须是数组');
    const compare = {
      '>=': (left, right) => left >= right,
      '<=': (left, right) => left <= right,
      '>': (left, right) => left > right,
      '<': (left, right) => left < right
    };
    const known = new Set(fixture.output_metrics);
    for (const entry of metrics) {
      if (!isRecord(entry) || typeof entry.metric_name !== 'string') {
        return unsupported('指标筛选格式无效');
      }
      if (!known.has(entry.metric_name)) {
        return unsupported(`不支持的指标筛选:${entry.metric_name}`);
      }
      const operator = compare[entry.operator];
      if (!operator) return unsupported(`不支持的比较算子:${String(entry.operator)}`);
      const bounds = Array.isArray(entry.metric_value_list) ? entry.metric_value_list : [];
      if (bounds.length !== 1 || typeof bounds[0] !== 'number') {
        return unsupported(`指标筛选 ${entry.metric_name} 需要单个数值端点`);
      }
      rows = rows.filter((row) => {
        const value = row[entry.metric_name];
        return typeof value === 'number' && operator(value, bounds[0]);
      });
    }
  }
  const outputs = [...fixture.output_dims, ...fixture.output_metrics];
  return success(
    item,
    rows.map((row) => Object.fromEntries(outputs.map((field) => [field, row[field] ?? null]))),
    columns(fixture.output_dims, fixture.output_metrics)
  );
}

/**
 * 候选值查询：恰好一个输出维度、不取指标。取值域来自维度闭集夹具，级联
 * 约束按 parent/of 收窄；约束的维度不是登记过的上游就拒答，不忽略约束把
 * 全量候选冒充成收窄结果。
 */
function candidatesResult(item) {
  const dimensions = stringArray(item.output_dims);
  const metrics = stringArray(item.output_metrics);
  if (!dimensions || dimensions.length !== 1 || !metrics || metrics.length !== 0) {
    return undefined;
  }
  const name = dimensions[0];
  const declaration = Object.hasOwn(dimensionValues, name) ? dimensionValues[name] : undefined;
  if (!declaration) return undefined;
  let values = declaration.values;
  const dims = isRecord(item.filter) && item.filter.dims !== undefined ? item.filter.dims : [];
  if (!Array.isArray(dims)) return unsupported('候选值查询的 filter.dims 必须是数组');
  for (const entry of dims) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return unsupported('候选值查询的级联约束格式无效');
    }
    const parentValues = stringArray(entry.dim_value_list);
    if (!parentValues) return unsupported(`级联约束 ${entry.dim_name} 必须是字符串数组`);
    if (parentValues.length === 0) continue;
    if (declaration.parent !== entry.dim_name) {
      return unsupported(`维度 ${name} 不接受来自 ${entry.dim_name} 的级联约束`);
    }
    const allowed = new Set(parentValues);
    values = values.filter((candidate) => allowed.has(candidate.of));
  }
  return success(
    item,
    values.map((candidate) => ({
      [name]: candidate.value,
      [`${name}__label`]: candidate.label ?? candidate.value
    })),
    [
      { id: `dqe-sim.${name}`, caption: name, data_type: 'STRING', type: 'dimension' },
      {
        id: `dqe-sim.${name}__label`,
        caption: `${name}显示名`,
        data_type: 'STRING',
        type: 'dimension'
      }
    ]
  );
}

/** 服务端排序：order.by 按 @order(type, priority) 语义，priority 小者先比。 */
function sortRows(rows, order) {
  if (!isRecord(order) || order.by === undefined) return { rows };
  if (!Array.isArray(order.by)) return { error: unsupported('order.by 必须是数组') };
  const rules = [];
  for (const entry of order.by) {
    if (!isRecord(entry) || typeof entry.field !== 'string') {
      return { error: unsupported('排序项格式无效') };
    }
    if (entry.type !== 'asc' && entry.type !== 'desc') {
      return { error: unsupported(`不支持的排序方向:${String(entry.type)}`) };
    }
    if (!Number.isInteger(entry.priority) || entry.priority < 1) {
      return { error: unsupported('排序优先级必须是正整数') };
    }
    rules.push({ field: entry.field, descending: entry.type === 'desc', priority: entry.priority });
  }
  rules.sort((left, right) => left.priority - right.priority);
  return {
    rows: [...rows].sort((left, right) => {
      for (const rule of rules) {
        const a = left[rule.field];
        const b = right[rule.field];
        const comparison =
          a === b
            ? 0
            : a === null || a === undefined
              ? -1
              : b === null || b === undefined
                ? 1
                : a < b
                  ? -1
                  : 1;
        if (comparison !== 0) return rule.descending ? -comparison : comparison;
      }
      return 0;
    })
  };
}

function columns(dimensions, metrics) {
  return [
    ...dimensions.map((caption) => ({
      id: `dqe-sim.${caption}`,
      caption,
      data_type: 'STRING',
      type: 'dimension'
    })),
    ...metrics.map((caption) => ({
      id: `dqe-sim.${caption}`,
      caption,
      data_type: 'NUMBER',
      type: 'metric'
    }))
  ];
}

function success(item, data, resultColumns) {
  const order = isRecord(item.order) ? item.order : {};
  const paginated = Number.isInteger(order.offset) && Number.isInteger(order.limit);
  const offset = paginated ? Number(order.offset) : 0;
  const limit = paginated ? Number(order.limit) : data.length;
  return {
    code: 'SUCCESS',
    data: data.slice(offset, offset + limit),
    total_count: data.length,
    dqe: {
      columns: resultColumns,
      orders: [],
      limit: paginated ? limit : -1,
      offset: paginated ? offset : -1,
      sql: null
    }
  };
}

function unsupported(retDesc) {
  return {
    code: 'DQE_SIM_UNSUPPORTED_QUERY',
    retDesc,
    data: [],
    total_count: 0,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null }
  };
}

function equalStrings(value, expected) {
  const actual = stringArray(value);
  return (
    actual !== undefined &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function stringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
