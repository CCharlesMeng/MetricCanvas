/** 页面规格 JSON Schema(DSL v1.0,切片1 范围:metricCard 单组件) */
export const pageSpecSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://metriccanvas/spec/v1.0',
  type: 'object',
  required: ['specVersion', 'id', 'title', 'layout', 'widgets'],
  additionalProperties: false,
  properties: {
    specVersion: { type: 'string', enum: ['1.0'] },
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    layout: {
      type: 'object',
      required: ['type', 'columns'],
      additionalProperties: false,
      properties: {
        type: { const: 'grid' },
        columns: { const: 12 }
      }
    },
    widgets: {
      type: 'array',
      items: { $ref: '#/definitions/metricCardWidget' }
    }
  },
  definitions: {
    position: {
      type: 'object',
      required: ['x', 'y', 'w', 'h'],
      additionalProperties: false,
      properties: {
        x: { type: 'integer', minimum: 0, maximum: 11 },
        y: { type: 'integer', minimum: 0 },
        w: { type: 'integer', minimum: 1, maximum: 12 },
        h: { type: 'integer', minimum: 1 }
      }
    },
    structuredQuery: {
      type: 'object',
      required: ['metrics'],
      additionalProperties: false,
      properties: {
        metrics: { type: 'array', items: { type: 'string' }, minItems: 1 },
        dimensions: { type: 'array', items: { type: 'string' } },
        granularity: { type: 'string' },
        filters: {
          type: 'object',
          required: ['subscribe'],
          additionalProperties: false,
          properties: {
            subscribe: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    metricCardWidget: {
      type: 'object',
      required: ['id', 'type', 'position', 'query'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
        type: { type: 'string', enum: ['metricCard'] },
        title: { type: 'string' },
        position: { $ref: '#/definitions/position' },
        query: { $ref: '#/definitions/structuredQuery' },
        display: {
          type: 'object',
          additionalProperties: false,
          properties: {
            unit: { type: 'string' },
            prefix: { type: 'string' },
            thousandsSeparator: { type: 'boolean' }
          }
        }
      }
    }
  }
} as const;
