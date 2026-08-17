import { describe, expect, it, vi } from 'vitest';
import { validate } from '@metriccanvas/page';
import {
  copyMetadataJson,
  formatMetadataJson,
  metadataInitialSources
} from '../../src/lib/workbench/metadata-json';

function documentWithMixedSources(): Record<string, unknown> {
  return {
    schemaVersion: '5.0',
    id: 'ask-transient-metadata',
    dataSources: {
      'query-with-rows': {
        fields: {
          amount: {
            type: 'number',
            role: 'measure',
            queryField: 'amount'
          }
        },
        source: {
          type: 'query',
          initial: {
            capturedAt: '2026-08-14T00:00:00.000Z',
            rows: [{ amount: 42 }],
            totalCount: 1
          },
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: [],
                  output_metrics: ['amount'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            }
          }
        }
      },
      'query-without-initial': {
        fields: {
          amount: {
            type: 'number',
            role: 'measure',
            queryField: 'amount'
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: [],
                  output_metrics: ['amount'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            }
          }
        }
      },
      'query-with-empty-rows': {
        fields: {
          amount: {
            type: 'number',
            role: 'measure',
            queryField: 'amount'
          }
        },
        source: {
          type: 'query',
          initial: {
            capturedAt: '2026-08-14T00:00:00.000Z',
            rows: [],
            totalCount: 0
          },
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: [],
                  output_metrics: ['amount'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            }
          }
        }
      },
      'inline-rows': {
        fields: { label: { type: 'string', role: 'dimension' } },
        source: { type: 'inline', rows: [{ label: '固定值' }] }
      }
    },
    sections: [
      {
        id: 'main',
        components: [
          {
            id: 'description',
            type: 'text',
            layout: { span: 12 },
            props: { body: 'metadata fixture' }
          }
        ]
      }
    ]
  };
}

describe('页面文档 metadata.json 格式化', () => {
  it('以两空格缩进输出完整页面文档', () => {
    const document = {
      schemaVersion: '5.0',
      id: 'ask-transient-8f2c3a1b',
      meta: { description: '区域消耗' },
      dataSources: {},
      sections: [
        {
          id: 'main',
          components: [
            {
              id: 'description',
              type: 'text',
              layout: { span: 12 },
              props: { body: '区域消耗' }
            }
          ]
        }
      ]
    };

    expect(validate(document)).toEqual([]);
    expect(formatMetadataJson(document)).toBe(JSON.stringify(document, null, 2));
  });

  it('只枚举当前具有 initial 的查询页面数据源，空 rows 仍可选择', () => {
    const document = documentWithMixedSources();
    expect(validate(document)).toEqual([]);
    expect(metadataInitialSources(document)).toEqual([
      { id: 'query-with-rows', emptyRows: false },
      { id: 'query-with-empty-rows', emptyRows: true }
    ]);
  });

  it('默认从序列化投影排除全部 query initial，inline 与其他字段保持且输入不变', () => {
    const document = documentWithMixedSources();
    const original = structuredClone(document);
    const projected = JSON.parse(formatMetadataJson(document)) as {
      dataSources: Record<string, { source: Record<string, unknown> }>;
    };

    expect(projected.dataSources['query-with-rows']!.source.initial).toBeUndefined();
    expect(projected.dataSources['query-with-empty-rows']!.source.initial).toBeUndefined();
    expect(projected.dataSources['query-without-initial']!.source.query).toBeDefined();
    expect(projected.dataSources['inline-rows']!.source).toEqual({
      type: 'inline',
      rows: [{ label: '固定值' }]
    });
    expect(document).toEqual(original);
  });

  it('按查询页面数据源保留完整 initial，未知选择不影响其他数据源', () => {
    const projected = JSON.parse(
      formatMetadataJson(
        documentWithMixedSources(),
        new Set(['query-with-empty-rows', 'unknown-source'])
      )
    ) as {
      dataSources: Record<string, { source: Record<string, unknown> }>;
    };

    expect(projected.dataSources['query-with-rows']!.source.initial).toBeUndefined();
    expect(projected.dataSources['query-with-empty-rows']!.source.initial).toEqual({
      capturedAt: '2026-08-14T00:00:00.000Z',
      rows: [],
      totalCount: 0
    });
    expect(projected.dataSources['inline-rows']!.source.type).toBe('inline');
  });
});

describe('metadata.json 精确复制', () => {
  it('把抽屉正在展示的字符串原样交给 Clipboard writer', async () => {
    const formatted = '{\n  "id": "ask-transient-8f2c3a1b"\n}';
    const writeText = vi.fn(async (_value: string) => undefined);

    await copyMetadataJson(formatted, writeText);

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(formatted);
  });

  it('保留 Clipboard writer 的拒绝结果供抽屉显示失败状态', async () => {
    const denied = new Error('clipboard denied');
    const writeText = vi.fn(async (_value: string) => {
      throw denied;
    });

    await expect(copyMetadataJson('{}', writeText)).rejects.toBe(denied);
  });
});
