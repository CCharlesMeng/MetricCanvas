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

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../../tools/dqe-sim/fixtures/ioc-opportunity-list.json'),
    'utf8'
  )
);

export function executeFixtureItem(item) {
  if (!isRecord(item)) return unsupported('查询项必须是 JSON 对象');
  return listResult(item) ?? candidatesResult(item) ?? unsupported('夹具未覆盖的查询');
}

function listResult(item) {
  if (
    !equalStrings(item.output_dims, fixture.output_dims) ||
    !equalStrings(item.output_metrics, fixture.output_metrics)
  ) {
    return undefined;
  }
  if (!isRecord(item.filter) || !Array.isArray(item.filter.dims)) {
    return unsupported('机会点清单缺少 filter.dims');
  }
  const filterable = new Set(fixture.filterableDims);
  let rows = fixture.rows;
  for (const entry of item.filter.dims) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return unsupported('维度筛选格式无效');
    }
    if (!filterable.has(entry.dim_name)) {
      return unsupported(`机会点清单不支持的维度筛选:${entry.dim_name}`);
    }
    const values = stringArray(entry.dim_value_list);
    if (!values) return unsupported(`维度筛选 ${entry.dim_name} 必须是字符串数组`);
    if (values.length === 0) continue;
    rows = rows.filter((row) => values.includes(String(row[entry.dim_name] ?? '')));
  }
  const outputs = [...fixture.output_dims, ...fixture.output_metrics];
  return success(
    item,
    rows.map((row) => Object.fromEntries(outputs.map((field) => [field, row[field] ?? null]))),
    columns(fixture.output_dims, fixture.output_metrics)
  );
}

/** 候选值查询：恰好一个输出维度、不取指标；取值域从夹具行去重得到。 */
function candidatesResult(item) {
  const dimensions = stringArray(item.output_dims);
  const metrics = stringArray(item.output_metrics);
  if (!dimensions || dimensions.length !== 1 || !metrics || metrics.length !== 0) {
    return undefined;
  }
  const name = dimensions[0];
  if (!fixture.filterableDims.includes(name)) return undefined;
  const values = [...new Set(fixture.rows.map((row) => String(row[name] ?? '')))].filter(Boolean);
  return success(
    item,
    values.map((value) => ({ [name]: value, [`${name}__label`]: value })),
    columns([name, `${name}__label`], [])
  );
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
