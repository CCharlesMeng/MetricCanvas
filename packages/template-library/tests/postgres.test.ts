import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer
} from '@testcontainers/postgresql';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import { createPostgresPageLifecycle } from '@metriccanvas/page-lifecycle';
import { createPostgresTemplateLibrary } from '@metriccanvas/template-library';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-23T00:00:00.000Z',
  source: 'template-postgres-test',
  metrics: [],
  dimensions: []
};

const page: Page = {
  schemaVersion: '1.0',
  id: 'regional-overview',
  dataSources: {},
  sections: [
    {
      id: 'overview',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'intro',
          type: 'text',
          layout: { span: 12 },
          props: { heading: '区域经营', body: '模板来源' }
        }
      ]
    }
  ]
};

describe('PostgreSQL 页面模板库', () => {
  let postgres: StartedPostgreSqlContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:17-alpine').start();
  }, 120_000);

  afterAll(async () => {
    await postgres.stop();
  });

  it('重开模块后仍能按模板 ACL 检索当前发布模板修订', async () => {
    const pageRevisionId = '018f6f22-6d57-7d45-8f53-3d26364f7001';
    const pagePublishId = '018f6f22-6d57-7d45-8f53-3d26364f7002';
    const pageRevision2Id = '018f6f22-6d57-7d45-8f53-3d26364f7003';
    const pageLifecycle = await createPostgresPageLifecycle({
      databaseUrl: postgres.getConnectionUri(),
      catalog: { current: async () => ({ version: 'catalog-v1', snapshot: catalog }) },
      ids: {
        next: (() => {
          const values = [pageRevisionId, pagePublishId, pageRevision2Id];
          return () => values.shift() ?? 'unexpected-page-id';
        })()
      },
      tokens: { next: () => 'page-token' }
    });
    const editor = { actorId: 'developer-1', clientId: 'workbench' };
    const savedPage = await pageLifecycle.saveRevision(
      {
        pageId: page.id,
        baseRevisionId: null,
        document: page,
        idempotencyKey: 'save-page'
      },
      editor
    );
    if (!savedPage.ok) throw new Error(savedPage.error.message);
    const pagePublish = await pageLifecycle.requestPublish(
      {
        pageId: page.id,
        revisionId: savedPage.revision.revisionId,
        idempotencyKey: 'publish-page'
      },
      editor
    );
    if (!pagePublish.ok) throw new Error(pagePublish.error.message);
    const publishedPage = await pageLifecycle.confirmPublish(
      { requestId: pagePublish.request.requestId, token: 'page-token' },
      {
        actorId: 'developer-1',
        clientId: 'publish-confirmation',
        roles: ['publisher']
      }
    );
    if (!publishedPage.ok) throw new Error(publishedPage.error.message);

    const templateRevisionId = '018f6f22-6d57-7d45-8f53-3d26364f7011';
    const templatePublishId = '018f6f22-6d57-7d45-8f53-3d26364f7012';
    const admin = {
      actorId: 'developer-1',
      clientId: 'management-console',
      roles: ['admin'] as const
    };
    const templates = await createPostgresTemplateLibrary({
      databaseUrl: postgres.getConnectionUri(),
      pageLifecycle,
      ids: {
        next: (() => {
          const values = [templateRevisionId, templatePublishId];
          return () => values.shift() ?? 'unexpected-template-id';
        })()
      },
      tokens: { next: () => 'template-token' }
    });
    const savedTemplate = await templates.saveRevision(
      {
        templateId: 'regional-overview',
        baseRevisionId: null,
        title: '区域经营模板',
        description: '按区域查看经营情况',
        tags: ['区域', '经营'],
        viewerSubjectIds: ['developer-1'],
        source: {
          pageId: page.id,
          revisionId: publishedPage.revision.revisionId
        },
        idempotencyKey: 'save-template'
      },
      admin
    );
    if (!savedTemplate.ok) throw new Error(savedTemplate.error.message);
    const requested = await templates.requestPublish(
      {
        templateId: 'regional-overview',
        revisionId: savedTemplate.revision.revisionId,
        idempotencyKey: 'publish-template'
      },
      admin
    );
    if (!requested.ok) throw new Error(requested.error.message);
    const confirmed = await templates.confirmPublish(
      { requestId: requested.request.requestId, token: 'template-token' },
      admin
    );
    expect(confirmed.ok).toBe(true);
    await templates.close();

    const newerPage = await pageLifecycle.saveRevision(
      {
        pageId: page.id,
        baseRevisionId: pageRevisionId,
        document: {
          ...page,
          sections: [
            {
              ...page.sections[0],
              components: [
                {
                  id: 'intro-new',
                  type: 'text',
                  layout: { span: 12 },
                  props: { heading: '区域经营（新）', body: '来源页面已更新' }
                }
              ]
            }
          ]
        },
        idempotencyKey: 'save-page-r2'
      },
      editor
    );
    expect(newerPage).toMatchObject({
      ok: true,
      revision: { revisionId: pageRevision2Id }
    });

    const reopened = await createPostgresTemplateLibrary({
      databaseUrl: postgres.getConnectionUri(),
      pageLifecycle
    });
    await expect(
      reopened.search(
        { query: '区域', limit: 5 },
        { actorId: 'developer-1', clientId: 'workbench' }
      )
    ).resolves.toMatchObject({
      matches: [
        {
          templateId: 'regional-overview',
          revision: { revisionId: templateRevisionId },
          sourcePageRevision: { revisionId: pageRevisionId, document: page }
        }
      ]
    });
    await expect(
      reopened.search(
        { query: '区域', limit: 5 },
        { actorId: 'other-user', clientId: 'workbench' }
      )
    ).resolves.toEqual({ matches: [] });
    await reopened.close();
    await pageLifecycle.close();
  }, 30_000);
});
