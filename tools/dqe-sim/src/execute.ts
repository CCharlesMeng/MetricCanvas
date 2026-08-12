import customerActivityRiskFixtureJson from '../fixtures/customer-activity-risk.json';
import customerActivityRiskTop100FixtureJson from '../fixtures/customer-activity-risk-top100.json';
import customerActivityInspectionFixtureJson from '../fixtures/customer-activity-inspection.json';
import flowAnalysisReportFixtureJson from '../fixtures/flow-analysis-report.json';
import salesAnalyticsFixture from '../fixtures/sales-analytics.json';
import { runSemanticSurface } from './semantic-surface-execute';

type JsonRecord = Record<string, unknown>;
type CustomerActivityKey = 'inspection' | 'visit' | 'summit' | 'inactive';

interface DqeTimeRange {
  period: string;
  is_aggregate?: boolean;
  start: string;
  end: string;
}

interface CustomerActivityRiskFixture {
  id: string;
  query: {
    output_metrics: unknown[];
    output_dims: string[];
    time: DqeTimeRange;
    dimensions: Record<string, string[]>;
  };
  rows: JsonRecord[];
}

interface CustomerActivityInspectionFixture {
  nonTopRows: JsonRecord[];
  top100Rows: JsonRecord[];
}

interface FlowAnalysisQueryFixture {
  output_dims: string[];
  output_metrics: string[];
  time: DqeTimeRange;
  filter?: {
    dims?: unknown[];
    metrics?: unknown[];
  };
  order?: JsonRecord;
  rows: JsonRecord[];
}

interface FlowAnalysisReportFixture {
  capturedAt: string;
  queries: Record<string, FlowAnalysisQueryFixture>;
}

export interface DqeSimItemResult {
  code: 'SUCCESS' | 'DQE_SIM_UNSUPPORTED_QUERY';
  data: JsonRecord[];
  total_count: number;
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
const customerActivityInspectionFixture =
  customerActivityInspectionFixtureJson as CustomerActivityInspectionFixture;
const flowAnalysisReportFixture =
  flowAnalysisReportFixtureJson as FlowAnalysisReportFixture;
const inspectionProgressMetrics = [
  'NA客户数',
  '无公司考察客户数',
  '未考察占比',
  '当年未公司考察客户数',
  '当年未考察占比'
];
const inspectionDetailDimensions = [
  '客户名称',
  '代表处',
  '客户责任人',
  '最近一次公司考察时间'
];
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
  const exactResult = executeExactScenarios(item);
  if (exactResult.code === 'SUCCESS' || !isRecord(item)) return exactResult;
  // 组合式语义面兜底分支:全部精确匹配分支之后才尝试,面外组合保留既有拒答。
  const surface = runSemanticSurface(item);
  if (surface.kind === 'out-of-surface') return exactResult;
  if (surface.kind === 'rejected') return unsupported(surface.reason);
  if (!validOrder(item.order)) {
    return unsupported('order 必须为 {} 或包含非负 offset/正整数 limit');
  }
  return successResult(item, surface.rows, {
    columns: surface.columns,
    orders: [],
    limit: -1,
    offset: -1,
    sql: null
  });
}

function executeExactScenarios(item: unknown): DqeSimItemResult {
  if (!isRecord(item)) return unsupported('查询项必须是 JSON 对象');
  const flowAnalysisResult = executeFlowAnalysisReport(item);
  if (flowAnalysisResult) return flowAnalysisResult;
  const fixture = customerActivityRiskFixtures.find(
    (candidate) =>
      equalJson(item.output_metrics, candidate.query.output_metrics) &&
      equalStrings(item.output_dims, candidate.query.output_dims)
  );
  if (!fixture) {
    return (
      executeInspectionRisk(item) ??
      executeCustomerActivityRisk(item) ??
      executeSalesAnalytics(item)
    );
  }
  if (!isRecord(item.filter)) return unsupported('缺少 filter 对象');
  if (!matchesTime(item.filter.time, fixture.query.time)) {
    return unsupported(`仅支持账期 ${fixture.query.time.start}`);
  }
  if (!equalJson(item.filter.metrics, [])) {
    return unsupported('仅支持 filter.metrics=[]');
  }
  if (!validOrder(item.order)) return unsupported('order 必须为 {} 或包含非负 offset/正整数 limit');
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

  return successResult(
    item,
    levels.map((level) => ({ ...rows.get(level)! })),
    metadata(fixture)
  );
}

