/**
 * 组合式语义面 → Schema 元数据(formatVersion 1.1)的同面投影。
 *
 * docs/examples/schema-metadata.example.json 中两个业务域 schema 的字段与
 * 指标条目必须与本投影逐项一致,由同面守卫测试比对。字段结构仍是封闭的
 * (未定义属性被拒绝),因此维度取值域与时间粒度能力继续以受控句式写入
 * description;可加性与时间聚合方式自 1.1 起是指标条目上的结构化字段,
 * 不再拼进散文(ADR-0044)。
 */
import type {
  Additivity,
  BusinessDomain,
  SurfaceDimension,
  SurfaceMetric,
  TimeAggregation
} from './semantic-surface';

export interface MetadataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  description: string;
  aliases?: string[];
  roleHints: Array<'dimension' | 'time'>;
  unit?: string;
  granularity?: string;
  nullable: boolean;
  sensitive: boolean;
}

export interface MetadataMetricEntry {
  name: string;
  type: 'number';
  description: string;
  aliases?: string[];
  unit?: string;
  additivity: Additivity;
  timeAggregation: TimeAggregation;
  isRatio: boolean;
  dimensions: string[];
  nullable: boolean;
  sensitive: boolean;
}

/** 业务域在 Schema 元数据中应声明的字段清单(维度与时间维度)。 */
export function projectDomainFields(domain: BusinessDomain): MetadataField[] {
  return [
    ...domain.dimensions.map(projectDimensionField),
    projectTimeDimensionField(domain)
  ];
}

/** 业务域在 Schema 元数据中应声明的指标条目清单。 */
export function projectDomainMetrics(
  domain: BusinessDomain
): MetadataMetricEntry[] {
  const dimensions = [
    ...domain.dimensions.map((dimension) => dimension.name),
    domain.timeDimension.name
  ];
  return domain.metrics.map((metric) => projectMetricEntry(metric, dimensions));
}

function projectDimensionField(dimension: SurfaceDimension): MetadataField {
  return {
    name: dimension.name,
    type: 'string',
    description: `${dimension.description}。取值域:${dimension.values.join('、')}。`,
    ...aliasesOf(dimension.aliases),
    roleHints: ['dimension'],
    nullable: false,
    sensitive: false
  };
}

function projectTimeDimensionField(domain: BusinessDomain): MetadataField {
  return {
    name: domain.timeDimension.name,
    type: 'date',
    description: `${domain.timeDimension.description}。支持的时间粒度:${domain.granularities.join('、')}。`,
    ...aliasesOf(domain.timeDimension.aliases),
    roleHints: ['dimension', 'time'],
    granularity: domain.granularities.join(','),
    nullable: false,
    sensitive: false
  };
}

function projectMetricEntry(
  metric: SurfaceMetric,
  dimensions: string[]
): MetadataMetricEntry {
  return {
    name: metric.name,
    type: 'number',
    description: metric.description,
    ...aliasesOf(metric.aliases),
    unit: metric.unit,
    additivity: metric.additivity,
    timeAggregation: metric.timeAggregation,
    isRatio: metric.isRatio,
    dimensions,
    nullable: false,
    sensitive: false
  };
}

function aliasesOf(aliases: string[]): { aliases?: string[] } {
  return aliases.length > 0 ? { aliases } : {};
}
