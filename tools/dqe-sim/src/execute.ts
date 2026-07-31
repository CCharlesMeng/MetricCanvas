import customerActivityRiskFixtureJson from '../fixtures/customer-activity-risk.json';
import customerActivityRiskTop100FixtureJson from '../fixtures/customer-activity-risk-top100.json';

type JsonRecord = Record<string, unknown>;

interface CustomerActivityRiskFixture {
  id: string;
  query: {
    output_metrics: unknown[];
    output_dims: string[];
    time: {
      period: string;
      is_aggregate: boolean;
      start: string;
      end: string;
    };
    dimensions: Record<string, string[]>;
  };
  rows: JsonRecord[];
}

export interface DqeSimItemResult {
  code: 'SUCCESS' | 'DQE_SIM_UNSUPPORTED_QUERY';
  data: JsonRecord[];
  retDesc?: string;
  dqe: {
    columns: Array<{
      id: string;
      caption: string;
      data_type: 'STRING' | 'NUMBER';
      type: 'dimension' | 'metric';
    }>;
    orders: unknown[];
    limit: number;
    offset: number;
    sql: null;
  };
}

const customerActivityRiskFixtures = [
  customerActivityRiskFixtureJson,
  customerActivityRiskTop100FixtureJson
] as CustomerActivityRiskFixture[];

export function executeDqeItem(item: unknown): DqeSimItemResult {
  if (!isRecord(item)) return unsupported('查询项必须是 JSON 对象');
  const fixture = customerActivityRiskFixtures.find(
    (candidate) =>
      equalJson(item.output_metrics, candidate.query.output_metrics) &&
      equalStrings(item.output_dims, candidate.query.output_dims)
  );
  if (!fixture) return unsupported('不支持的 output_metrics/output_dims 组合');
  if (!isRecord(item.filter)) return unsupported('缺少 filter 对象');
  if (!matchesTime(item.filter.time, fixture.query.time)) {
    return unsupported(`仅支持账期 ${fixture.query.time.start}`);
  }
  if (!equalJson(item.filter.metrics, [])) {
    return unsupported('仅支持 filter.metrics=[]');
  }
  if (!equalJson(item.order, {})) return unsupported('仅支持 order={}');
  if (!Array.isArray(item.filter.dims)) return unsupported('filter.dims 必须是数组');
  const dimensions = item.filter.dims.filter(isRecord);
  const expectedDimensionCount = Object.keys(fixture.query.dimensions).length + 1;
  if (
    dimensions.length !== item.filter.dims.length ||
    dimensions.length !== expectedDimensionCount
  ) {
    return unsupported(`仅支持场景定义的 ${expectedDimensionCount} 个维度筛选`);
  }

  for (const [name, expected] of Object.entries(fixture.query.dimensions)) {
    const values = dimensionValues(dimensions, name);
    if (!equalStrings(values, expected)) {
      return unsupported(`仅支持 ${name}=${JSON.stringify(expected)}`);
    }
  }

  const levels = dimensionValues(dimensions, '客户级别');
  if (!levels || levels.length === 0) {
    return unsupported('客户级别至少包含一个值');
  }
  const rows = new Map(
    fixture.rows
      .filter((row) => typeof row.客户级别 === 'string')
      .map((row) => [row.客户级别 as string, row])
  );
  const unknown = levels.find((level) => !rows.has(level));
  if (unknown) return unsupported(`不支持的客户级别:${unknown}`);

  return {
    code: 'SUCCESS',
    data: levels.map((level) => ({ ...rows.get(level)! })),
    dqe: metadata(fixture)
  };
}

function unsupported(retDesc: string): DqeSimItemResult {
  return {
    code: 'DQE_SIM_UNSUPPORTED_QUERY',
    retDesc,
    data: [],
    dqe: emptyMetadata()
  };
}

function metadata(fixture: CustomerActivityRiskFixture): DqeSimItemResult['dqe'] {
  return {
    columns: [
      ...fixture.query.output_dims.map((caption) => ({
        id: `dqe-sim.${caption}`,
        caption,
        data_type: 'STRING' as const,
        type: 'dimension' as const
      })),
      ...fixture.query.output_metrics.flatMap((metric) => {
        const caption = outputMetricName(metric);
        return caption === undefined
          ? []
          : [
              {
                id: `dqe-sim.${caption}`,
                caption,
                data_type: 'NUMBER' as const,
                type: 'metric' as const
              }
            ];
      })
    ],
    orders: [],
    limit: -1,
    offset: -1,
    sql: null
  };
}

function emptyMetadata(): DqeSimItemResult['dqe'] {
  return { columns: [], orders: [], limit: -1, offset: -1, sql: null };
}

function outputMetricName(metric: unknown): string | undefined {
  if (typeof metric === 'string') return metric;
  return isRecord(metric) && typeof metric.alias === 'string' ? metric.alias : undefined;
}

function matchesTime(value: unknown, expected: CustomerActivityRiskFixture['query']['time']) {
  return (
    isRecord(value) &&
    value.period === expected.period &&
    value.is_aggregate === expected.is_aggregate &&
    value.start === expected.start &&
    value.end === expected.end
  );
}

function dimensionValues(dimensions: JsonRecord[], name: string): string[] | undefined {
  const dimension = dimensions.find((entry) => entry.dim_name === name);
  return dimension ? stringArray(dimension.dim_value_list) : undefined;
}

function equalStrings(value: unknown, expected: string[]): boolean {
  const actual = stringArray(value);
  return (
    actual !== undefined &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function equalJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => equalJson(entry, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.hasOwn(right, key) && equalJson(left[key], right[key])
      )
    );
  }
  return false;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
