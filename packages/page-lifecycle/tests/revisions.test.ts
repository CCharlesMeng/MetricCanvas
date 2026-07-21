import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createPostgresPageLifecycle } from '@metriccanvas/page-lifecycle';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-20T12:00:00.000Z',
  source: 'data-service-sim',
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

const context = { actorId: 'developer-1', clientId: 'workbench', roles: ['publisher'] as const };
let nextId = 100;

function revisionId(): string {
  nextId += 1;
  return `018f6f22-6d57-7d45-8f53-${nextId.toString(16).padStart(12, '0')}`;
}

function pageDocument(pageId: string, title = '成交总额') {
  return {
    schemaVersion: '1.0',
    id: pageId,
    dataSources: {
      sales: {
        fields: {
          gmv: { type: 'number' as const, role: 'metric' as const }
        },
        source: {
          type: 'query' as const,
          query: { metrics: ['gmv'], aggregation: 'sum' as const }
        }
      }
    },
    sections: [
      {
        id: 'overview',
        title,
        layout: { type: 'grid' as const, columns: 12 as const },
        components: [
          {
            id: 'w-gmv',
            type: 'metricCard' as const,
            layout: { span: 3 },
            data: { main: 'sales' },
            props: {
              rows: [{ label: '成交总额', valueField: 'gmv' }]
            }
          }
        ]
      }
    ]
  };
}

