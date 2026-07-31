import customerActivityRiskFixtureJson from '../fixtures/customer-activity-risk.json';
import customerActivityRiskTop100FixtureJson from '../fixtures/customer-activity-risk-top100.json';
import salesAnalyticsFixture from '../fixtures/sales-analytics.json';

type JsonRecord = Record<string, unknown>;
type CustomerActivityKey = 'inspection' | 'visit' | 'summit' | 'inactive';

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
const customerActivityKeys: CustomerActivityKey[] = [
  'inspection',
  'visit',
  'summit',
  'inactive'
];
const customerActivityOffices = Array.from(
  { length: 153 },
  (_, index) => `XX代表处${String(index + 1).padStart(2, '0')}`
);
const customerActivityLevels = ['卓越', '战略', '核心'];
const customerActivityDetailDimensions = [
  'representative-office',
  'customer-scope',
  'customer-name',
  'customer-level',
  'owner-name',
  'owner-id',
  'last-inspection',
  'last-visit',
  'last-summit'
];

export function executeDqeItem(item: unknown): DqeSimItemResult {
  if (!isRecord(item)) return unsupported('查询项必须是 JSON 对象');
  const fixture = customerActivityRiskFixtures.find(
    (candidate) =>
      equalJson(item.output_metrics, candidate.query.output_metrics) &&
      equalStrings(item.output_dims, candidate.query.output_dims)
  );
  if (!fixture) {
    return executeCustomerActivityRisk(item) ?? executeSalesAnalytics(item);
  }
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

function executeCustomerActivityRisk(
  item: JsonRecord
): DqeSimItemResult | undefined {
  const dimensions = stringArray(item.output_dims);
  const metrics = stringArray(item.output_metrics);
  if (!dimensions || !metrics) return undefined;

  const annualKey = customerActivityKeys.find(
    (key) =>
      key !== 'inactive' &&
      equalStrings(dimensions, []) &&
      equalStrings(metrics, [
        `${key}-annual-count`,
        `${key}-monthly-change`,
        `${key}-completion-rate`
      ])
  );
  if (annualKey) {
    const rejected = validateCustomerActivityEnvelope(item, []);
    if (rejected) return rejected;
    return customerActivitySuccess(item, [
      {
        [`${annualKey}-annual-count`]: 2000,
        [`${annualKey}-monthly-change`]: annualKey === 'summit' ? 888 : -888,
        [`${annualKey}-completion-rate`]: 98.2
      }
    ]);
  }

  const progressKey = customerActivityKeys.find(
    (key) =>
      equalStrings(dimensions, ['representative-office']) &&
      equalStrings(metrics, progressMetrics(key))
  );
  if (progressKey) {
    const rejected = validateCustomerActivityEnvelope(item, []);
    if (rejected) return rejected;
    return customerActivitySuccess(item, progressRows(progressKey));
  }

  const detailKey = customerActivityKeys.find(
    (key) =>
      equalStrings(dimensions, customerActivityDetailDimensions) &&
      equalStrings(metrics, [`${key}-detail-row`])
  );
  if (detailKey) {
    const filters = customerActivityFilters(item);
    if ('error' in filters) return filters.error;
    const office = filters.values['representative-office']?.[0] ?? customerActivityOffices[0]!;
    const scope = filters.values['customer-scope']?.[0] ?? 'NA';
    return customerActivitySuccess(
      item,
      detailRows(detailKey, metrics[0]!, office, scope)
    );
  }

  const topKey = customerActivityKeys.find((key) =>
    equalStrings(dimensions, customerActivityDetailDimensions) &&
    (equalStrings(metrics, [`${key}-na-top-row`]) ||
      equalStrings(metrics, [`${key}-project-top-row`]))
  );
  if (topKey) {
    const rejected = validateCustomerActivityEnvelope(item, []);
    if (rejected) return rejected;
    const project = metrics[0]!.endsWith('-project-top-row');
    return customerActivitySuccess(
      item,
      detailRows(
        topKey,
        metrics[0]!,
        project ? customerActivityOffices[2]! : customerActivityOffices[1]!,
        project ? 'TOP100' : 'NA'
      ).slice(0, 10)
    );
  }

  return undefined;
}

function progressMetrics(key: CustomerActivityKey): string[] {
  return [
    `${key}-na-total`,
    `${key}-na-missing`,
    `${key}-na-missing-rate`,
    `${key}-na-year-missing`,
    `${key}-na-year-missing-rate`,
    `${key}-top-total`,
    `${key}-top-missing`,
    `${key}-top-missing-rate`,
    `${key}-top-year-missing`,
    `${key}-top-year-missing-rate`
  ];
}

function progressRows(key: CustomerActivityKey): JsonRecord[] {
  const activityOffset = customerActivityKeys.indexOf(key) * 7;
  return customerActivityOffices.map((office, index) => {
    const naTotal = 1320 + ((index * 37 + activityOffset) % 780);
    const naMissing = 180 + ((index * 29 + activityOffset) % 540);
    const naYearMissing = 90 + ((index * 17 + activityOffset) % 320);
    const topTotal = 640 + ((index * 23 + activityOffset) % 480);
    const topMissing = 80 + ((index * 19 + activityOffset) % 260);
    const topYearMissing = 40 + ((index * 13 + activityOffset) % 180);
    return {
      'representative-office': office,
      [`${key}-na-total`]: naTotal,
      [`${key}-na-missing`]: naMissing,
      [`${key}-na-missing-rate`]: Number(((naMissing / naTotal) * 100).toFixed(1)),
      [`${key}-na-year-missing`]: naYearMissing,
      [`${key}-na-year-missing-rate`]: Number(
        ((naYearMissing / naTotal) * 100).toFixed(1)
      ),
      [`${key}-top-total`]: topTotal,
      [`${key}-top-missing`]: topMissing,
      [`${key}-top-missing-rate`]: Number(((topMissing / topTotal) * 100).toFixed(1)),
      [`${key}-top-year-missing`]: topYearMissing,
      [`${key}-top-year-missing-rate`]: Number(
        ((topYearMissing / topTotal) * 100).toFixed(1)
      )
    };
  });
}

function detailRows(
  key: CustomerActivityKey,
  metric: string,
  office: string,
  scope: string
): JsonRecord[] {
  return Array.from({ length: 153 }, (_, index) => {
    const sequence = index + 1;
    return {
      [metric]: sequence,
      'customer-name': `XX客户名称${String(sequence).padStart(3, '0')}`,
      'customer-level': customerActivityLevels[index % customerActivityLevels.length]!,
      'representative-office': office,
      'customer-scope': scope,
      'owner-name': '李四',
      'owner-id': `00${String(123456 + (index % 20)).padStart(6, '0')}`,
      'last-inspection':
        key === 'inspection' && sequence % 5 === 0 ? '无考察' : 'XXXX',
      'last-visit': 'XXXX',
      'last-summit': 'XXXX'
    };
  });
}

function customerActivityFilters(
  item: JsonRecord
):
  | { values: Record<string, string[]> }
  | { error: DqeSimItemResult } {
  if (!isRecord(item.filter) || !equalJson(item.filter.metrics, [])) {
    return { error: unsupported('仅支持 filter.metrics=[]') };
  }
  if (!equalJson(item.order, {})) {
    return { error: unsupported('仅支持 order={}') };
  }
  if (!Array.isArray(item.filter.dims)) {
    return { error: unsupported('filter.dims 必须是数组') };
  }
  const values: Record<string, string[]> = {};
  for (const entry of item.filter.dims) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return { error: unsupported('维度筛选格式无效') };
    }
    if (
      entry.dim_name !== 'representative-office' &&
      entry.dim_name !== 'customer-scope'
    ) {
      return { error: unsupported(`不支持的维度筛选:${entry.dim_name}`) };
    }
    const dimensionValues = stringArray(entry.dim_value_list);
    if (!dimensionValues || dimensionValues.length === 0) {
      return {
        error: unsupported(`维度筛选 ${entry.dim_name} 必须是非空字符串数组`)
      };
    }
    values[entry.dim_name] = dimensionValues;
  }
  return { values };
}

