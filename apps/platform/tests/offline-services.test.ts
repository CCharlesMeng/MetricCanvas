import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import { createMemoryTemplateLibrary } from '@metriccanvas/template-library';
import {
  seedPublishedPages,
  seedPublishedTemplates
} from '../src/lib/server/offline-services';

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-22T00:00:00.000Z',
  source: 'offline-test',
  metrics: [],
  dimensions: []
};

const page: Page = {
  schemaVersion: '1.0',
  id: 'bundled-page',
  dataSources: {
    content: {
      fields: { message: { type: 'string', role: 'dimension' } },
      source: { type: 'inline', rows: [{ message: '离线示例' }] }
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
          props: { heading: '内置页面', body: '离线示例' }
        }
      ]
    }
  ]
};

describe('离线页面种子', () => {
  it('把仓库页面导入为可由正式通道读取的已发布页面', async () => {
    const lifecycle = createMemoryPageLifecycle({
      catalog: { current: async () => ({ version: 'offline-v1', snapshot: catalog }) },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost/publish/${requestId}/confirm?token=${token}`
      }
    });

    await seedPublishedPages(lifecycle, [page]);

    await expect(lifecycle.getPublished({ pageId: page.id })).resolves.toMatchObject({
      ok: true,
      revision: { pageId: page.id, revisionNumber: 1, document: page }
    });
    await expect(lifecycle.listPages()).resolves.toMatchObject({
      pages: [
        {
          pageId: page.id,
          publishedRevision: { pageId: page.id }
        }
      ]
    });
  });

  it('发布只引用内置页面修订的离线页面模板', async () => {
    const generatedIds = [
      'page-revision',
      'page-request',
      'template-revision',
      'template-request'
    ];
    const lifecycle = createMemoryPageLifecycle({
      catalog: { current: async () => ({ version: 'offline-v1', snapshot: catalog }) },
      ids: { next: () => generatedIds.shift() ?? 'unexpected-id' },
      tokens: { next: () => 'offline-token' },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost/publish/${requestId}/confirm?token=${token}`
      }
    });
    await seedPublishedPages(lifecycle, [page]);
    const templates = createMemoryTemplateLibrary({
      pageLifecycle: lifecycle,
      ids: { next: () => generatedIds.shift() ?? 'unexpected-id' },
      tokens: { next: () => 'template-token' }
    });

    await seedPublishedTemplates(templates, lifecycle, [
      {
        templateId: 'bundled-overview',
        title: '内置经营概览',
        description: '离线搭建起点',
        tags: ['离线', '经营'],
        viewerSubjectIds: ['developer-1'],
        sourcePageId: page.id
      }
    ]);

    await expect(
      templates.search(
        { query: '经营', limit: 5 },
        { actorId: 'developer-1', clientId: 'workbench' }
      )
    ).resolves.toMatchObject({
      matches: [
        {
          templateId: 'bundled-overview',
          revision: {
            source: { pageId: page.id, revisionId: 'page-revision' }
          },
          sourcePageRevision: { revisionId: 'page-revision', document: page }
        }
      ]
    });
  });
});