describe('页面生命周期:线性页面修订', () => {
  let postgres: StartedPostgreSqlContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:17-alpine').start();
  }, 120_000);

  afterAll(async () => {
    await postgres.stop();
  });

  function createLifecycle() {
    return createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: { current: async () => ({ version: 'catalog-v1', snapshot: catalog }) },
      clock: { now: () => new Date('2026-07-21T02:00:00.000Z') },
      ids: { next: revisionId },
      tokens: { next: () => 'publish-confirmation-token' }
    });
  }

  it('以精确最新基线追加 R2,并在重启后可按 selector 读取', async () => {
    const pageId = 'append-revision';
    const lifecycle = await createLifecycle();
    const first = await lifecycle.saveRevision(
      { pageId, baseRevisionId: null, document: pageDocument(pageId), idempotencyKey: 'append-r1' },
      context
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: first.revision.revisionId,
        document: pageDocument(pageId, '修订后的成交总额'),
        idempotencyKey: 'append-r2'
      },
      { actorId: 'developer-2', clientId: 'workbench' }
    );
    expect(second).toEqual({
      ok: true,
      revision: expect.objectContaining({
        revisionNumber: 2,
        baseRevisionId: first.revision.revisionId,
        createdBy: 'developer-2',
        metadataVersion: 'catalog-v1'
      })
    });
    await lifecycle.close();

    const reopened = await createLifecycle();
    const latest = await reopened.getPage({ pageId, selector: { type: 'latest' } });
    const exact = await reopened.getPage({
      pageId,
      selector: { type: 'exact', revisionId: second.ok ? second.revision.revisionId : '' }
    });
    const history = await reopened.listRevisionHistory({ pageId });
    await reopened.close();

    expect(latest).toEqual(second);
    expect(exact).toEqual(second);
    expect(history).toEqual({
      ok: true,
      history: {
        pageId,
        revisions: [
          expect.objectContaining({ revisionNumber: 2 }),
          expect.objectContaining({
            revisionNumber: 1,
            baseRevisionId: null,
            createdBy: 'developer-1'
          })
        ]
      }
    });
  }, 30_000);

  it('并发保存只接受一个最新基线,过期请求返回当前最新页面修订', async () => {
    const pageId = 'concurrent-revision';
    const firstLifecycle = await createLifecycle();
    const r1 = await firstLifecycle.saveRevision(
      { pageId, baseRevisionId: null, document: pageDocument(pageId), idempotencyKey: 'concurrent-r1' },
      context
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const secondLifecycle = await createLifecycle();
    const [left, right] = await Promise.all([
      firstLifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: r1.revision.revisionId,
          document: pageDocument(pageId, 'left'),
          idempotencyKey: 'concurrent-left'
        },
        context
      ),
      secondLifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: r1.revision.revisionId,
          document: pageDocument(pageId, 'right'),
          idempotencyKey: 'concurrent-right'
        },
        context
      )
    ]);
    await Promise.all([firstLifecycle.close(), secondLifecycle.close()]);

    const saved = [left, right].find((result) => result.ok);
    const conflicted = [left, right].find((result) => !result.ok);
    expect(saved).toMatchObject({ ok: true, revision: { revisionNumber: 2 } });
    expect(conflicted).toEqual({
      ok: false,
      error: {
        code: 'REVISION_CONFLICT',
        message: expect.stringContaining('保存基线不是当前最新页面修订'),
        currentLatestRevision: expect.objectContaining({
          revisionNumber: 2,
          revisionId: saved?.ok ? saved.revision.revisionId : undefined
        })
      }
    });
  }, 30_000);

  it('R2 相同幂等键只追加一次,重新打开后仍返回首次结果', async () => {
    const pageId = 'idempotent-append';
    const lifecycle = await createLifecycle();
    const r1 = await lifecycle.saveRevision(
      { pageId, baseRevisionId: null, document: pageDocument(pageId), idempotencyKey: 'idempotent-r1' },
      context
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const command = {
      pageId,
      baseRevisionId: r1.revision.revisionId,
      document: pageDocument(pageId, 'R2'),
      idempotencyKey: 'idempotent-r2'
    };
    const [first, retry] = await Promise.all([
      lifecycle.saveRevision(command, context),
      lifecycle.saveRevision(command, context)
    ]);
    await lifecycle.close();
    expect(first.ok).toBe(true);
    expect(retry).toEqual(first);
    if (!first.ok) return;

    const reopened = await createLifecycle();
    const loaded = await reopened.getRevision({
      pageId,
      revisionId: first.revision.revisionId
    });
    await reopened.close();
    expect(loaded).toEqual(first);
  }, 30_000);

  it('按 page id 分页列出引用,历史倒序,并返回稳定 JSON diff', async () => {
    const lifecycle = await createLifecycle();
    const pageIds = ['list-a', 'list-b', 'list-c'];
    const revisions = await Promise.all(
      pageIds.map((pageId) =>
        lifecycle.saveRevision(
          {
            pageId,
            baseRevisionId: null,
            document: pageDocument(pageId),
            idempotencyKey: `list-${pageId}`
          },
          context
        )
      )
    );
    expect(revisions.every((result) => result.ok)).toBe(true);
    const bR1 = revisions[1];
    if (!bR1.ok) return;
    const bR2 = await lifecycle.saveRevision(
      {
        pageId: 'list-b',
        baseRevisionId: bR1.revision.revisionId,
        document: {
          ...pageDocument('list-b', '新的标题'),
          sections: [
            {
              ...pageDocument('list-b', '新的标题').sections[0],
              components: [
                {
                  ...pageDocument('list-b').sections[0].components[0],
                  props: {
                    ...pageDocument('list-b').sections[0].components[0].props,
                    title: '指标卡标题'
                  }
                }
              ]
            }
          ]
        },
        idempotencyKey: 'list-b-r2'
      },
      context
    );
    expect(bR2.ok).toBe(true);
    if (!bR2.ok) return;

    const requested = await lifecycle.requestPublish(
      {
        pageId: 'list-b',
        revisionId: bR2.revision.revisionId,
        idempotencyKey: 'list-b-publish'
      },
      context
    );
    expect(requested.ok).toBe(true);
    if (!requested.ok) return;
    await lifecycle.confirmPublish(
      { requestId: requested.request.requestId, token: 'publish-confirmation-token' },
      context
    );

    const firstPage = await lifecycle.listPages({ afterPageId: 'list-', limit: 2 });
    const secondPage = await lifecycle.listPages({
      afterPageId: firstPage.nextPageId ?? '',
      limit: 2
    });
    const published = await lifecycle.getPage({
      pageId: 'list-b',
      selector: { type: 'published' }
    });
    const history = await lifecycle.listRevisionHistory({ pageId: 'list-b' });
    const diff = await lifecycle.diffRevisions({
      pageId: 'list-b',
      fromRevisionId: bR1.revision.revisionId,
      toRevisionId: bR2.revision.revisionId
    });
    await lifecycle.close();

    expect(firstPage).toEqual({
      pages: [
        {
          pageId: 'list-a',
          latestRevision: expect.objectContaining({ pageId: 'list-a' }),
          publishedRevision: null,
          catalogVisibility: 'visible'
        },
        {
          pageId: 'list-b',
          latestRevision: { pageId: 'list-b', revisionId: bR2.revision.revisionId },
          publishedRevision: { pageId: 'list-b', revisionId: bR2.revision.revisionId },
          catalogVisibility: 'visible'
        }
      ],
      nextPageId: 'list-b'
    });
    expect(secondPage.pages).toEqual([
      {
        pageId: 'list-c',
        latestRevision: expect.objectContaining({ pageId: 'list-c' }),
        publishedRevision: null,
        catalogVisibility: 'visible'
      }
    ]);
    expect(secondPage.nextPageId).toBeNull();
    expect(published).toEqual({
      ok: true,
      revision: expect.objectContaining({ revisionId: bR2.revision.revisionId })
    });
    expect(history).toEqual({
      ok: true,
      history: {
        pageId: 'list-b',
        revisions: [
          expect.objectContaining({ revisionNumber: 2 }),
          expect.objectContaining({ revisionNumber: 1 })
        ]
      }
    });
    expect(diff).toEqual({
      ok: true,
      diff: {
        pageId: 'list-b',
        fromRevisionId: bR1.revision.revisionId,
        toRevisionId: bR2.revision.revisionId,
        changes: [
          {
            op: 'add',
            path: '/sections/0/components/0/props/title',
            after: '指标卡标题'
          },
          {
            op: 'replace',
            path: '/sections/0/title',
            before: '成交总额',
            after: '新的标题'
          }
        ]
      }
    });
  }, 30_000);

  it('活动发布租约阻止以当前基线追加页面修订', async () => {
    const pageId = 'lease-blocks-save';
    const lifecycle = await createLifecycle();
    const r1 = await lifecycle.saveRevision(
      { pageId, baseRevisionId: null, document: pageDocument(pageId), idempotencyKey: 'lease-r1' },
      context
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const requested = await lifecycle.requestPublish(
      {
        pageId,
        revisionId: r1.revision.revisionId,
        idempotencyKey: 'lease-request'
      },
      context
    );
    expect(requested.ok).toBe(true);

    const blocked = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: r1.revision.revisionId,
        document: pageDocument(pageId, '不得保存'),
        idempotencyKey: 'lease-r2'
      },
      context
    );
    await lifecycle.close();

    expect(blocked).toEqual({
      ok: false,
      error: {
        code: 'PAGE_LOCKED',
        message: expect.stringContaining('活动发布租约')
      }
    });
  }, 30_000);
});
