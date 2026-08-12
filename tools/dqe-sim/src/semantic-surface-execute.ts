/**
 * 组合式语义面的确定性合成引擎。
 *
 * 合法组合按维度分组、按指标确定性合成数值:数值种子取自
 * 「业务域 + 指标 + 完整维度坐标 + 时间桶」这一查询体语义投影的稳定哈希,
 * 不使用随机数与系统时间,因此同一查询体多次执行逐字节一致,
 * 且同域相关查询之间保持聚合一致(分组求和等于总计)。
 *
 * 面外组合一律拒答,不编造行:
 * - 查询未引用任何语义面指标 → out-of-surface,由调用方保留既有拒答;
 * - 查询引用了语义面指标但组合非法 → rejected,携带明确原因。
 */
import type { DqeSimItemResult } from './execute';
import {
  findDimension,
  findMetric,
  semanticSurface,
  type BusinessDomain,
  type SurfaceDimension,
  type SurfaceMetric,
  type TimeGranularity
} from './semantic-surface';

type JsonRecord = Record<string, unknown>;

export type SemanticSurfaceOutcome =
  | { kind: 'out-of-surface' }
  | { kind: 'rejected'; reason: string }
  | {
      kind: 'rows';
      rows: JsonRecord[];
      columns: DqeSimItemResult['dqe']['columns'];
    };

/** 单次查询最多展开的时间桶数,防止把仿真当成无限数据源。 */
const MAX_TIME_BUCKETS = 400;
/** 单次查询最多合成的输出行数。 */
const MAX_OUTPUT_ROWS = 10000;
const CELL_SEPARATOR = '\u241F';

interface DimensionFilter {
  name: string;
  values: string[];
}

type OutputAxis =
  | { kind: 'dimension'; dimension: SurfaceDimension }
  | { kind: 'time' };

export function runSemanticSurface(item: JsonRecord): SemanticSurfaceOutcome {
  const metricNames = stringArray(item.output_metrics);
  if (!metricNames || metricNames.length === 0) {
    return { kind: 'out-of-surface' };
  }
  const touchesSurface = metricNames.some((name) =>
    semanticSurface.some((domain) => findMetric(domain, name))
  );
  if (!touchesSurface) return { kind: 'out-of-surface' };

  if (new Set(metricNames).size !== metricNames.length) {
    return rejected('语义面查询不支持重复的指标名');
  }
  const outputDimNames = stringArray(item.output_dims ?? []);
  if (!outputDimNames) {
    return rejected('语义面查询的 output_dims 必须是字符串数组');
  }
  if (new Set(outputDimNames).size !== outputDimNames.length) {
    return rejected('语义面查询不支持重复的输出维度');
  }

  if (!isRecord(item.filter)) {
    return rejected('语义面查询必须携带 filter 对象与 filter.time');
  }
  if (
    Object.hasOwn(item.filter, 'metrics') &&
    !(Array.isArray(item.filter.metrics) && item.filter.metrics.length === 0)
  ) {
    return rejected('语义面仅支持 filter.metrics 为空数组');
  }
  const filters = parseDimensionFilters(item.filter.dims);
  if ('reason' in filters) return rejected(filters.reason);

  const resolution = resolveDomain(metricNames, outputDimNames, filters.entries);
  if ('reason' in resolution) return rejected(resolution.reason);
  const domain = resolution.domain;
  const metrics = metricNames.map((name) => findMetric(domain, name)!);

  const buckets = parseTimeBuckets(domain, item.filter.time);
  if ('reason' in buckets) return rejected(buckets.reason);

  const allowed = applyFilters(domain, filters.entries);
  if ('reason' in allowed) return rejected(allowed.reason);

  const axes = outputDimNames.map<OutputAxis>((name) =>
    name === domain.timeDimension.name
      ? { kind: 'time' }
      : { kind: 'dimension', dimension: findDimension(domain, name)! }
  );

  const columns: DqeSimItemResult['dqe']['columns'] = [
    ...outputDimNames.map((caption) => ({
      id: `dqe-sim.${caption}`,
      caption,
      data_type: 'STRING' as const,
      type: 'dimension' as const
    })),
    ...metrics.map((metric) => ({
      id: `dqe-sim.${metric.name}`,
      caption: metric.name,
      data_type: 'NUMBER' as const,
      type: 'metric' as const
    }))
  ];

  const hasEmptyDimension = domain.dimensions.some(
    (dimension) => allowed.values.get(dimension.name)!.length === 0
  );
  if (hasEmptyDimension) return { kind: 'rows', rows: [], columns };

  const axisValues = axes.map((axis) =>
    axis.kind === 'time'
      ? buckets.labels
      : allowed.values.get(axis.dimension.name)!
  );
  const rowCount = axisValues.reduce((total, values) => total * values.length, 1);
  if (rowCount > MAX_OUTPUT_ROWS) {
    return rejected(`输出行数超过语义面上限 ${MAX_OUTPUT_ROWS}`);
  }

  const rows: JsonRecord[] = [];
  for (const selection of cartesian(axisValues)) {
    const groupAssignment = new Map<string, string>();
    let groupBucket: string | undefined;
    const row: JsonRecord = {};
    axes.forEach((axis, index) => {
      const value = selection[index]!;
      if (axis.kind === 'time') {
        groupBucket = value;
        row[domain.timeDimension.name] = value;
      } else {
        groupAssignment.set(axis.dimension.name, value);
        row[axis.dimension.name] = value;
      }
    });
    const coordinates = enumerateCoordinates(domain, allowed.values, groupAssignment);
    for (const metric of metrics) {
      row[metric.name] = aggregateMetric(
        domain,
        metric,
        coordinates,
        buckets.labels,
        groupBucket
      );
    }
    rows.push(row);
  }
  return { kind: 'rows', rows, columns };
}