function validateCustomerActivityEnvelope(
  item: JsonRecord,
  expectedDimensions: string[]
): DqeSimItemResult | undefined {
  const filters = customerActivityFilters(item);
  if ('error' in filters) return filters.error;
  return equalStrings(Object.keys(filters.values), expectedDimensions)
    ? undefined
    : unsupported(`仅支持维度筛选 ${JSON.stringify(expectedDimensions)}`);
}

function customerActivitySuccess(
  item: JsonRecord,
  data: JsonRecord[]
): DqeSimItemResult {
  const dimensions = stringArray(item.output_dims) ?? [];
  const metrics = stringArray(item.output_metrics) ?? [];
  return {
    code: 'SUCCESS',
    data,
    dqe: {
      columns: [
        ...dimensions.map((caption) => ({
          id: `dqe-sim.${caption}`,
          caption,
          data_type: 'STRING' as const,
          type: 'dimension' as const
        })),
        ...metrics.map((caption) => ({
          id: `dqe-sim.${caption}`,
          caption,
          data_type: 'NUMBER' as const,
          type: 'metric' as const
        }))
      ],
      orders: [],
      limit: -1,
      offset: -1,
      sql: null
    }
  };
}

function executeSalesAnalytics(item: JsonRecord): DqeSimItemResult {
  const dimensions = stringArray(item.output_dims);
  const rawMetrics = Array.isArray(item.output_metrics) ? item.output_metrics : undefined;
  const metrics = rawMetrics?.flatMap((metric) => {
    const name = outputMetricName(metric);
    return name ? [name] : [];
  });
  const supportedDimensions = new Set(['mtime', 'region', 'channel', 'city']);
  const supportedMetrics = new Set(['gmv', 'order-count']);
  if (
    !dimensions ||
    !metrics ||
    rawMetrics?.length !== metrics.length ||
    dimensions.some((field) => !supportedDimensions.has(field)) ||
    metrics.some((field) => !supportedMetrics.has(field))
  ) {
    return unsupported('不支持的 output_metrics/output_dims 组合');
  }
  if (!isRecord(item.filter) || !Array.isArray(item.filter.dims)) {
    return unsupported('filter.dims 必须是数组');
  }
  let rows = salesAnalyticsFixture.rows as JsonRecord[];
  for (const entry of item.filter.dims) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return unsupported('维度筛选格式无效');
    }
    const dimensionName = entry.dim_name;
    const values = stringArray(entry.dim_value_list);
    if (!values) return unsupported(`维度筛选 ${dimensionName} 必须是字符串数组`);
    rows = rows.filter((row) => values.includes(String(row[dimensionName] ?? '')));
  }
  if (isRecord(item.filter.time)) {
    const start = typeof item.filter.time.start === 'string' ? item.filter.time.start : '';
    const end = typeof item.filter.time.end === 'string' ? item.filter.time.end : '';
    rows = rows.filter((row) => {
      const value = String(row.mtime ?? '');
      return (!start || value >= start) && (!end || value <= end);
    });
  }

  const grouped = new Map<string, JsonRecord>();
  for (const row of rows) {
    const key = JSON.stringify(dimensions.map((field) => row[field]));
    const target =
      grouped.get(key) ??
      Object.fromEntries(dimensions.map((field) => [field, row[field]]));
    for (const metric of metrics) {
      target[metric] = Number(target[metric] ?? 0) + Number(row[metric] ?? 0);
    }
    grouped.set(key, target);
  }
  const data = [...grouped.values()];
  return {
    code: 'SUCCESS',
    data,
    dqe: {
      columns: [
        ...dimensions.map((caption) => ({
          id: `dqe-sim.${caption}`,
          caption,
          data_type: 'STRING' as const,
          type: 'dimension' as const
        })),
        ...metrics.map((caption) => ({
          id: `dqe-sim.${caption}`,
          caption,
          data_type: 'NUMBER' as const,
          type: 'metric' as const
        }))
      ],
      orders: [],
      limit: -1,
      offset: -1,
      sql: null
    }
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
