/**
 * 冻结快照：这是迁移前 `src/schema.ts` 的手写 JSON Schema 原文（只把两处相对
 * 导入从 `./field`/`./version` 改成 `../src/field`/`../src/version`，因为本文件
 * 现在住在 `tests/` 目录）。
 *
 * 只服务于 `schema-equivalence.test.ts`：迁移到 Zod 4 之后 `src/schema.ts` 会
 * 变成 `z.toJSONSchema(...)` 的产出，不能再充当"迁移前基线"。这份快照就是
 * 那条基线，冻结不再随 `src/schema.ts` 变化，用来断言新旧两个 JSON Schema
 * 经 ajv 校验的结果一致。除测试外不要被其他代码引用。
 */
import { valueFormatPresets } from '../src/field';
import { supportedVersions, versionPolicy } from '../src/version';

const idPattern = '^[a-z0-9][a-z0-9-]*$';
const fieldPattern = '^[A-Za-z_][A-Za-z0-9_-]*$';
const componentId = { type: 'string', pattern: idPattern } as const;
const componentLayout = { $ref: '#/definitions/componentLayout' } as const;
const mainData = { $ref: '#/definitions/mainData' } as const;
const tableData = { $ref: '#/definitions/tableData' } as const;
const metricData = { $ref: '#/definitions/metricData' } as const;
const actions = { $ref: '#/definitions/actions' } as const;