function rejected(reason: string): SemanticSurfaceOutcome {
  return { kind: 'rejected', reason };
}

function parseDimensionFilters(
  value: unknown
): { entries: DimensionFilter[] } | { reason: string } {
  if (value === undefined) return { entries: [] };
  if (!Array.isArray(value)) {
    return { reason: '语义面查询的 filter.dims 必须是数组' };
  }
  const entries: DimensionFilter[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.dim_name !== 'string') {
      return { reason: '语义面维度筛选必须包含字符串 dim_name' };
    }
    if (Object.hasOwn(entry, 'operator')) {
      return {
        reason: `语义面维度筛选仅支持取值枚举,不支持 operator(维度「${entry.dim_name}」)`
      };
    }
    const values = stringArray(entry.dim_value_list);
    if (!values || values.length === 0) {
      return {
        reason: `语义面维度筛选「${entry.dim_name}」的 dim_value_list 必须是非空字符串数组`
      };
    }
    entries.push({ name: entry.dim_name, values });
  }
  return { entries };
}

function resolveDomain(
  metricNames: string[],
  outputDimNames: string[],
  filters: DimensionFilter[]
): { domain: BusinessDomain } | { reason: string } {
  const candidates = semanticSurface.filter(
    (domain) =>
      metricNames.every((name) => findMetric(domain, name)) &&
      outputDimNames.every(
        (name) =>
          name === domain.timeDimension.name || findDimension(domain, name)
      ) &&
      filters.every((filter) => findDimension(domain, filter.name))
  );
  if (candidates.length === 1) return { domain: candidates[0]! };
  if (candidates.length > 1) {
    return {
      reason: `组合同时命中多个业务域(${candidates
        .map((domain) => domain.name)
        .join('、')}),请用维度或筛选消歧`
    };
  }
  const notes = [
    ...metricNames.map((name) => describeName('指标', name)),
    ...outputDimNames.map((name) => describeName('维度', name)),
    ...filters.map((filter) => describeName('筛选维度', filter.name))
  ];
  return {
    reason: `语义面内没有业务域同时支持该组合:${notes.join(';')}`
  };
}

function describeName(kind: string, name: string): string {
  const metricDomains = semanticSurface
    .filter((domain) => findMetric(domain, name))
    .map((domain) => domain.name);
  const dimensionDomains = semanticSurface
    .filter((domain) => findDimension(domain, name))
    .map((domain) => domain.name);
  const isTimeDimension = semanticSurface.some(
    (domain) => domain.timeDimension.name === name
  );
  if (kind === '指标' && metricDomains.length > 0) {
    return `指标「${name}」属于[${metricDomains.join('、')}]`;
  }
  if (kind !== '指标' && dimensionDomains.length > 0) {
    return `${kind}「${name}」属于[${dimensionDomains.join('、')}]`;
  }
  if (kind === '筛选维度' && isTimeDimension) {
    return `「${name}」是时间维度,时间范围请使用 filter.time`;
  }
  if (kind === '维度' && isTimeDimension) {
    return `时间维度「${name}」可用`;
  }
  return `「${name}」不在语义面内`;
}

function parseTimeBuckets(
  domain: BusinessDomain,
  time: unknown
): { labels: string[] } | { reason: string } {
  if (
    !isRecord(time) ||
    typeof time.period !== 'string' ||
    typeof time.start !== 'string' ||
    typeof time.end !== 'string'
  ) {
    return { reason: '语义面查询必须携带 filter.time(period/start/end)' };
  }
  const period = time.period as TimeGranularity;
  if (!domain.granularities.includes(period)) {
    return {
      reason: `业务域「${domain.name}」支持的时间粒度:${domain.granularities.join('、')},不支持 ${time.period}`
    };
  }
  const labels =
    period === 'month'
      ? monthBuckets(time.start, time.end)
      : dayBuckets(time.start, time.end);
  if ('reason' in labels) return labels;
  if (labels.labels.length > MAX_TIME_BUCKETS) {
    return { reason: `时间范围超过语义面上限 ${MAX_TIME_BUCKETS} 个时间桶` };
  }
  return labels;
}