function executeFlowAnalysisReport(
  item: JsonRecord
): DqeSimItemResult | undefined {
  const query = Object.values(flowAnalysisReportFixture.queries).find(
    (candidate) =>
      equalStrings(item.output_dims, candidate.output_dims) &&
      equalStrings(item.output_metrics, candidate.output_metrics)
  );
  if (!query) return undefined;
  if (!isRecord(item.filter)) {
    return unsupported('流水分析报告查询缺少 filter 对象');
  }
  const expectedMetrics =
    query.filter && !Object.hasOwn(query.filter, 'metrics')
      ? undefined
      : query.filter?.metrics ?? [];
  const expectedDims =
    query.filter && !Object.hasOwn(query.filter, 'dims')
      ? undefined
      : query.filter?.dims ?? [];
  if (!equalJson(item.filter.metrics, expectedMetrics)) {
    return unsupported('流水分析报告 filter.metrics 与已验证查询不一致');
  }
  if (!equalJson(item.filter.dims, expectedDims)) {
    return unsupported('流水分析报告 filter.dims 与已验证查询不一致');
  }
  if (!matchesTime(item.filter.time, query.time)) {
    return unsupported(
      `流水分析报告仅支持账期 ${query.time.start} 至 ${query.time.end}`
    );
  }
  if (query.order ? !equalJson(item.order, query.order) : !validOrder(item.order)) {
    return unsupported('order 必须为 {} 或包含非负 offset/正整数 limit');
  }
  return successResult(
    item,
    query.rows.map((row) => ({ ...row })),
    flowAnalysisMetadata(query)
  );
}

function flowAnalysisMetadata(
  query: FlowAnalysisQueryFixture
): DqeSimItemResult['dqe'] {
  return {
    columns: [
      ...query.output_dims.map((caption) => ({
        id: `dqe-sim.${caption}`,
        caption,
        data_type: 'STRING' as const,
        type: 'dimension' as const
      })),
      ...query.output_metrics.map((caption) => ({
        id: `dqe-sim.${caption}`,
        caption,
        data_type: query.rows.some((row) => typeof row[caption] === 'string')
          ? 'STRING' as const
          : 'NUMBER' as const,
        type: 'metric' as const
      }))
    ],
    orders: [],
    limit: -1,
    offset: -1,
    sql: null
  };
}

function executeInspectionRisk(item: JsonRecord): DqeSimItemResult | undefined {
  if (
    equalStrings(item.output_dims, ['代表处']) &&
    equalStrings(item.output_metrics, inspectionProgressMetrics)
  ) {
    return executeInspectionProgress(item);
  }
  if (
    equalStrings(item.output_dims, inspectionDetailDimensions) &&
    equalStrings(item.output_metrics, [])
  ) {
    return executeInspectionDetail(item);
  }
  return undefined;
}

function executeInspectionProgress(item: JsonRecord): DqeSimItemResult {
  if (!isRecord(item.filter) || !equalJson(item.filter.metrics, [])) {
    return unsupported('公司考察进展要求 filter.metrics=[]');
  }
  if (
    !matchesTime(item.filter.time, {
      period: 'month',
      is_aggregate: true,
      start: '2026-01-01',
      end: '2026-06-01'
    })
  ) {
    return unsupported('公司考察进展仅支持 2026-01-01 至 2026-06-01');
  }
  if (!Array.isArray(item.filter.dims) || !validOrder(item.order)) {
    return unsupported('公司考察进展筛选或排序格式无效');
  }
  const dimensions = item.filter.dims.filter(isRecord);
  if (dimensions.length !== 3 || dimensions.length !== item.filter.dims.length) {
    return unsupported('公司考察进展要求三个维度筛选');
  }
  if (!equalStrings(dimensionValues(dimensions, '地区部'), ['中国地区部'])) {
    return unsupported('公司考察进展仅支持中国地区部');
  }
  if (!equalStrings(dimensionValues(dimensions, '活动类型'), ['公司考察'])) {
    return unsupported('公司考察进展仅支持活动类型=公司考察');
  }
  const top100 = dimensionValues(dimensions, '是否TOP100项目客户');
  if (!top100 || top100.length !== 1 || !['是', '否'].includes(top100[0]!)) {
    return unsupported('是否TOP100项目客户必须为是或否');
  }
  const rows = top100[0] === '是'
    ? customerActivityInspectionFixture.top100Rows
    : customerActivityInspectionFixture.nonTopRows;
  return successResult(item, rows.map((row) => ({ ...row })), inspectionMetadata());
}