export const legacyPageSchema = {
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
        role: { type: 'string', enum: ['dimension', 'measure'] },
        label: { type: 'string', minLength: 1 },
        unit: { type: 'string', minLength: 1 },
        nullable: { type: 'boolean' },
        defaultFormat: { type: 'string', enum: valueFormatPresets }
      }
    },
    queryField: {
      type: 'object',
      required: ['type', 'role', 'queryField'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'datetime'] },
        role: { type: 'string', enum: ['dimension', 'measure'] },
        queryField: { type: 'string', minLength: 1 },
        label: { type: 'string', minLength: 1 },
        unit: { type: 'string', minLength: 1 },
        nullable: { type: 'boolean' },
        defaultFormat: { type: 'string', enum: valueFormatPresets }
      }
    },
    dataSource: {
      oneOf: [
        { $ref: '#/definitions/inlineDataSource' },
        { $ref: '#/definitions/queryDataSource' }
      ]
    },
    fields: {
      type: 'object',
      minProperties: 1,
      propertyNames: { pattern: fieldPattern },
      additionalProperties: { $ref: '#/definitions/field' }
    },
    queryFields: {
      type: 'object',
      minProperties: 1,
      propertyNames: { pattern: fieldPattern },
      additionalProperties: { $ref: '#/definitions/queryField' }
    },
    groupedQueryField: {
      type: 'object',
      required: ['queryField', 'type'],
      additionalProperties: false,
      properties: {
        queryField: { type: 'string', minLength: 1 },
        type: {
          type: 'string',
          enum: ['string', 'number', 'boolean', 'date', 'datetime']
        },
        label: { type: 'string', minLength: 1 },
        unit: { type: 'string', minLength: 1 },
        nullable: { type: 'boolean' },
        defaultFormat: { type: 'string', enum: valueFormatPresets }
      }
    },
    groupedQueryFieldGroup: {
      type: 'object',
      minProperties: 1,
      propertyNames: { pattern: fieldPattern },
      additionalProperties: { $ref: '#/definitions/groupedQueryField' }
    },
    groupedQueryFields: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dimensions: { $ref: '#/definitions/groupedQueryFieldGroup' },
        measures: { $ref: '#/definitions/groupedQueryFieldGroup' }
      },
      anyOf: [{ required: ['dimensions'] }, { required: ['measures'] }]
    },
    inlineDataSource: {
      type: 'object',
      required: ['fields', 'source'],
      additionalProperties: false,
      properties: {
        fields: { $ref: '#/definitions/fields' },
        source: { $ref: '#/definitions/inlineSource' }
      }
    },
    queryDataSource: {
      type: 'object',
      required: ['fields', 'source'],
      additionalProperties: false,
      properties: {
        fields: {
          oneOf: [
            { $ref: '#/definitions/queryFields' },
            { $ref: '#/definitions/groupedQueryFields' }
          ]
        },
        source: { $ref: '#/definitions/querySource' }
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
        initial: { $ref: '#/definitions/embeddedInitialRows' },
        query: { $ref: '#/definitions/dqeQuery' }
      }
    },
    embeddedInitialRows: {
      type: 'object',
      required: ['capturedAt', 'rows'],
      additionalProperties: false,
      properties: {
        capturedAt: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$'
        },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: { $ref: '#/definitions/scalar' }
          }
        },
        totalCount: { type: 'integer', minimum: 0 }
      }
    },
    dqeQuery: {
      type: 'object',
      required: ['language', 'body'],
      additionalProperties: false,
      properties: {
        language: { const: 'dqe' },
        body: {
          type: 'object',
          required: ['dsl_list'],
          additionalProperties: false,
          properties: {
            dsl_list: {
              type: 'array',
              minItems: 1,
              maxItems: 1,
              items: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        filterBindings: {
          type: 'object',
          propertyNames: { pattern: idPattern },
          additionalProperties: {
            oneOf: [
              {
                type: 'object',
                required: ['target', 'queryField'],
                additionalProperties: false,
                properties: {
                  target: { const: 'dimension' },
                  queryField: { type: 'string', minLength: 1 }
                }
              },
              {
                type: 'object',
                required: ['target'],
                additionalProperties: false,
                properties: {
                  target: { const: 'time' }
                }
              }
            ]
          }
        }
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
        visible: { type: 'boolean' },
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
        visible: { type: 'boolean' },
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
    // Schema 5.0 例外修订：内容分区删除 `layout`/`variant`、新增 `container` 是
    // 全局协议变化，不同步这一处则安全网对所有真实文档失去比较意义。
    // 分区以外的定义仍保持迁移前原文。
    section: {
      type: 'object',
      required: ['id', 'components'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: idPattern },
        title: { type: 'string', minLength: 1 },
        container: { type: 'string', enum: ['plain', 'panel', 'card'] },
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
              { $ref: '#/definitions/textComponent' },
              { $ref: '#/definitions/aiSummaryComponent' }
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
        span: { type: 'integer', minimum: 1, maximum: 12 },
        connectPrevious: { type: 'boolean' }
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
    tableData: {
      type: 'object',
      required: ['main'],
      minProperties: 1,
      propertyNames: { pattern: idPattern },
      additionalProperties: { type: 'string', pattern: idPattern }
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
    fieldReference: {
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
    fieldBinding: {
      oneOf: [
        { type: 'string', pattern: fieldPattern },
        {
          type: 'object',
          required: ['data', 'field'],
          additionalProperties: false,
          properties: {
            data: { type: 'string', pattern: idPattern },
            field: { type: 'string', pattern: fieldPattern },
            format: {
              type: 'string',
              enum: valueFormatPresets,
              description: '只控制当前组件中这一次字段绑定的展示格式'
            },
            match: {
              type: 'object',
              required: ['field', 'equals'],
              additionalProperties: false,
              properties: {
                field: { type: 'string', pattern: fieldPattern },
                equals: { $ref: '#/definitions/scalar' }
              }
            }
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
            field: { $ref: '#/definitions/fieldReference' }
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
                  additionalProperties: { $ref: '#/definitions/fieldReference' }
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
            generatedBy: { type: 'string' },
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
            tags: { type: 'array', items: { type: 'string', minLength: 1 } },
            decoration: { const: 'shortBar' }
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
            variant: { type: 'string', enum: ['summary', 'activityProgress'] },
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
                  unit: { type: 'string' },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['label', 'field'],
                      additionalProperties: false,
                      properties: {
                        label: { type: 'string', minLength: 1 },
                        field: { $ref: '#/definitions/fieldBinding' },
                        unit: { type: 'string' },
                        tone: {
                          type: 'string',
                          enum: ['auto', 'neutral', 'positive', 'danger']
                        }
                      }
                    }
                  }
                }
              }
            },
            progress: {
              type: 'object',
              required: ['valueField'],
              additionalProperties: false,
              properties: {
                valueField: { $ref: '#/definitions/fieldBinding' },
                label: { type: 'string' },
                ringPercent: { type: 'number', minimum: 0, maximum: 100 }
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
        secondaryField: { $ref: '#/definitions/fieldBinding' },
        badgeField: { $ref: '#/definitions/fieldBinding' },
        dangerValues: {
          type: 'array',
          uniqueItems: true,
          items: { type: 'string' }
        },
        selection: {
          type: 'object',
          required: ['writes'],
          additionalProperties: false,
          properties: {
            writes: {
              type: 'object',
              minProperties: 1,
              propertyNames: { pattern: idPattern },
              additionalProperties: {
                oneOf: [
                  {
                    type: 'object',
                    required: ['field'],
                    additionalProperties: false,
                    properties: {
                      field: { $ref: '#/definitions/fieldReference' }
                    }
                  },
                  {
                    type: 'object',
                    required: ['value'],
                    additionalProperties: false,
                    properties: {
                      value: { type: 'string' }
                    }
                  }
                ]
              }
            }
          }
        },
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
        emphasis: { type: 'string', enum: ['strong'] },
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
        data: tableData,
        props: {
          type: 'object',
          required: ['columns'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            rowKey: { type: 'string', pattern: fieldPattern },
            fit: { type: 'string', enum: ['content', 'container'] },
            columns: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/definitions/tableColumnNode' }
            },
            pagination: {
              oneOf: [
                {
                  type: 'object',
                  required: ['mode'],
                  additionalProperties: false,
                  properties: { mode: { const: 'none' } }
                },
                {
                  type: 'object',
                  required: ['mode', 'pageSize'],
                  additionalProperties: false,
                  properties: {
                    mode: { const: 'local' },
                    pageSize: { type: 'integer', minimum: 1 },
                    numbered: { type: 'boolean' }
                  }
                },
                {
                  type: 'object',
                  required: ['mode'],
                  additionalProperties: false,
                  properties: { mode: { const: 'query' } }
                }
              ]
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
            title: { type: 'string' },
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
    },
    aiSummaryRelatedField: {
      type: 'object',
      required: ['field', 'term'],
      additionalProperties: false,
      properties: {
        field: { type: 'string', pattern: fieldPattern },
        term: { type: 'string', minLength: 1, pattern: '\\S' }
      }
    },
    aiSummaryRelatedDataDefinition: {
      type: 'object',
      required: ['source', 'description', 'fields'],
      additionalProperties: false,
      properties: {
        source: { type: 'string', pattern: idPattern },
        description: { type: 'string', minLength: 1, pattern: '\\S' },
        fields: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/aiSummaryRelatedField' }
        }
      }
    },
    aiSummaryComponent: {
      type: 'object',
      required: ['id', 'type', 'layout', 'props'],
      additionalProperties: false,
      properties: {
        id: componentId,
        type: { const: 'aiSummary' },
        layout: componentLayout,
        props: {
          type: 'object',
          required: ['promptTemplate', 'relatedData'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            promptTemplate: { type: 'string', minLength: 1, pattern: '\\S' },
            relatedData: {
              type: 'object',
              minProperties: 1,
              propertyNames: { pattern: idPattern },
              additionalProperties: {
                $ref: '#/definitions/aiSummaryRelatedDataDefinition'
              }
            }
          }
        }
      }
    }
  }
} as const;
