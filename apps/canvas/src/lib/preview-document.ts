import type { TypedError } from '@metriccanvas/page';

export type PreviewDocumentResult =
  | { status: 'valid'; document: unknown }
  | { status: 'syntax-error'; message: string }
  | { status: 'contract-error'; errors: TypedError[] };

type PageValidator = (document: unknown) => TypedError[];

export function parsePreviewDocument(
  source: string,
  validateDocument: PageValidator
): PreviewDocumentResult {
  let document: unknown;
  try {
    document = JSON.parse(source);
  } catch (cause) {
    return {
      status: 'syntax-error',
      message: cause instanceof Error ? cause.message : String(cause)
    };
  }

  const errors = validateDocument(document);
  return errors.length > 0
    ? { status: 'contract-error', errors }
    : { status: 'valid', document };
}

export const DEFAULT_PREVIEW_PAGE = {
  schemaVersion: '1.0',
  id: 'preview-inline-report',
  meta: {
    description: '只使用内联数据的即时预览示例'
  },
  dataSources: {
    overview: {
      fields: {
        revenue: {
          type: 'number',
          role: 'metric',
          label: '销售额',
          format: 'number-grouped'
        }
      },
      source: {
        type: 'inline',
        rows: [{ revenue: 128600 }]
      }
    },
    trend: {
      fields: {
        date: {
          type: 'date',
          role: 'dimension',
          label: '日期',
          format: 'date-month-day'
        },
        revenue: {
          type: 'number',
          role: 'metric',
          label: '销售额',
          format: 'number-grouped'
        }
      },
      source: {
        type: 'inline',
        rows: [
          { date: '2026-07-17', revenue: 18200 },
          { date: '2026-07-18', revenue: 21500 },
          { date: '2026-07-19', revenue: 19800 },
          { date: '2026-07-20', revenue: 32600 },
          { date: '2026-07-21', revenue: 36500 }
        ]
      }
    }
  },
  sections: [
    {
      id: 'overview',
      layout: {
        type: 'grid',
        columns: 12
      },
      components: [
        {
          id: 'report-header',
          type: 'reportHeader',
          layout: {
            span: 12
          },
          props: {
            title: '即时经营预览',
            subtitle: '编辑左侧 Page JSON，右侧会立即重新校验并渲染',
            asOf: {
              label: '数据截至',
              value: '2026-07-21'
            }
          }
        },
        {
          id: 'revenue-card',
          type: 'metricCard',
          layout: {
            span: 4
          },
          data: {
            main: 'overview'
          },
          props: {
            title: '核心指标',
            rows: [
              {
                label: '今日销售额',
                valueField: 'revenue'
              }
            ]
          }
        },
        {
          id: 'revenue-trend',
          type: 'lineChart',
          layout: {
            span: 8
          },
          data: {
            main: 'trend'
          },
          props: {
            title: '近五日销售趋势',
            xField: 'date',
            series: [
              {
                field: 'revenue',
                label: '销售额'
              }
            ],
            smooth: true,
            areaGradient: true
          }
        }
      ]
    }
  ]
} as const;

export const DEFAULT_PREVIEW_JSON = JSON.stringify(DEFAULT_PREVIEW_PAGE, null, 2);
