/**
 * 看板页面文档的 JSON Schema(DSL v1.0,切片1 范围:metricCard 单组件)。
 * description 字段同时服务两个消费方:校验错误消息与编辑器悬浮提示(User Story 5)。
 */
export const pageSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://metriccanvas/page/v1.0',
  title: '看板页面',
  description: '平台的聚合根与核心资产,以严格声明式文档形式存在',
  type: 'object',
  required: ['formatVersion', 'id', 'title', 'layout', 'widgets'],
  additionalProperties: false,
  properties: {
    formatVersion: {
      type: 'string',
      enum: ['1.0'],
      description: '文档格式(DSL)大版本。运行时兼容 N/N-1 两个大版本(ADR 见 PRD)'
    },
    id: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9-]*$',
      description: '页面唯一标识,小写字母/数字/连字符;须与页面文件名一致'
    },
    title: { type: 'string', minLength: 1, description: '页面标题,显示于页头与看板目录' },
    description: { type: 'string', description: '页面说明,显示于看板目录' },
    layout: {
      type: 'object',
      description: '布局声明。一期固定 12 列网格',
      required: ['type', 'columns'],
      additionalProperties: false,
      properties: {
        type: { const: 'grid' },
        columns: { const: 12 }
      }
    },
    widgets: {
      type: 'array',
      description: '页面组件清单,封闭组件集',
      items: { $ref: '#/definitions/metricCardWidget' }
    }
  },
  definitions: {
    position: {
      type: 'object',
      description: '组件在 12 列网格中的位置与尺寸;x+w 不得超过 12(校验器额外检查)',
      required: ['x', 'y', 'w', 'h'],
      additionalProperties: false,
      properties: {
        x: { type: 'integer', minimum: 0, maximum: 11, description: '起始列(0 起)' },
        y: { type: 'integer', minimum: 0, description: '起始行(0 起)' },
        w: { type: 'integer', minimum: 1, maximum: 12, description: '跨列数' },
        h: { type: 'integer', minimum: 1, description: '跨行数' }
      }
    },
    structuredQuery: {
      type: 'object',
      description: '结构化查询:指标+维度+筛选+粒度,不出现查询语句字符串',
      required: ['metrics'],
      additionalProperties: false,
      properties: {
        metrics: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: '指标 code 列表,引用数据服务定义的指标'
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: '维度 code 列表,引用数据服务定义的维度'
        },
        granularity: {
          type: 'string',
          description: '时间粒度;映射到数据服务预定义的粒度字段(服务定义时固定)'
        },
        filters: {
          type: 'object',
          description: '筛选订阅:声明本查询订阅哪些页面筛选器',
          required: ['subscribe'],
          additionalProperties: false,
          properties: {
            subscribe: {
              type: 'array',
              items: { type: 'string' },
              description: '订阅的筛选器 id 列表'
            }
          }
        }
      }
    },
    metricCardWidget: {
      type: 'object',
      description: '指标卡:展示单一指标数值',
      required: ['id', 'type', 'position', 'query'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9-]*$',
          description: '组件唯一标识,页面内不可重复(校验器额外检查)'
        },
        type: { type: 'string', enum: ['metricCard'] },
        title: { type: 'string', description: '组件标题,显示于卡片头部' },
        position: { $ref: '#/definitions/position' },
        query: { $ref: '#/definitions/structuredQuery' },
        display: {
          type: 'object',
          description: '展示配置(字段范围来自《组件分析.md》§2.1)',
          additionalProperties: false,
          properties: {
            unit: { type: 'string', description: '后缀单位,如 次/万/%' },
            prefix: { type: 'string', description: '前缀,如 ¥/$' },
            thousandsSeparator: { type: 'boolean', description: '数值千分位格式化' }
          }
        }
      }
    }
  }
} as const;
