import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-20T12:00:00.000Z',
  source: 'offline-fixture',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: [],
      availableAggregations: ['sum']
    }
  ],
  dimensions: []
};

function page(title = '成交总额'): Page {
  return {
    schemaVersion: '1.0',
    id: 'offline-overview',
    dataSources: {
      sales: {
        fields: { gmv: { type: 'number', role: 'metric' } },
        source: {
          type: 'query',
          query: { metrics: ['gmv'], aggregation: 'sum' }
        }
      }
    },
    sections: [
      {
        id: 'overview',
        title,
        layout: { type: 'grid', columns: 12 },
        components: [
          {
            id: 'gmv-card',
            type: 'metricCard',
            layout: { span: 6 },
            data: { main: 'sales' },
            props: { rows: [{ label: title, valueField: 'gmv' }] }
          }
        ]
      }
    ]
  };
}

describe('进程内页面生命周期', () => {
  it('离线完成页面修订、历史、差异、发布与正式读取', async () => {
    const generatedIds = ['revision-1', 'revision-2', 'request-1'];
    const lifecycle = createMemoryPageLifecycle({
      catalog: { current: async () => ({ version: 'catalog-offline', snapshot: catalog }) },
      clock: { now: () => new Date('2026-07-22T08:00:00.000Z') },
      ids: { next: () => generatedIds.shift() ?? 'unexpected-id' },
      tokens: { next: () => 'offline-token' },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost:5174/publish/${requestId}/confirm?token=${token}`
      }
    });
    const editor = { actorId: 'developer-1', clientId: 'workbench' };

    const first = await lifecycle.saveRevision(
      {
        pageId: 'offline-overview',
        baseRevisionId: null,
        document: page(),
        idempotencyKey: 'save-r1'
      },
      editor
    );
    expect(first).toMatchObject({
      ok: true,
      revision: { revisionId: 'revision-1', revisionNumber: 1 }
    });
    if (!first.ok) return;

    const second = await lifecycle.saveRevision(
      {
        pageId: 'offline-overview',
        baseRevisionId: first.revision.revisionId,
        document: page('成交总额（更新）'),
        idempotencyKey: 'save-r2'
      },
      editor
    );
    expect(second).toMatchObject({
      ok: true,
      revision: { revisionId: 'revision-2', revisionNumber: 2 }
    });
    if (!second.ok) return;

    expect(await lifecycle.listPages()).toMatchObject({
      pages: [
        {
          pageId: 'offline-overview',
          latestRevision: { revisionId: 'revision-2' },
          publishedRevision: null
        }
      ]
    });
    expect(await lifecycle.listRevisionHistory({ pageId: 'offline-overview' })).toMatchObject({
      ok: true,
      history: { revisions: [{ revisionNumber: 2 }, { revisionNumber: 1 }] }
    });
    expect(
      await lifecycle.diffRevisions({
        pageId: 'offline-overview',
        fromRevisionId: 'revision-1',
        toRevisionId: 'revision-2'
      })
    ).toMatchObject({ ok: true, diff: { changes: expect.any(Array) } });

    const requested = await lifecycle.requestPublish(
      {
        pageId: 'offline-overview',
        revisionId: second.revision.revisionId,
        idempotencyKey: 'publish-r2'
      },
      editor
    );
    expect(requested).toMatchObject({
      ok: true,
      request: { requestId: 'request-1', revisionId: 'revision-2' }
    });
    if (!requested.ok) return;

    const published = await lifecycle.confirmPublish(
      { requestId: requested.request.requestId, token: 'offline-token' },
      {
        actorId: 'developer-1',
        clientId: 'publish-confirmation',
        roles: ['publisher']
      }
    );
    expect(published).toMatchObject({
      ok: true,
      revision: { revisionId: 'revision-2' }
    });
    expect(await lifecycle.getPublished({ pageId: 'offline-overview' })).toEqual(published);
    await lifecycle.close();
  });

  it('进程重建后状态为空，避免伪装成持久化存储', async () => {
    const create = () =>
      createMemoryPageLifecycle({
        catalog: { current: async () => ({ version: 'catalog-offline', snapshot: catalog }) }
      });
    const first = create();
    const saved = await first.saveRevision(
      {
        pageId: 'offline-overview',
        baseRevisionId: null,
        document: page(),
        idempotencyKey: 'save-r1'
      },
      { actorId: 'developer-1', clientId: 'workbench' }
    );
    expect(saved.ok).toBe(true);
    await first.close();

    const reopened = create();
    expect(await reopened.listPages()).toEqual({ pages: [], nextPageId: null });
    await reopened.close();
  });
});
