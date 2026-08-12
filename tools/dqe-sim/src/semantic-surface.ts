/**
 * 组合式语义面:DQE 仿真在精确匹配分支之外支持的可组合闭集,
 * 即 ADR-0031 所述「DQE 语义面」(中文指标名、维度名、维度取值域、时间粒度能力)。
 *
 * 本文件是语义面的唯一声明式真源(真元归一):
 * - 确定性合成引擎(semantic-surface-execute.ts)从这里推导合法组合与数值;
 * - 数据上下文同面投影(semantic-surface-metadata.ts)从这里推导
 *   docs/examples/schema-metadata.example.json 应声明的字段;
 * - 同面守卫测试只与这一份声明比对,不允许手抄第二份清单。
 */

/** DQE filter.time.period 使用的时间粒度标识。 */
export type TimeGranularity = 'day' | 'month';

/** 可加性(CONTEXT.md):可加、半可加或不可加。 */
export type Additivity = '可加' | '半可加' | '不可加';

/** 时间聚合方式(CONTEXT.md):跨时间应求和、取均值还是取期末值。 */
export type TimeAggregation = '求和' | '均值' | '期末值';

/** 语义面指标:中文指标名,带可加性与时间聚合方式。 */
export interface SurfaceMetric {
  name: string;
  aliases: string[];
  /** 口径说明。两个业务域各有一个口径不同的「客户数」,供后续消歧使用。 */
  description: string;
  unit: string;
  additivity: Additivity;
  timeAggregation: TimeAggregation;
  /** 确定性合成的取值区间,decimals 为保留小数位。 */
  valueRange: { min: number; max: number; decimals: number };
}

/** 语义面维度:维度名与封闭取值域。 */
export interface SurfaceDimension {
  name: string;
  aliases: string[];
  description: string;
  /** 维度取值域(闭集),声明顺序即输出行的排序依据。 */
  values: string[];
}

/** 时间维度:出现在 output_dims 中时按 filter.time 粒度展开分组。 */
export interface SurfaceTimeDimension {
  name: string;
  aliases: string[];
  description: string;
}

/** 业务域(CONTEXT.md):路由标签,各域共用同一个 DQE 执行环境。 */
export interface BusinessDomain {
  /** Schema 元数据中的 schema id。 */
  id: string;
  name: string;
  description: string;
  timeDimension: SurfaceTimeDimension;
  /** 支持的时间粒度,filter.time.period 必须取自这里。 */
  granularities: TimeGranularity[];
  dimensions: SurfaceDimension[];
  metrics: SurfaceMetric[];
}

export const semanticSurface: readonly BusinessDomain[] = [
  {
    id: 'operations-analytics',
    name: '运营分析',
    description: 'Tokens 服务的用量、计费与调用运营分析',
    timeDimension: {
      name: '统计周期',
      aliases: ['统计时间'],
      description: '按查询时间粒度展开的统计周期'
    },
    granularities: ['month', 'day'],
    dimensions: [
      {
        name: '区域',
        aliases: ['大区'],
        description: '业务归属区域',
        values: ['华东', '华南', '华北', '西南', '华中', '东北', '西北']
      },
      {
        name: '模型',
        aliases: ['模型系列'],
        description: '提供服务的模型系列',
        values: ['通用大模型', '代码大模型', '多模态大模型']
      }
    ],
    metrics: [
      {
        name: 'Tokens消耗量',
        aliases: ['消耗量', '用量'],
        description: '统计期内推理与训练消耗的 Token 总量',
        unit: 'Token',
        additivity: '可加',
        timeAggregation: '求和',
        valueRange: { min: 200000, max: 8000000, decimals: 0 }
      },
      {
        name: '计费Tokens量',
        aliases: ['计费量'],
        description: '统计期内计费的 Token 量,排除内部试用额度',
        unit: 'Token',
        additivity: '可加',
        timeAggregation: '求和',
        valueRange: { min: 100000, max: 6000000, decimals: 0 }
      },
      {
        name: 'Tokens请求量',
        aliases: ['调用次数'],
        description: '统计期内的模型调用请求次数,按请求计数而非 Token 计数',
        unit: '次',
        additivity: '可加',
        timeAggregation: '求和',
        valueRange: { min: 2000, max: 90000, decimals: 0 }
      },
      {
        name: '客户数',
        aliases: ['在用客户数', '活跃客户数'],
        description:
          '统计期内发起过模型调用的去重客户数,与客户经营域的期末在册口径不同',
        unit: '家',
        additivity: '不可加',
        timeAggregation: '均值',
        valueRange: { min: 40, max: 900, decimals: 0 }
      }
    ]
  },
  {
    id: 'customer-management',
    name: '客户经营',
    description: '客户规模、增长与流失的经营分析',
    timeDimension: {
      name: '统计周期',
      aliases: ['统计时间'],
      description: '按查询时间粒度展开的统计周期'
    },
    granularities: ['month'],
    dimensions: [
      {
        name: '客户级别',
        aliases: ['客户层级'],
        description: '客户经营分层',
        values: ['卓越', '战略', '核心', '成长']
      },
      {
        name: '行业',
        aliases: ['所属行业'],
        description: '客户所属行业',
        values: ['金融', '制造', '互联网', '能源', '政务']
      }
    ],
    metrics: [
      {
        name: '客户数',
        aliases: ['在册客户数', '存量客户数'],
        description: '期末在册客户总数,与运营分析域的在用调用口径不同',
        unit: '家',
        additivity: '半可加',
        timeAggregation: '期末值',
        valueRange: { min: 300, max: 5000, decimals: 0 }
      },
      {
        name: '新增客户数',
        aliases: ['新签客户数'],
        description: '统计期内新增签约的客户数',
        unit: '家',
        additivity: '可加',
        timeAggregation: '求和',
        valueRange: { min: 5, max: 400, decimals: 0 }
      },
      {
        name: '流失客户数',
        aliases: ['流失数'],
        description: '统计期内终止合作的客户数',
        unit: '家',
        additivity: '可加',
        timeAggregation: '求和',
        valueRange: { min: 0, max: 200, decimals: 0 }
      },
      {
        name: '客户留存率',
        aliases: ['留存率'],
        description: '统计期末仍然在册的客户占期初在册客户的比例',
        unit: '%',
        additivity: '不可加',
        timeAggregation: '均值',
        valueRange: { min: 60, max: 99.9, decimals: 1 }
      }
    ]
  }
];

/** 在某个业务域内查找指标声明。 */
export function findMetric(
  domain: BusinessDomain,
  name: string
): SurfaceMetric | undefined {
  return domain.metrics.find((metric) => metric.name === name);
}

/** 在某个业务域内查找维度声明(不含时间维度)。 */
export function findDimension(
  domain: BusinessDomain,
  name: string
): SurfaceDimension | undefined {
  return domain.dimensions.find((dimension) => dimension.name === name);
}
