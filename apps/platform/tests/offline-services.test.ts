import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '@metriccanvas/page-lifecycle';
import {
  seedPublishedPages
} from '../src/lib/server/offline-services';

const page: Page = {
  schemaVersion: '6.0',
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
      components: [
        {
          id: 'intro',
          type: 'text',
          layout: { span: 12 },
          props: { title: '内置页面', body: '离线示例' }
        }
      ]
    }
  ]
};

describe('离线页面种子', () => {
  it('把仓库页面导入为可由正式通道读取的已发布页面', async () => {
    const lifecycle = createMemoryPageLifecycle({
      dataContext: { current: async () => ({ version: 'offline-v1' }) },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost/publish/${requestId}/confirm?token=${token}`
      }
    });

    await seedPublishedPages(lifecycle, [page]);

    await expect(lifecycle.getPublished({ pageId: page.id })).resolves.toMatchObject({
      ok: true,
      revision: {
        pageId: page.id,
        revisionNumber: 1,
        document: page,
        dataContextVersion: null
      }
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

});