function monthBuckets(
  start: string,
  end: string
): { labels: string[] } | { reason: string } {
  const startIndex = monthIndex(start);
  const endIndex = monthIndex(end);
  if (startIndex === undefined || endIndex === undefined) {
    return { reason: '月粒度时间必须是 YYYY-MM 或 YYYY-MM-DD' };
  }
  if (endIndex < startIndex) return { reason: 'filter.time 的 start 不能晚于 end' };
  return {
    labels: Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
      const index = startIndex + offset;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    })
  };
}

function monthIndex(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value);
  if (!match) return undefined;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return undefined;
  return Number(match[1]) * 12 + month - 1;
}

function dayBuckets(
  start: string,
  end: string
): { labels: string[] } | { reason: string } {
  const startTime = dayTime(start);
  const endTime = dayTime(end);
  if (startTime === undefined || endTime === undefined) {
    return { reason: '日粒度时间必须是有效的 YYYY-MM-DD' };
  }
  if (endTime < startTime) return { reason: 'filter.time 的 start 不能晚于 end' };
  const dayMs = 24 * 60 * 60 * 1000;
  const count = Math.round((endTime - startTime) / dayMs) + 1;
  if (count > MAX_TIME_BUCKETS) {
    return { reason: `时间范围超过语义面上限 ${MAX_TIME_BUCKETS} 个时间桶` };
  }
  return {
    labels: Array.from({ length: count }, (_, offset) =>
      new Date(startTime + offset * dayMs).toISOString().slice(0, 10)
    )
  };
}

function dayTime(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10) === value ? time : undefined;
}

function applyFilters(
  domain: BusinessDomain,
  filters: DimensionFilter[]
): { values: Map<string, string[]> } | { reason: string } {
  const values = new Map<string, string[]>(
    domain.dimensions.map((dimension) => [dimension.name, dimension.values])
  );
  for (const filter of filters) {
    const dimension = findDimension(domain, filter.name)!;
    const outside = filter.values.filter(
      (value) => !dimension.values.includes(value)
    );
    if (outside.length > 0) {
      return {
        reason: `维度「${dimension.name}」存在取值域外取值:${outside.join('、')}`
      };
    }
    const current = values.get(dimension.name)!;
    values.set(
      dimension.name,
      current.filter((value) => filter.values.includes(value))
    );
  }
  return { values };
}

/** 组内单元格集合:输出维度取组值,其余维度按筛选后的取值域展开。 */
function enumerateCoordinates(
  domain: BusinessDomain,
  allowed: Map<string, string[]>,
  groupAssignment: Map<string, string>
): Array<Map<string, string>> {
  const axisValues = domain.dimensions.map((dimension) => {
    const bound = groupAssignment.get(dimension.name);
    return bound === undefined ? allowed.get(dimension.name)! : [bound];
  });
  return cartesian(axisValues).map((selection) => {
    const coordinate = new Map<string, string>();
    domain.dimensions.forEach((dimension, index) => {
      coordinate.set(dimension.name, selection[index]!);
    });
    return coordinate;
  });
}

function aggregateMetric(
  domain: BusinessDomain,
  metric: SurfaceMetric,
  coordinates: Array<Map<string, string>>,
  buckets: string[],
  groupBucket: string | undefined
): number {
  const perCoordinate = coordinates.map((coordinate) => {
    if (groupBucket !== undefined) {
      return cellValueScaled(domain, metric, coordinate, groupBucket);
    }
    const series = buckets.map((bucket) =>
      cellValueScaled(domain, metric, coordinate, bucket)
    );
    switch (metric.timeAggregation) {
      case '求和':
        return sum(series);
      case '均值':
        return Math.round(sum(series) / series.length);
      case '期末值':
        return series[series.length - 1]!;
    }
  });
  const scaled =
    metric.additivity === '不可加'
      ? Math.round(sum(perCoordinate) / perCoordinate.length)
      : sum(perCoordinate);
  return scaled / 10 ** metric.valueRange.decimals;
}

/**
 * 单元格数值:对「域+指标+完整维度坐标+时间桶」的稳定哈希取模映射到
 * 指标取值区间。以 10^decimals 缩放为整数域运算,保证聚合无浮点误差。
 */
function cellValueScaled(
  domain: BusinessDomain,
  metric: SurfaceMetric,
  coordinate: Map<string, string>,
  bucket: string
): number {
  const parts = [domain.name, metric.name];
  for (const dimension of domain.dimensions) {
    parts.push(`${dimension.name}=${coordinate.get(dimension.name)!}`);
  }
  parts.push(`${domain.timeDimension.name}=${bucket}`);
  const hash = fnv1a(parts.join(CELL_SEPARATOR));
  const scale = 10 ** metric.valueRange.decimals;
  const min = Math.round(metric.valueRange.min * scale);
  const max = Math.round(metric.valueRange.max * scale);
  return min + (hash % (max - min + 1));
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function cartesian(axes: string[][]): string[][] {
  return axes.reduce<string[][]>(
    (combinations, axis) =>
      combinations.flatMap((combination) =>
        axis.map((value) => [...combination, value])
      ),
    [[]]
  );
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
