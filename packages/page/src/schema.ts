import { supportedVersions, versionPolicy } from './version';

const idPattern = '^[a-z0-9][a-z0-9-]*$';
const fieldPattern = '^[A-Za-z_][A-Za-z0-9_-]*$';
const formatPresets = [
  'text',
  'number',
  'number-1',
  'number-2',
  'number-grouped',
  'compact-wan-0',
  'compact-wan-1',
  'compact-yi-1',
  'percent-0',
  'percent-1',
  'percent-2',
  'percent-2-signed',
  'date',
  'date-month-day'
] as const;

const componentId = { type: 'string', pattern: idPattern } as const;
const componentLayout = { $ref: '#/definitions/componentLayout' } as const;
const mainData = { $ref: '#/definitions/mainData' } as const;
const metricData = { $ref: '#/definitions/metricData' } as const;
const actions = { $ref: '#/definitions/actions' } as const;

export const pageSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: `https://metriccanvas/page/v${versionPolicy.current}`,
  title: '看板页面',
  type: 'object',
  required: ['schemaVersion', 'id', 'dataSources', 'sections'],
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      enum: supportedVersions(),
      description: `页面文档契约版本；当前支持 ${supportedVersions().join(' / ')}`
    },
    id: { type: 'string', pattern: idPattern },
    meta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        description: { type: 'string' }
      }
    },
    dataSources: {
      type: 'object',
      propertyNames: { pattern: idPattern },
      additionalProperties: { $ref: '#/definitions/dataSource' }
    },
    filters: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/definitions/dimensionFilter' },
          { $ref: '#/definitions/timeRangeFilter' }
        ]
      }
    },
    sections: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/definitions/section' }
    }
  },
  definitions: {
    scalar: {
      type: ['string', 'number', 'boolean', 'null']
    },
    field: {
      type: 'object',
      required: ['type', 'role'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'datetime'] },
        role: { type: 'string', enum: ['dimension', 'metric'] },
        label: { type: 'string', minLength: 1 },
        format: { type: 'string', enum: formatPresets }
      }
    },
    dataSource: {
      type: 'object',
      required: ['fields', 'source'],
      additionalProperties: false,
      properties: {
        fields: {
          type: 'object',
          minProperties: 1,
          propertyNames: { pattern: fieldPattern },
          additionalProperties: { $ref: '#/definitions/field' }
        },
        source: {
          oneOf: [
            { $ref: '#/definitions/inlineSource' },
            { $ref: '#/definitions/querySource' }
          ]
        }
      }
    },
    inlineSource: {
      type: 'object',
      required: ['type', 'rows'],
      additionalProperties: false,
      properties: {
        type: { const: 'inline' },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: { $ref: '#/definitions/scalar' }
          }
        }
      }
    },
    querySource: {
      type: 'object',
      required: ['type', 'query'],
      additionalProperties: false,
      properties: {
        type: { const: 'query' },
        query: { $ref: '#/definitions/structuredQuery' }
      }
    },
    orderByRule: {
      type: 'object',
      required: ['field', 'direction'],
      additionalProperties: false,
      properties: {
        field: { type: 'string', pattern: fieldPattern },
        direction: { type: 'string', enum: ['asc', 'desc'] }
      }
    },
    timeWindow: {
      oneOf: [
        {
          type: 'object',
          required: ['kind'],
          additionalProperties: false,
          properties: { kind: { const: 'selected' } }
        },
        {
          type: 'object',
          required: ['kind', 'anchor'],
          additionalProperties: false,
          properties: { kind: { const: 'point' }, anchor: { const: 'to' } }
        },
        {
          type: 'object',
          required: ['kind', 'anchor', 'previous', 'unit'],
          additionalProperties: false,
          properties: {
            kind: { const: 'lookback' },
            anchor: { const: 'to' },
            previous: { type: 'integer', minimum: 0 },
            unit: { type: 'string', enum: ['day', 'week', 'month'] }
          }
        }
      ]
    },
    structuredQuery: {
      type: 'object',
      required: ['metrics'],
      additionalProperties: false,
      properties: {
        metrics: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', pattern: fieldPattern }
        },
        dimensions: {
          type: 'array',
          uniqueItems: true,
          items: { type: 'string', pattern: fieldPattern }
        },
        aggregation: { type: 'string', minLength: 1 },
        granularity: { type: 'string', minLength: 1 },
        filters: {
          type: 'object',
          required: ['subscribe'],
          additionalProperties: false,
          properties: {
            subscribe: {
              type: 'array',
              uniqueItems: true,
              items: { type: 'string', pattern: idPattern }
            }
          }
        },
        time: {
          type: 'object',
          required: ['filter', 'window'],
          additionalProperties: false,
          properties: {
            filter: { type: 'string', pattern: idPattern },
            window: { $ref: '#/definitions/timeWindow' }
          }
        },
        orderBy: {
          type: 'array',
          items: { $ref: '#/definitions/orderByRule' }
        },
        limit: { type: 'integer', minimum: 1 }
      }
    },
    dimensionFilter: {
      type: 'object',
      required: ['id', 'type', 'dimension'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: idPattern },
        type: { const: 'dimension' },
        dimension: { type: 'string', pattern: fieldPattern },
        label: { type: 'string' },
        display: { type: 'string', enum: ['select', 'tabs', 'tree', 'search'] },
        default: { type: 'array', items: { type: 'string' } }
      }
    },
    timeRangeFilter: {
      type: 'object',
      required: ['id', 'type'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: idPattern },
        type: { const: 'timeRange' },
        label: { type: 'string' },
        precision: { type: 'string', enum: ['date', 'datetime'] },
        default: {
          oneOf: [
            { type: 'string', enum: ['today', 'last7d', 'last30d', 'last90d'] },
            {
              type: 'object',
              required: ['from', 'to'],
              additionalProperties: false,
              properties: {
                from: { type: 'string' },
                to: { type: 'string' }
              }
            }
          ]
        }
      }
    },
    section: {
      type: 'object',
      required: ['id', 'layout', 'components'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: idPattern },
        title: { type: 'string', minLength: 1 },
        layout: {
          type: 'object',
          required: ['type', 'columns'],
          additionalProperties: false,
          properties: {
            type: { const: 'grid' },
            columns: { const: 12 }
          }
        },
        components: {
          type: 'array',
          minItems: 1,
          items: {
            oneOf: [
              { $ref: '#/definitions/reportHeaderComponent' },
              { $ref: '#/definitions/metricCardComponent' },
              { $ref: '#/definitions/barChartComponent' },
              { $ref: '#/definitions/lineChartComponent' },
              { $ref: '#/definitions/pieChartComponent' },
              { $ref: '#/definitions/tableComponent' },
              { $ref: '#/definitions/mapChartComponent' },
              { $ref: '#/definitions/rankingCardComponent' },
              { $ref: '#/definitions/textComponent' }
            ]
          }
        }
      }
    },
    componentLayout: {
      type: 'object',
      required: ['span'],
      additionalProperties: false,
      properties: {
        span: { type: 'integer', minimum: 1, maximum: 12 }
      }
    },
    mainData: {
      type: 'object',
      required: ['main'],
      additionalProperties: false,
      properties: {
        main: { type: 'string', pattern: idPattern }
      }
    },
    metricData: {
      type: 'object',
      required: ['main'],
      additionalProperties: false,
      properties: {
        main: { type: 'string', pattern: idPattern },
        compare: { type: 'string', pattern: idPattern },
        target: { type: 'string', pattern: idPattern }
      }
    },
    fieldBinding: {
      oneOf: [
        { type: 'string', pattern: fieldPattern },
        {
          type: 'object',
          required: ['data', 'field'],
          additionalProperties: false,
          properties: {
            data: { type: 'string', pattern: idPattern },
            field: { type: 'string', pattern: fieldPattern }
          }
        }
      ]
    },
    componentAction: {
      oneOf: [
        {
          type: 'object',
          required: ['on', 'writeFilter', 'field'],
          additionalProperties: false,
          properties: {
            on: { const: 'click' },
            writeFilter: { type: 'string', pattern: idPattern },
            field: { $ref: '#/definitions/fieldBinding' }
          }
        },
        {
          type: 'object',
          required: ['on', 'navigate'],
          additionalProperties: false,
          properties: {
            on: { const: 'click' },
            navigate: {
              type: 'object',
              required: ['page'],
              additionalProperties: false,
              properties: {
                page: { type: 'string', pattern: idPattern },
                carryFilters: {
                  type: 'array',
                  uniqueItems: true,
                  items: { type: 'string', pattern: idPattern }
                },
                setFilters: {
                  type: 'object',
                  additionalProperties: { $ref: '#/definitions/fieldBinding' }
                }
              }
            }
          }
        }
      ]
    },
    actions: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/definitions/componentAction' }
    },
    reportHeaderComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'reportHeader' },
        layout: componentLayout,
        props: {
          type: 'object',
          required: ['title'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1 },
            subtitle: { type: 'string' },
            badge: { type: 'string' },
            asOf: {
              type: 'object',
              required: ['label', 'value'],
              additionalProperties: false,
              properties: {
                label: { type: 'string', minLength: 1 },
                value: { type: 'string', minLength: 1 }
              }
            },
            tags: { type: 'array', items: { type: 'string', minLength: 1 } }
          }
        }
      }
    },
    metricCardComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'metricCard' },
        layout: componentLayout,
        data: metricData,
        props: {
          type: 'object',
          required: ['rows'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            rows: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['label', 'valueField'],
                additionalProperties: false,
                properties: {
                  label: { type: 'string', minLength: 1 },
                  valueField: { $ref: '#/definitions/fieldBinding' },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['label', 'field'],
                      additionalProperties: false,
                      properties: {
                        label: { type: 'string', minLength: 1 },
                        field: { $ref: '#/definitions/fieldBinding' }
                      }
                    }
                  }
                }
              }
            },
            actions
          }
        }
      }
    },
    chartSeries: {
      type: 'object',
      required: ['field'],
      additionalProperties: false,
      properties: {
        field: { $ref: '#/definitions/fieldBinding' },
        label: { type: 'string' }
      }
    },
    barChartComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'barChart' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['categoryField', 'series'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            categoryField: { $ref: '#/definitions/fieldBinding' },
            series: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/definitions/chartSeries' }
            },
            stacked: { type: 'boolean' },
            rounded: { type: 'boolean' },
            horizontal: { type: 'boolean' },
            dualAxis: { type: 'boolean' },
            actions
          }
        }
      }
    },
    lineChartComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'lineChart' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['xField', 'series'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            xField: { $ref: '#/definitions/fieldBinding' },
            series: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/definitions/chartSeries' }
            },
            smooth: { type: 'boolean' },
            areaGradient: { type: 'boolean' },
            stacked: { type: 'boolean' },
            dualAxis: { type: 'boolean' },
            showPointLabels: { type: 'boolean' },
            hideYAxis: { type: 'boolean' },
            actions
          }
        }
      }
    },
    pieChartComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'pieChart' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['categoryField', 'valueField'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            categoryField: { $ref: '#/definitions/fieldBinding' },
            valueField: { $ref: '#/definitions/fieldBinding' },
            ring: { type: 'string', pattern: '^\\d{1,2}%$' },
            labelLine: { type: 'boolean' },
            actions
          }
        }
      }
    },
    tableColumn: {
      type: 'object',
      required: ['field'],
      additionalProperties: false,
      properties: {
        kind: { const: 'field' },
        field: { $ref: '#/definitions/fieldBinding' },
        title: { type: 'string' },
        width: { type: 'integer', minimum: 1 },
        fixed: { type: 'string', enum: ['left', 'right'] },
        sortable: { type: 'boolean' },
        filterable: {
          type: 'object',
          required: ['mode'],
          additionalProperties: false,
          properties: { mode: { type: 'string', enum: ['select', 'dateRange'] } }
        },
        align: { type: 'string', enum: ['left', 'right'] },
        visual: { type: 'string', enum: ['plain', 'rateBar', 'signed'] }
      }
    },
    tableColumnGroup: {
      type: 'object',
      required: ['kind', 'id', 'title', 'children'],
      additionalProperties: false,
      properties: {
        kind: { const: 'group' },
        id: { type: 'string', pattern: idPattern },
        title: { type: 'string', minLength: 1 },
        children: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/tableColumnNode' }
        }
      }
    },
    tableColumnNode: {
      oneOf: [
        { $ref: '#/definitions/tableColumn' },
        { $ref: '#/definitions/tableColumnGroup' }
      ]
    },
    tableComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'table' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['columns'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            columns: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/definitions/tableColumnNode' }
            },
            pagination: {
              type: 'object',
              required: ['mode'],
              additionalProperties: false,
              properties: {
                mode: { type: 'string', enum: ['none', 'paged'] },
                pageSize: { type: 'integer', minimum: 1 }
              }
            },
            actions
          }
        }
      }
    },
    mapChartComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'mapChart' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['nameField', 'valueField', 'map'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            nameField: { $ref: '#/definitions/fieldBinding' },
            valueField: { $ref: '#/definitions/fieldBinding' },
            map: { type: 'string', enum: ['china', 'world'] },
            scatter: { type: 'string', enum: ['point', 'effect'] },
            nameMap: { type: 'object', additionalProperties: { type: 'string' } },
            actions
          }
        }
      }
    },
    rankingCardComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'data', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'rankingCard' },
        layout: componentLayout,
        data: mainData,
        props: {
          type: 'object',
          required: ['nameField', 'valueField'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            nameField: { $ref: '#/definitions/fieldBinding' },
            valueField: { $ref: '#/definitions/fieldBinding' },
            changeField: { $ref: '#/definitions/fieldBinding' },
            actions
          }
        }
      }
    },
    textComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'text' },
        layout: componentLayout,
        props: {
          type: 'object',
          additionalProperties: false,
          properties: {
            heading: { type: 'string' },
            body: { type: 'string' },
            variant: { type: 'string', enum: ['plain', 'insight'] },
            links: {
              type: 'array',
              items: {
                type: 'object',
                required: ['label', 'page'],
                additionalProperties: false,
                properties: {
                  label: { type: 'string', minLength: 1 },
                  page: { type: 'string', pattern: idPattern },
                  carryFilters: {
                    type: 'array',
                    uniqueItems: true,
                    items: { type: 'string', pattern: idPattern }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
