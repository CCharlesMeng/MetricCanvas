import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import { createMemoryTemplateLibrary } from '@metriccanvas/template-library';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-23T00:00:00.000Z',
  source: 'template-test',
  metrics: [],
  dimensions: []
};

const sourcePage: Page = {
  schemaVersion: '1.0',
  id: 'sales-overview',
  dataSources: {
    content: {
      fields: { message: { type: 'string', role: 'dimension' } },
      source: { type: 'inline', rows: [{ message: '经营概览' }] }
    }
  },
  sections: [
    {
      id: 'overview',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'intro',
          type: 'text',
          layout: { span: 12 },
          props: { heading: '经营概览', body: '模板来源' }
        }
      ]
    }
  ]
};

describe('进程内页面模板库', () => {
  it('发布模板后只向获授权用户返回冻结的已发布页面修订', async () => {
    const pageIds = ['page-r1', 'page-publish-1', 'page-r2'];
    const pageLifecycle = createMemoryPageLifecycle({
      catalog: { current: async () => ({ version: 'catalog-v1', snapshot: catalog }) },
      ids: { next: () => pageIds.shift() ?? 'unexpected-page-id' },
      tokens: { next: () => 'page-token' }
    });
    const editor = { actorId: 'developer-1', clientId: 'workbench' };
    const savedPage = await pageLifecycle.saveRevision(
      {
        pageId: sourcePage.id,
        baseRevisionId: null,
        document: sourcePage,
        idempotencyKey: 'save-source-r1'
      },
      editor
    );
    if (!savedPage.ok) throw new Error(savedPage.error.message);
    const pagePublish = await pageLifecycle.requestPublish(
      {
        pageId: sourcePage.id,
        revisionId: savedPage.revision.revisionId,
        idempotencyKey: 'publish-source-r1'
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

    const templateIds = ['template-r1', 'template-publish-1'];
    const templates = createMemoryTemplateLibrary({
      pageLifecycle,
      clock: { now: () => new Date('2026-07-23T08:00:00.000Z') },
      ids: { next: () => templateIds.shift() ?? 'unexpected-template-id' },
      tokens: { next: () => 'template-token' },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost:5174/templates/publish/${requestId}?token=${token}`
      }
    });
    const admin = {
      actorId: 'developer-1',
      clientId: 'management-console',
      roles: ['admin'] as const
    };
    const savedTemplate = await templates.saveRevision(
      {
        templateId: 'sales-overview',
        baseRevisionId: null,
        title: '经营概览模板',
        description: '用于快速搭建销售经营页面',
        tags: ['销售', '经营'],
        viewerSubjectIds: ['developer-1'],
        source: {
          pageId: sourcePage.id,
          revisionId: publishedPage.revision.revisionId
        },
        idempotencyKey: 'save-template-r1'
      },
      admin
    );
    expect(savedTemplate).toMatchObject({
      ok: true,
      revision: {
        revisionId: 'template-r1',
        revisionNumber: 1,
        source: { pageId: sourcePage.id, revisionId: 'page-r1' }
      }
    });
    if (!savedTemplate.ok) return;

    const requested = await templates.requestPublish(
      {
        templateId: 'sales-overview',
        revisionId: savedTemplate.revision.revisionId,
        idempotencyKey: 'publish-template-r1'
      },
      admin
    );
    expect(requested).toMatchObject({
      ok: true,
      request: {
        requestId: 'template-publish-1',
        revisionId: 'template-r1'
      }
    });
    if (!requested.ok) return;
    await expect(
      templates.confirmPublish(
        { requestId: requested.request.requestId, token: 'template-token' },
        admin
      )
    ).resolves.toMatchObject({
      ok: true,
      revision: { revisionId: 'template-r1' }
    });

    const newerPage = await pageLifecycle.saveRevision(
      {
        pageId: sourcePage.id,
        baseRevisionId: publishedPage.revision.revisionId,
        document: {
          ...sourcePage,
          sections: [
            {
              ...sourcePage.sections[0],
              components: [
                {
                  ...sourcePage.sections[0].components[0],
                  props: { heading: '经营概览（新）', body: '来源已变化' }
                }
              ]
            }
          ]
        },
        idempotencyKey: 'save-source-r2'
      },
      editor
    );
    expect(newerPage.ok).toBe(true);

    await expect(
      templates.search(
        { query: '经营', limit: 5 },
        { actorId: 'developer-1', clientId: 'workbench' }
      )
    ).resolves.toEqual({
      matches: [
        {
          templateId: 'sales-overview',
          revision: expect.objectContaining({
            revisionId: 'template-r1',
            title: '经营概览模板',
            tags: ['销售', '经营']
          }),
          sourcePageRevision: publishedPage.revision
        }
      ]
    });
    await expect(
      templates.search(
        { query: '经营', limit: 5 },
        { actorId: 'other-user', clientId: 'workbench' }
      )
    ).resolves.toEqual({ matches: [] });
  });

  it('拒绝未发布来源并用幂等键与基线维持线性模板修订', async () => {
    const pageIds = ['page-r1', 'page-publish-1'];
    const pageLifecycle = createMemoryPageLifecycle({
      catalog: { current: async () => ({ version: 'catalog-v1', snapshot: catalog }) },
      ids: { next: () => pageIds.shift() ?? 'unexpected-page-id' },
      tokens: { next: () => 'page-token' }
    });
    const editor = { actorId: 'developer-1', clientId: 'workbench' };
    const savedPage = await pageLifecycle.saveRevision(
      {
        pageId: sourcePage.id,
        baseRevisionId: null,
        document: sourcePage,
        idempotencyKey: 'save-source-r1'
      },
      editor
    );
    if (!savedPage.ok) throw new Error(savedPage.error.message);
    const templates = createMemoryTemplateLibrary({
      pageLifecycle,
      ids: { next: () => 'template-r1' }
    });
    const admin = {
      actorId: 'developer-1',
      clientId: 'management-console',
      roles: ['admin'] as const
    };
    const command = {
      templateId: 'sales-overview',
      baseRevisionId: null,
      title: '经营概览模板',
      viewerSubjectIds: ['developer-1'],
      source: {
        pageId: sourcePage.id,
        revisionId: savedPage.revision.revisionId
      },
      idempotencyKey: 'save-template-r1'
    };
    await expect(templates.saveRevision(command, admin)).resolves.toMatchObject({
      ok: false,
      error: { code: 'SOURCE_REVISION_NOT_PUBLISHED' }
    });

    const requested = await pageLifecycle.requestPublish(
      {
        pageId: sourcePage.id,
        revisionId: savedPage.revision.revisionId,
        idempotencyKey: 'publish-source-r1'
      },
      editor
    );
    if (!requested.ok) throw new Error(requested.error.message);
    await pageLifecycle.confirmPublish(
      { requestId: requested.request.requestId, token: 'page-token' },
      {
        actorId: 'developer-1',
        clientId: 'publish-confirmation',
        roles: ['publisher']
      }
    );

    const saved = await templates.saveRevision(command, admin);
    expect(saved).toMatchObject({
      ok: true,
      revision: { revisionId: 'template-r1', revisionNumber: 1 }
    });
    await expect(templates.saveRevision(command, admin)).resolves.toEqual(saved);
    await expect(
      templates.saveRevision(
        { ...command, title: '错误基线', idempotencyKey: 'save-template-conflict' },
        admin
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'TEMPLATE_REVISION_CONFLICT',
        currentLatestRevision: { revisionId: 'template-r1' }
      }
    });
  });
});
