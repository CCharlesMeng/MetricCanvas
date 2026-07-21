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
      availableAggregations: ['sum', 'avg']
    }
  ],
  dimensions: []
};

const document = {
  formatVersion: '1.0',
  id: 'sales-total',
  title: '成交总额',
  layout: { type: 'grid', columns: 12 },
  widgets: [
    {
      id: 'w-gmv',
      type: 'metricCard',
      position: { x: 0, y: 0, w: 3, h: 2 },
      query: { metrics: ['gmv'], aggregation: 'sum' }
    }
  ]
};

describe('页面生命周期:首次保存', () => {
  let postgres: StartedPostgreSqlContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:17-alpine').start();
  }, 120_000);

  afterAll(async () => {
    await postgres.stop();
  });

  it('把合法当前格式页面保存为不可变 R1,重开模块后仍能按修订读取', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c32';
    const options = {
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: { next: () => revisionId }
    };
    const lifecycle = await createPostgresPageLifecycle(options);

    const saved = await lifecycle.saveRevision(
      {
        pageId: 'sales-total',
        baseRevisionId: null,
        document,
        idempotencyKey: 'save-sales-total-r1'
      },
      { actorId: 'developer-1', clientId: 'workbench' }
    );
    await lifecycle.close();

    expect(saved).toEqual({
      ok: true,
      revision: expect.objectContaining({
        revisionId,
        revisionNumber: 1,
        pageId: 'sales-total',
        baseRevisionId: null,
        document,
        metadataVersion: 'catalog-v1',
        createdBy: 'developer-1',
        createdAt: '2026-07-20T12:30:00.000Z'
      })
    });

    const reopened = await createPostgresPageLifecycle({
      ...options,
      ids: {
        next: () => {
          throw new Error('读取不应生成新 id');
        }
      }
    });
    const loaded = await reopened.getRevision({ pageId: 'sales-total', revisionId });
    await reopened.close();

    expect(loaded).toEqual(saved);
  }, 30_000);

  it('为 R1 取得 15 分钟发布租约,人工确认后正式通道读取同一修订', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c33';
    const requestId = '018f6f22-6d57-7d45-8f53-3d26364f6c34';
    const generatedIds = [revisionId, requestId];
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: {
        next: () => {
          const next = generatedIds.shift();
          if (!next) throw new Error('生成了计划外的 id');
          return next;
        }
      },
      tokens: { next: () => 'publish-confirmation-secret' },
      urls: {
        confirmation: (id, token) =>
          `https://platform.example/publish/${id}/confirm?token=${encodeURIComponent(token)}`
      }
    });
    const context = { actorId: 'developer-1', clientId: 'workbench' };

    const saved = await lifecycle.saveRevision(
      {
        pageId: 'sales-total-published',
        baseRevisionId: null,
        document: { ...document, id: 'sales-total-published' },
        idempotencyKey: 'save-sales-total-published-r1'
      },
      context
    );
    expect(saved.ok).toBe(true);

    const requested = await lifecycle.requestPublish(
      {
        pageId: 'sales-total-published',
        revisionId,
        idempotencyKey: 'publish-sales-total-r1'
      },
      context
    );
    expect(requested).toEqual({
      ok: true,
      request: {
        requestId,
        pageId: 'sales-total-published',
        revisionId,
        expiresAt: '2026-07-20T12:45:00.000Z',
        confirmationUrl:
          `https://platform.example/publish/${requestId}/confirm?token=publish-confirmation-secret`
      }
    });

    const pendingRequest = await lifecycle.getPublishRequest(
      { requestId },
      context
    );
    expect(pendingRequest).toEqual({
      ok: true,
      request: {
        requestId,
        pageId: 'sales-total-published',
        revisionId,
        requestedBy: 'developer-1',
        status: 'pending',
        expiresAt: '2026-07-20T12:45:00.000Z'
      }
    });

    const beforeConfirmation = await lifecycle.getPublished({ pageId: 'sales-total-published' });
    expect(beforeConfirmation).toEqual({
      ok: false,
      error: {
        code: 'PAGE_NOT_PUBLISHED',
        message: '看板页面尚未发布:sales-total-published'
      }
    });

    const token = new URL(requested.ok ? requested.request.confirmationUrl : '').searchParams.get(
      'token'
    );
    const confirmed = await lifecycle.confirmPublish(
      { requestId, token: token ?? '' },
      context
    );
    const published = await lifecycle.getPublished({ pageId: 'sales-total-published' });
    const duplicateConfirmation = await lifecycle.confirmPublish(
      { requestId, token: token ?? '' },
      context
    );
    await lifecycle.close();

    expect(confirmed).toEqual(saved);
    expect(published).toEqual(saved);
    expect(duplicateConfirmation).toEqual({
      ok: false,
      error: {
        code: 'PUBLISH_REQUEST_CLOSED',
        message: '发布请求已结束:published'
      }
    });
  }, 30_000);

  it('METRIC_GAP 阻止保存且不占用页面 id', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c35';
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: { next: () => revisionId }
    });
    const context = { actorId: 'developer-1', clientId: 'workbench' };
    const pageId = 'metric-gap-retry';

    const rejected = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: {
          ...document,
          id: pageId,
          widgets: [
            {
              ...document.widgets[0],
              query: { metrics: ['missing-metric'], aggregation: 'sum' }
            }
          ]
        },
        idempotencyKey: 'save-metric-gap'
      },
      context
    );
    expect(rejected).toEqual({
      ok: false,
      error: {
        code: 'METRIC_GAP',
        message: '页面文档未通过校验',
        validationErrors: [
          expect.objectContaining({
            type: 'METRIC_GAP',
            path: '/widgets/0/query/metrics/0'
          })
        ]
      }
    });

    const saved = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: { ...document, id: pageId },
        idempotencyKey: 'save-metric-gap-retry'
      },
      context
    );
    await lifecycle.close();

    expect(saved).toEqual({
      ok: true,
      revision: expect.objectContaining({ revisionId, revisionNumber: 1, pageId })
    });
  }, 30_000);

  it('并发重试同一幂等键只创建一个 R1,两次调用返回同一结果', async () => {
    const generatedIds = [
      '018f6f22-6d57-7d45-8f53-3d26364f6c36',
      '018f6f22-6d57-7d45-8f53-3d26364f6c37'
    ];
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: {
        next: () => {
          const next = generatedIds.shift();
          if (!next) throw new Error('生成了计划外的 id');
          return next;
        }
      }
    });
    const pageId = 'idempotent-create';
    const command = {
      pageId,
      baseRevisionId: null,
      document: { ...document, id: pageId },
      idempotencyKey: 'same-save-request'
    };
    const context = { actorId: 'developer-1', clientId: 'workbench' };

    const [first, retry] = await Promise.all([
      lifecycle.saveRevision(command, context),
      lifecycle.saveRevision(command, context)
    ]);
    await lifecycle.close();

    expect(first.ok).toBe(true);
    expect(retry).toEqual(first);
  }, 30_000);

  it('并发重试 request_publish 返回同一个发布租约', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c38';
    const generatedIds = [
      revisionId,
      '018f6f22-6d57-7d45-8f53-3d26364f6c39',
      '018f6f22-6d57-7d45-8f53-3d26364f6c3a',
      '018f6f22-6d57-7d45-8f53-3d26364f6c3b',
      '018f6f22-6d57-7d45-8f53-3d26364f6c3c',
      '018f6f22-6d57-7d45-8f53-3d26364f6c3d'
    ];
    const generatedTokens = [
      'publish-token-1',
      'publish-token-2',
      'publish-token-3',
      'publish-token-4',
      'publish-token-5'
    ];
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: {
        next: () => {
          const next = generatedIds.shift();
          if (!next) throw new Error('生成了计划外的 id');
          return next;
        }
      },
      tokens: {
        next: () => {
          const next = generatedTokens.shift();
          if (!next) throw new Error('生成了计划外的 token');
          return next;
        }
      }
    });
    const context = { actorId: 'developer-1', clientId: 'workbench' };
    const pageId = 'idempotent-publish';
    await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: { ...document, id: pageId },
        idempotencyKey: 'save-before-idempotent-publish'
      },
      context
    );
    const command = {
      pageId,
      revisionId,
      idempotencyKey: 'same-publish-request'
    };

    const [first, ...retries] = await Promise.all(
      Array.from({ length: 5 }, () => lifecycle.requestPublish(command, context))
    );
    await lifecycle.close();

    expect(first.ok).toBe(true);
    expect(retries).toEqual([first, first, first, first]);
  }, 30_000);

  it('首次保存只接受 null 基线,错误基线不产生页面', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c3e';
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-v1', snapshot: catalog })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: { next: () => revisionId }
    });
    const pageId = 'create-requires-null-base';
    const context = { actorId: 'developer-1', clientId: 'workbench' };

    const rejected = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: '018f6f22-6d57-7d45-8f53-3d26364f6cff',
        document: { ...document, id: pageId },
        idempotencyKey: 'save-with-wrong-base'
      },
      context
    );
    expect(rejected).toEqual({
      ok: false,
      error: {
        code: 'REVISION_CONFLICT',
        message: '首次保存的 baseRevisionId 必须为 null'
      }
    });

    const saved = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: { ...document, id: pageId },
        idempotencyKey: 'save-with-null-base'
      },
      context
    );
    await lifecycle.close();

    expect(saved).toEqual({
      ok: true,
      revision: expect.objectContaining({ revisionId, revisionNumber: 1, pageId })
    });
  }, 30_000);

  it('成功写入的幂等重试返回首次结果,不受后来元数据变化影响', async () => {
    const revisionId = '018f6f22-6d57-7d45-8f53-3d26364f6c3f';
    let currentSnapshot = catalog;
    const lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({ version: 'catalog-current', snapshot: currentSnapshot })
      },
      clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
      ids: { next: () => revisionId }
    });
    const pageId = 'idempotency-before-revalidation';
    const command = {
      pageId,
      baseRevisionId: null,
      document: { ...document, id: pageId },
      idempotencyKey: 'save-before-catalog-change'
    };
    const context = { actorId: 'developer-1', clientId: 'workbench' };

    const first = await lifecycle.saveRevision(command, context);
    currentSnapshot = { ...catalog, metrics: [] };
    const retry = await lifecycle.saveRevision(command, context);
    await lifecycle.close();

    expect(first.ok).toBe(true);
    expect(retry).toEqual(first);
  }, 30_000);

  it('页面内容哈希使用 canonical JSON,不受对象属性顺序影响', async () => {
    const secondPostgres = await new PostgreSqlContainer('postgres:17-alpine').start();
    const pageId = 'canonical-content-hash';
    const reorderedDocument = {
      widgets: [
        {
          query: { aggregation: 'sum', metrics: ['gmv'] },
          position: { h: 2, w: 3, y: 0, x: 0 },
          type: 'metricCard',
          id: 'w-gmv'
        }
      ],
      layout: { columns: 12, type: 'grid' },
      title: '成交总额',
      id: pageId,
      formatVersion: '1.0'
    };
    const makeLifecycle = (databaseUrl: string, revisionId: string) =>
      createPostgresPageLifecycle({
        databaseUrl,
        catalog: {
          current: async () => ({ version: 'catalog-v1', snapshot: catalog })
        },
        clock: { now: () => new Date('2026-07-20T12:30:00.000Z') },
        ids: { next: () => revisionId }
      });
    const firstLifecycle = await makeLifecycle(
      postgres.getConnectionUri(),
      '018f6f22-6d57-7d45-8f53-3d26364f6c40'
    );
    const secondLifecycle = await makeLifecycle(
      secondPostgres.getConnectionUri(),
      '018f6f22-6d57-7d45-8f53-3d26364f6c41'
    );
    const context = { actorId: 'developer-1', clientId: 'workbench' };

    try {
      const first = await firstLifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document: { ...document, id: pageId },
          idempotencyKey: 'canonical-first'
        },
        context
      );
      const second = await secondLifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document: reorderedDocument,
          idempotencyKey: 'canonical-second'
        },
        context
      );
      if (!first.ok || !second.ok) throw new Error('页面保存失败');

      expect(first.revision.contentHash).toBe(second.revision.contentHash);
    } finally {
      await Promise.all([firstLifecycle.close(), secondLifecycle.close()]);
      await secondPostgres.stop();
    }
  }, 30_000);
});