function executeInspectionDetail(item: JsonRecord): DqeSimItemResult {
  if (!isRecord(item.filter) || !equalJson(item.filter.metrics, [])) {
    return unsupported('公司考察明细要求 filter.metrics=[]');
  }
  if (
    !matchesTime(item.filter.time, {
      period: 'month',
      is_aggregate: true,
      start: '2026-07',
      end: '2026-07'
    })
  ) {
    return unsupported('公司考察明细仅支持账期 2026-07');
  }
  if (!Array.isArray(item.filter.dims) || !validOrder(item.order)) {
    return unsupported('公司考察明细筛选或排序格式无效');
  }
  const dimensions = item.filter.dims.filter(isRecord);
  if (dimensions.length !== 3 || dimensions.length !== item.filter.dims.length) {
    return unsupported('公司考察明细要求代表处、TOP100标记和截止日期');
  }
  const office = dimensionValues(dimensions, '代表处')?.[0];
  const top100 = dimensionValues(dimensions, '是否TOP100项目客户')?.[0];
  const cutoff = dimensionValues(dimensions, '最近一次公司考察时间')?.[0];
  const cutoffFilter = dimensions.find(
    (entry) => entry.dim_name === '最近一次公司考察时间'
  );
  if (!office || !['是', '否'].includes(top100 ?? '')) {
    return unsupported('公司考察明细的代表处和TOP100标记无效');
  }
  if (
    !cutoff ||
    !['2024-01-01', '2026-01-01'].includes(cutoff) ||
    cutoffFilter?.operator !== '<'
  ) {
    return unsupported('公司考察明细截止日期必须使用 < 运算符');
  }
  const progressRows = top100 === '是'
    ? customerActivityInspectionFixture.top100Rows
    : customerActivityInspectionFixture.nonTopRows;
  const progress = progressRows.find((row) => row.代表处 === office);
  const countField = cutoff === '2024-01-01'
    ? '无公司考察客户数'
    : '当年未公司考察客户数';
  const count = typeof progress?.[countField] === 'number'
    ? Number(progress[countField])
    : 0;
  const rows = Array.from({ length: count }, (_, index) => ({
    客户名称: `${office}客户${String(index + 1).padStart(3, '0')}`,
    代表处: office,
    客户责任人: `客户责任人${(index % 8) + 1} ${String(10900001 + index)}`,
    最近一次公司考察时间:
      index % 4 === 3
        ? null
        : cutoff === '2024-01-01'
          ? `2023-${String((index % 12) + 1).padStart(2, '0')}-01`
          : `2025-${String((index % 12) + 1).padStart(2, '0')}-01`
  }));
  return successResult(item, rows, inspectionDetailMetadata());
}

function inspectionMetadata(): DqeSimItemResult['dqe'] {
  return {
    columns: [
      {
        id: 'dqe-sim.代表处',
        caption: '代表处',
        data_type: 'STRING',
        type: 'dimension'
      },
      ...inspectionProgressMetrics.map((caption) => ({
        id: `dqe-sim.${caption}`,
        caption,
        data_type: caption.includes('占比') ? 'STRING' as const : 'NUMBER' as const,
        type: 'metric' as const
      }))
    ],
    orders: [],
    limit: -1,
    offset: -1,
    sql: null
  };
}

function inspectionDetailMetadata(): DqeSimItemResult['dqe'] {
  return {
    columns: inspectionDetailDimensions.map((caption) => ({
      id: `dqe-sim.${caption}`,
      caption,
      data_type: 'STRING' as const,
      type: 'dimension' as const
    })),
    orders: [],
    limit: -1,
    offset: -1,
    sql: null
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
  if (!validOrder(item.order)) {
    return { error: unsupported('order 必须为 {} 或包含非负 offset/正整数 limit') };
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
  return successResult(item, data, {
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
    });
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
  if (!validOrder(item.order)) {
    return unsupported('order 必须为 {} 或包含非负 offset/正整数 limit');
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
  return successResult(item, data, {
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
    });
}

function unsupported(retDesc: string): DqeSimItemResult {
  return {
    code: 'DQE_SIM_UNSUPPORTED_QUERY',
    retDesc,
    data: [],
    total_count: 0,
    dqe: emptyMetadata()
  };
}

function successResult(
  item: JsonRecord,
  data: JsonRecord[],
  dqe: DqeSimItemResult['dqe']
): DqeSimItemResult {
  const page = pageOrder(item.order, data.length);
  return {
    code: 'SUCCESS',
    data: data.slice(page.offset, page.offset + page.limit),
    total_count: data.length,
    dqe: {
      ...dqe,
      limit: page.paginated ? page.limit : -1,
      offset: page.paginated ? page.offset : -1
    }
  };
}

function validOrder(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).length === 0) return true;
  return (
    Number.isInteger(value.offset) &&
    Number(value.offset) >= 0 &&
    Number.isInteger(value.limit) &&
    Number(value.limit) > 0
  );
}

function pageOrder(
  value: unknown,
  rowCount: number
): { offset: number; limit: number; paginated: boolean } {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return { offset: 0, limit: rowCount, paginated: false };
  }
  return {
    offset: Number(value.offset),
    limit: Number(value.limit),
    paginated: true
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

function matchesTime(value: unknown, expected: DqeTimeRange) {
  return (
    isRecord(value) &&
    value.period === expected.period &&
    (expected.is_aggregate === undefined
      ? !Object.hasOwn(value, 'is_aggregate')
      : value.is_aggregate === expected.is_aggregate) &&
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
