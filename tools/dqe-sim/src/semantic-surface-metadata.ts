/**
 * 组合式语义面 → Schema 元数据(formatVersion 1.0)的同面投影。
 *
 * docs/examples/schema-metadata.example.json 中两个业务域 schema 的字段
 * 必须与本投影逐字段一致,由同面守卫测试比对。Schema 元数据 1.0 的字段
 * 结构是封闭的(未定义属性被拒绝),因此维度取值域、可加性与时间聚合方式
 * 以受控句式写入 description,别名写入既有 aliases 字段;本轮不引入
 * 指标条目结构。
 */
import type {
  BusinessDomain,
  SurfaceDimension,
  SurfaceMetric
} from './semantic-surface';

export interface MetadataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  description: string;
  aliases?: string[];
  roleHints: Array<'dimension' | 'measure' | 'time'>;
  unit?: string;
  granularity?: string;
  nullable: boolean;
  sensitive: boolean;
}

/** 业务域在 Schema 元数据中应声明的字段清单(维度、时间维度、指标)。 */
export function projectDomainFields(domain: BusinessDomain): MetadataField[] {
  return [
    ...domain.dimensions.map(projectDimensionField),
    projectTimeDimensionField(domain),
    ...domain.metrics.map(projectMetricField)
  ];
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

function projectMetricField(metric: SurfaceMetric): MetadataField {
  return {
    name: metric.name,
    type: 'number',
    description: `${metric.description}。可加性:${metric.additivity};时间聚合方式:${metric.timeAggregation}。`,
    ...aliasesOf(metric.aliases),
    roleHints: ['measure'],
    unit: metric.unit,
    nullable: false,
    sensitive: false
  };
}

function aliasesOf(aliases: string[]): { aliases?: string[] } {
  return aliases.length > 0 ? { aliases } : {};
}
