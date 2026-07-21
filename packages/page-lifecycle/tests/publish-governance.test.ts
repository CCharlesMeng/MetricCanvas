import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { CatalogSnapshot } from '@metriccanvas/page';
import {
  createPostgresPageLifecycle,
  type LifecycleContext,
  type PageLifecycle,
  type PageRevision
} from '@metriccanvas/page-lifecycle';

const validCatalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-21T00:00:00.000Z',
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

const developer: LifecycleContext = {
  actorId: 'developer-1',
  clientId: 'mcp-opencode',
  roles: []
};
const publisher: LifecycleContext = {
  actorId: 'publisher-1',
  clientId: 'publish-confirmation',
  roles: ['publisher']
};
const admin: LifecycleContext = {
  actorId: 'admin-1',
  clientId: 'management-console',
  roles: ['admin']
};

function pageDocument(pageId: string, title: string) {
  return {
    schemaVersion: '1.0',
    id: pageId,
    dataSources: {
      sales: {
        fields: { gmv: { type: 'number' as const, role: 'metric' as const } },
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
            props: { rows: [{ label: '成交总额', valueField: 'gmv' }] }
          }
        ]
      }
    ]
  };
}

describe('页面生命周期:发布治理', () => {
  let postgres: StartedPostgreSqlContainer;
  let now: Date;
  let currentCatalog: CatalogSnapshot;
  let lifecycle: PageLifecycle;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:17-alpine').start();
    now = new Date('2026-07-21T03:00:00.000Z');
    currentCatalog = validCatalog;
    lifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: {
        current: async () => ({
          version: currentCatalog === validCatalog ? 'catalog-v1' : 'catalog-v2',
          snapshot: currentCatalog
        })
      },
      clock: { now: () => new Date(now) },
      tokens: { next: () => 'single-use-confirmation-token' },
      urls: {
        confirmation: (requestId, token) =>
          `https://platform.example/publish/${requestId}/confirm?token=${token}`
      }
    });
  }, 120_000);

  afterAll(async () => {
    await lifecycle?.close();
    await postgres?.stop();
  });

  async function save(pageId: string, title = 'R1'): Promise<PageRevision> {
    const result = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: pageDocument(pageId, title),
        idempotencyKey: `${pageId}-save-r1`
      },
      developer
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.revision;
  }

  async function request(pageId: string, revisionId: string, key: string) {
    const result = await lifecycle.requestPublish(
      { pageId, revisionId, idempotencyKey: key },
      developer
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.request;
  }

  it('确认 URL 不代表授权,具有 publisher 权限的人可批准且记录发起人、批准人和 MCP 客户端', async () => {
    const pageId = 'governance-approval';
    const revision = await save(pageId);
    const requested = await request(pageId, revision.revisionId, 'approval-request');
    const token = new URL(requested.confirmationUrl).searchParams.get('token') ?? '';

    const forbidden = await lifecycle.confirmPublish(
      { requestId: requested.requestId, token },
      developer
    );
    expect(forbidden).toEqual({
      ok: false,
      error: { code: 'PUBLISH_FORBIDDEN', message: '确认发布需要 publisher 权限' }
    });

    const [approved, duplicate] = await Promise.all([
      lifecycle.confirmPublish({ requestId: requested.requestId, token }, publisher),
      lifecycle.confirmPublish({ requestId: requested.requestId, token }, publisher)
    ]);
    expect([approved, duplicate].filter((result) => result.ok)).toHaveLength(1);
    expect([approved, duplicate].find((result) => !result.ok)).toEqual({
      ok: false,
      error: { code: 'PUBLISH_REQUEST_CLOSED', message: '发布请求已结束:published' }
    });

    const details = await lifecycle.getPublishRequest(
      { requestId: requested.requestId },
      publisher
    );
    expect(details).toEqual({
      ok: true,
      request: expect.objectContaining({
        requestedBy: 'developer-1',
        requestedClientId: 'mcp-opencode',
        status: 'published',
        decidedBy: 'publisher-1',
        decidedClientId: 'publish-confirmation',
        decidedAt: now.toISOString()
      })
    });
    const audit = await lifecycle.listPublishAudit(
      { requestId: requested.requestId },
      publisher
    );
    expect(audit).toEqual({
      ok: true,
      events: [
        expect.objectContaining({
          action: 'requested',
          actorId: 'developer-1',
          clientId: 'mcp-opencode'
        }),
        expect.objectContaining({
          action: 'approved',
          actorId: 'publisher-1',
          clientId: 'publish-confirmation'
        })
      ]
    });
  }, 30_000);

  it('拒绝、发起人取消和管理员强制释放都结束发布租约并可继续保存', async () => {
    const cases = [
      {
        pageId: 'governance-reject',
        status: 'rejected',
        close: (requestId: string) =>
          lifecycle.rejectPublish(
            {
              requestId,
              token: 'single-use-confirmation-token',
              reason: '指标口径待确认'
            },
            publisher
          )
      },
      {
        pageId: 'governance-cancel',
        status: 'cancelled',
        close: (requestId: string) =>
          lifecycle.cancelPublish({ requestId, reason: '发起人撤回' }, developer)
      },
      {
        pageId: 'governance-force-release',
        status: 'force_released',
        close: (requestId: string) =>
          lifecycle.forceReleasePublish({ requestId, reason: '异常会话清理' }, admin)
      }
    ] as const;

    for (const item of cases) {
      const r1 = await save(item.pageId);
      const pending = await request(item.pageId, r1.revisionId, `${item.pageId}-request`);
      const closed = await item.close(pending.requestId);
      expect(closed).toEqual({
        ok: true,
        request: expect.objectContaining({ status: item.status })
      });
      const r2 = await lifecycle.saveRevision(
        {
          pageId: item.pageId,
          baseRevisionId: r1.revisionId,
          document: pageDocument(item.pageId, 'R2'),
          idempotencyKey: `${item.pageId}-save-r2`
        },
        developer
      );
      expect(r2).toEqual({
        ok: true,
        revision: expect.objectContaining({ revisionNumber: 2, baseRevisionId: r1.revisionId })
      });
      const audit = await lifecycle.listPublishAudit({ requestId: pending.requestId }, admin);
      expect(audit).toEqual({
        ok: true,
        events: [
          expect.objectContaining({ action: 'requested' }),
          expect.objectContaining({ action: item.status })
        ]
      });
    }
  }, 30_000);

  it('并发保存与申请发布串行化为“新修订优先”或“发布租约优先”', async () => {
    const pageId = 'governance-save-publish-race';
    const r1 = await save(pageId);
    const [saved, requested] = await Promise.all([
      lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: r1.revisionId,
          document: pageDocument(pageId, 'R2 race'),
          idempotencyKey: 'race-save-r2'
        },
        developer
      ),
      lifecycle.requestPublish(
        { pageId, revisionId: r1.revisionId, idempotencyKey: 'race-publish-r1' },
        developer
      )
    ]);

    if (saved.ok) {
      expect(requested).toEqual({
        ok: false,
        error: {
          code: 'REVISION_NOT_LATEST',
          message: expect.stringContaining('发布只能针对当前最新页面修订')
        }
      });
    } else {
      expect(saved).toEqual({
        ok: false,
        error: { code: 'PAGE_LOCKED', message: expect.stringContaining('活动发布租约') }
      });
      expect(requested.ok).toBe(true);
      if (requested.ok) {
        await lifecycle.cancelPublish(
          { requestId: requested.request.requestId, reason: '清理并发测试租约' },
          developer
        );
      }
    }
  }, 30_000);

  it('15 分钟超时与并发保存只释放一次,活动期间读取和精确预览对应的读取 seam 不受影响', async () => {
    const pageId = 'governance-expiry';
    const r1 = await save(pageId);
    const pending = await request(pageId, r1.revisionId, 'expiry-request');

    const blocked = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: r1.revisionId,
        document: pageDocument(pageId, 'blocked'),
        idempotencyKey: 'expiry-blocked-save'
      },
      developer
    );
    expect(blocked).toEqual({
      ok: false,
      error: { code: 'PAGE_LOCKED', message: expect.stringContaining('活动发布租约') }
    });
    await expect(
      Promise.all([
        lifecycle.getPage({ pageId, selector: { type: 'latest' } }),
        lifecycle.getRevision({ pageId, revisionId: r1.revisionId })
      ])
    ).resolves.toEqual([
      { ok: true, revision: r1 },
      { ok: true, revision: r1 }
    ]);

    now = new Date('2026-07-21T03:15:00.000Z');
    const [details, saved] = await Promise.all([
      lifecycle.getPublishRequest({ requestId: pending.requestId }, developer),
      lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: r1.revisionId,
          document: pageDocument(pageId, 'R2 after expiry'),
          idempotencyKey: 'expiry-save-r2'
        },
        developer
      )
    ]);
    expect(details).toEqual({
      ok: true,
      request: expect.objectContaining({ status: 'expired' })
    });
    expect(saved).toEqual({
      ok: true,
      revision: expect.objectContaining({ revisionNumber: 2 })
    });
    const audit = await lifecycle.listPublishAudit({ requestId: pending.requestId }, admin);
    expect(audit.ok && audit.events.filter((event) => event.action === 'expired')).toHaveLength(1);
  }, 30_000);

  it('批准前用最新元数据复验,失败不改当前发布修订;回滚复制旧内容产生新修订并重走发布', async () => {
    now = new Date('2026-07-21T04:00:00.000Z');
    currentCatalog = validCatalog;
    const pageId = 'governance-revalidate-rollback';
    const r1 = await save(pageId, 'R1 original');
    const firstRequest = await request(pageId, r1.revisionId, 'publish-r1');
    const firstPublished = await lifecycle.confirmPublish(
      { requestId: firstRequest.requestId, token: 'single-use-confirmation-token' },
      publisher
    );
    expect(firstPublished.ok).toBe(true);

    const r2Result = await lifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: r1.revisionId,
        document: pageDocument(pageId, 'R2 changed'),
        idempotencyKey: 'save-r2-before-revalidation'
      },
      developer
    );
    expect(r2Result.ok).toBe(true);
    if (!r2Result.ok) return;
    const r2 = r2Result.revision;
    const secondRequest = await request(pageId, r2.revisionId, 'publish-r2');
    currentCatalog = { ...validCatalog, metrics: [] };
    const validationFailed = await lifecycle.confirmPublish(
      { requestId: secondRequest.requestId, token: 'single-use-confirmation-token' },
      publisher
    );
    expect(validationFailed).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'METRIC_GAP', message: '页面修订未通过发布复验' })
    });
    expect(await lifecycle.getPublished({ pageId })).toEqual({ ok: true, revision: r1 });

    currentCatalog = validCatalog;
    const [rollback, retry] = await Promise.all([
      lifecycle.rollbackRevision(
        { pageId, targetRevisionId: r1.revisionId, idempotencyKey: 'rollback-to-r1' },
        developer
      ),
      lifecycle.rollbackRevision(
        { pageId, targetRevisionId: r1.revisionId, idempotencyKey: 'rollback-to-r1' },
        developer
      )
    ]);
    expect(rollback).toEqual(retry);
    expect(rollback).toEqual({
      ok: true,
      revision: expect.objectContaining({
        revisionNumber: 3,
        baseRevisionId: r2.revisionId,
        document: r1.document
      })
    });
    if (!rollback.ok) return;
    const rollbackRequest = await request(
      pageId,
      rollback.revision.revisionId,
      'publish-rollback-r3'
    );
    const rollbackPublished = await lifecycle.confirmPublish(
      { requestId: rollbackRequest.requestId, token: 'single-use-confirmation-token' },
      publisher
    );
    expect(rollbackPublished).toEqual(rollback);
    expect(await lifecycle.getPublished({ pageId })).toEqual(rollback);
  }, 30_000);
});
