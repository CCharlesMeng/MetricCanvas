import { describe, expect, it } from 'vitest';
import {
  validate,
  type EffectiveQuery,
  type Page,
  type Row
} from '@metriccanvas/page';
import inlineReportDocument from '../../page/fixtures/contract-valid/inline-report.json';
import mixedPageDocument from '../../page/fixtures/contract-valid/mixed-page.json';
import queryDashboardDocument from '../../page/fixtures/contract-valid/query-dashboard.json';
import tokensReportDocument from '../../../pages/tokens-report.json';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function page(document: unknown): Page {
  expect(validate(document)).toEqual([]);
  return document as Page;
}

function gatewayReturning(rows: Row[]) {
  const received: EffectiveQuery[] = [];
  const gateway: DataGateway = {
    async fetchData(query) {
      received.push(query);
      return { rows, totalCount: rows.length };
    }
  };
  return { gateway, received };
}

function subscribe(document: Page, gateway: DataGateway) {
  const pushes: PageDataSnapshots[] = [];
  orchestrate(document, gateway).subscribe((snapshots) => pushes.push(snapshots));
  return {
    pushes,
    latest: () => pushes.at(-1)!
  };
}

describe('4.0 页面契约与统一运行时集成', () => {
  it('inline 契约样例直接生成终态数据快照，不访问数据网关', () => {
    const { gateway, received } = gatewayReturning([]);
    const result = subscribe(page(inlineReportDocument), gateway);

    expect(received).toEqual([]);
    expect(result.pushes).toHaveLength(1);
    expect(result.latest().get('report-header')).toBeUndefined();
    expect(result.latest().get('overview')).toEqual({
      status: 'ready',
      rows: [{ gmv: 632300000000 }]
    });
  });

  it('query 契约样例经数据网关产生 loading 到 ready 的数据快照', async () => {
    const { gateway, received } = gatewayReturning([{ region: '华东', gmv: 42 }]);
    const result = subscribe(page(queryDashboardDocument), gateway);

    expect(result.latest().get('sales')).toEqual({
      status: 'loading'
    });
    await flush();

    expect(received).toEqual([
      {
        language: 'dqe',
        body: {
          dsl_list: [{
            output_dims: ['region'],
            output_metrics: ['gmv'],
            filter: { dims: [], metrics: [] },
            order: { offset: 0, limit: 20 }
          }]
        },
        fieldMappings: {
          region: {
            queryField: 'region',
            type: 'string',
            role: 'dimension',
            nullable: false
          },
          gmv: {
            queryField: 'gmv',
            type: 'number',
            role: 'measure',
            nullable: false
          }
        },
        pagination: { offset: 0, limit: 20 },
        filterValues: []
      }
    ]);
    expect(result.latest().get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '华东', gmv: 42 }],
      totalCount: 1
    });
  });

  it('mixed 契约样例保持 inline 终态，并独立推进 query 数据槽', async () => {
    const { gateway } = gatewayReturning([{ 'stat-date': '2026-07-21', gmv: 12 }]);
    const result = subscribe(page(mixedPageDocument), gateway);

    expect(result.latest().get('fixed-target')).toEqual({
      status: 'ready',
      rows: [{ target: 1000000 }]
    });
    expect(result.latest().get('live-sales')).toEqual({
      status: 'loading'
    });
    await flush();

    expect(result.latest().get('fixed-target')).toEqual({
      status: 'ready',
      rows: [{ target: 1000000 }]
    });
    expect(result.latest().get('live-sales')).toEqual({
      status: 'ready',
      rows: [{ 'stat-date': '2026-07-21', gmv: 12 }],
      totalCount: 1
    });
  });

  it('Tokens 页面所有组件数据槽都解析为对应 inline 数据行', () => {
    const document = page(tokensReportDocument);
    const { gateway, received } = gatewayReturning([]);
    const result = subscribe(document, gateway);
    const snapshots = result.latest();

    expect(received).toEqual([]);
    for (const section of document.sections) {
      for (const component of section.components) {
        if (!component.data) continue;
        for (const sourceId of Object.values(component.data)) {
          const source = document.dataSources[sourceId].source;
          expect(source.type).toBe('inline');
          if (source.type !== 'inline') continue;
          expect(snapshots.get(sourceId)).toEqual(
            source.rows.length === 0
              ? { status: 'empty' }
              : { status: 'ready', rows: source.rows }
          );
        }
      }
    }
  });
});
