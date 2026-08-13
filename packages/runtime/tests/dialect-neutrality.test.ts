import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  declaredPaginationLimit,
  type EffectiveQuery,
  type Page
} from '@metriccanvas/page';
import { orchestrate } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 编排器方言无关性(ADR-0034/issue #79):统一运行时不知道查询定义背后是
 * 哪种协议。language 与查询体按数据源分支原样透传,分页页大小只经查询
 * 定义自述的协议中立能力读取,编排层源码不出现协议方言词汇。
 */

function pagedQueryPage(order: unknown): Page {
  return {
    schemaVersion: '5.0',
    id: 'dialect-neutrality',
    dataSources: {
      sales: {
        fields: {
          region: {
            queryField: '地区',
            type: 'string',
            role: 'dimension',
            nullable: false
          },
          revenue: {
            queryField: '收入',
            type: 'number',
            role: 'measure',
            nullable: false
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: ['地区'],
                output_metrics: ['收入'],
                filter: { dims: [], metrics: [] },
                order: order as never
              }]
            }
          }
        }
      }
    },
    sections: [{
      id: 'main',
      components: [{
        id: 'sales-table',
        type: 'table',
        layout: { span: 12 },
        data: { main: 'sales' },
        props: {
          columns: [
            { field: 'region', title: '区域' },
            { field: 'revenue', title: '收入' }
          ],
          pagination: { mode: 'query' }
        }
      }]
    }]
  };
}

function recordingGateway(received: EffectiveQuery[]): DataGateway {
  return {
    async fetchData(query) {
      received.push(query);
      return { rows: [{ region: '华东', revenue: 42 }], totalCount: 1 };
    },
    async fetchDimensionValues() {
      return [];
    }
  };
}

describe('编排器方言无关性', () => {
  it('生效查询的 language 与查询体从查询定义分支原样透传', async () => {
    const page = pagedQueryPage({ offset: 0, limit: 10 });
    const source = page.dataSources.sales!;
    if (source.source.type !== 'query') throw new Error('测试数据源必须为 query');
    const definition = source.source.query;
    const received: EffectiveQuery[] = [];
    const unsubscribe = orchestrate(page, recordingGateway(received))
      .subscribe(() => {});
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]!.language).toBe(definition.language);
    expect(received[0]!.body).toBe(definition.body);
    unsubscribe();
  });

  it('分页页大小与查询定义自述的分页能力一致', async () => {
    const page = pagedQueryPage({ offset: 0, limit: 10 });
    const source = page.dataSources.sales!;
    if (source.source.type !== 'query') throw new Error('测试数据源必须为 query');
    const received: EffectiveQuery[] = [];
    const unsubscribe = orchestrate(page, recordingGateway(received))
      .subscribe(() => {});
    await flush();

    expect(received[0]!.pagination).toEqual({
      offset: 0,
      limit: declaredPaginationLimit(source.source.query)
    });
    unsubscribe();
  });

  it('查询定义未自述合法分页能力时,生效查询不携带分页', async () => {
    const received: EffectiveQuery[] = [];
    const unsubscribe = orchestrate(
      pagedQueryPage({ limit: '10' }),
      recordingGateway(received)
    ).subscribe(() => {});
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]!.pagination).toBeUndefined();
    unsubscribe();
  });

  it('编排层源码不出现协议方言词汇(issue #79 验收)', () => {
    const sourceDirectory = join(
      dirname(fileURLToPath(import.meta.url)),
      '../src'
    );
    for (const fileName of readdirSync(sourceDirectory)) {
      const content = readFileSync(join(sourceDirectory, fileName), 'utf8');
      expect(content, `${fileName} 不得直读 DQE 线格式`).not.toContain('dsl_list');
      expect(content, `${fileName} 不得硬编码协议判别值`).not.toContain(
        "language: 'dqe'"
      );
    }
  });
});
