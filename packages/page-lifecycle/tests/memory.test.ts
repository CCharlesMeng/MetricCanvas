import { describe, expect, it } from 'vitest';
import type { Page, PageDocument } from '@metriccanvas/page';
import { createMemoryPageLifecycle } from '../src/memory';

const inlinePage: Page = {
  schemaVersion: '4.0',
  id: 'inline-page',
  dataSources: {
    summary: {
      fields: {
        value: { type: 'number', role: 'measure', nullable: false }
      },
      source: { type: 'inline', rows: [{ value: 1 }] }
    }
  },
  sections: [{
    id: 'overview',
    layout: { type: 'grid', columns: 12 },
    components: [{
      id: 'card',
      type: 'metricCard',
      layout: { span: 4 },
      data: { main: 'summary' },
      props: { rows: [{ label: '值', valueField: 'value' }] }
    }]
  }]
};

const dqePage: Page = {
  ...inlinePage,
  id: 'dqe-page',
  dataSources: {
    summary: {
      fields: {
        value: {
          queryField: '值',
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
              output_dims: [],
              output_metrics: ['值'],
              filter: { dims: [], metrics: [] },
              order: {}
            }]
          }
        }
      }
    }
  }
};

const groupedDqePage: PageDocument = {
  ...dqePage,
  id: 'grouped-dqe-page',
  dataSources: {
    summary: {
      fields: {
        measures: {
          value: { queryField: '值', type: 'number' }
        }
      },
      source: {
        type: 'query',
        query: {
          language: 'dqe',
          body: {
            dsl_list: [{
              output_dims: [],
              output_metrics: ['值'],
              filter: { dims: [], metrics: [] },
              order: {}
            }]
          }
        }
      }
    }
  }
};

function lifecycle() {
  let sequence = 0;
  return createMemoryPageLifecycle({
    dataContext: { current: async () => ({ version: 'context-2026-07-31' }) },
    ids: { next: () => `id-${++sequence}` },
    tokens: { next: () => 'token' },
    urls: {
      confirmation: (requestId, token) =>
        `http://localhost/publish/${requestId}?token=${token}`
    }
  });
}

describe('v4 页面生命周期', () => {
  it('保存按角色分组的自包含文档，不回写解析后的展开形式', async () => {
    const saved = await lifecycle().saveRevision(
      {
        pageId: groupedDqePage.id,
        baseRevisionId: null,
        document: groupedDqePage,
        idempotencyKey: 'grouped-r1',
        pageIdConfirmed: true
      },
      { actorId: 'author', clientId: 'test' }
    );

    expect(saved).toMatchObject({
      ok: true,
      revision: {
        document: {
          dataSources: {
            summary: {
              fields: {
                measures: {
                  value: { queryField: '值', type: 'number' }
                }
              }
            }
          }
        }
      }
    });
  });

  it('纯 inline 修订不记录数据上下文版本，DQE 修订记录当前版本', async () => {
    const service = lifecycle();
    const context = { actorId: 'author', clientId: 'test' };
    const inline = await service.saveRevision(
      {
        pageId: inlinePage.id,
        baseRevisionId: null,
        document: inlinePage,
        idempotencyKey: 'inline-r1',
        pageIdConfirmed: true
      },
      context
    );
    const dqe = await service.saveRevision(
      {
        pageId: dqePage.id,
        baseRevisionId: null,
        document: dqePage,
        idempotencyKey: 'dqe-r1',
        pageIdConfirmed: true
      },
      context
    );
    expect(inline).toMatchObject({
      ok: true,
      revision: { dataContextVersion: null }
    });
    expect(dqe).toMatchObject({
      ok: true,
      revision: { dataContextVersion: 'context-2026-07-31' }
    });
  });

  it('拒绝旧版本，并保持保存、发布和读取链路', async () => {
    const service = lifecycle();
    const author = { actorId: 'author', clientId: 'test' };
    await expect(
      service.saveRevision(
        {
          pageId: 'legacy',
          baseRevisionId: null,
          document: { ...inlinePage, id: 'legacy', schemaVersion: '2.0' },
          idempotencyKey: 'legacy-r1',
          pageIdConfirmed: true
        },
        author
      )
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_PAGE' } });

    const saved = await service.saveRevision(
      {
        pageId: inlinePage.id,
        baseRevisionId: null,
        document: inlinePage,
        idempotencyKey: 'inline-r1',
        pageIdConfirmed: true
      },
      author
    );
    if (!saved.ok) throw new Error(saved.error.message);
    const requested = await service.requestPublish(
      {
        pageId: inlinePage.id,
        revisionId: saved.revision.revisionId,
        idempotencyKey: 'publish-r1'
      },
      author
    );
    if (!requested.ok) throw new Error(requested.error.message);
    const published = await service.confirmPublish(
      { requestId: requested.request.requestId, token: 'token' },
      { ...author, roles: ['publisher'] }
    );
    expect(published).toMatchObject({
      ok: true,
      revision: { pageId: inlinePage.id }
    });
    await expect(service.getPublished({ pageId: inlinePage.id })).resolves.toMatchObject({
      ok: true,
      revision: { pageId: inlinePage.id }
    });
  });

  it('首次保存必须显式确认页面 id，追加修订不受影响', async () => {
    const service = lifecycle();
    const author = { actorId: 'author', clientId: 'test' };

    await expect(
      service.saveRevision(
        {
          pageId: inlinePage.id,
          baseRevisionId: null,
          document: inlinePage,
          idempotencyKey: 'unconfirmed-r1'
        },
        author
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'PAGE_ID_CONFIRMATION_REQUIRED',
        message: `首次保存前必须确认页面 id ${inlinePage.id}`
      }
    });

    const saved = await service.saveRevision(
      {
        pageId: inlinePage.id,
        baseRevisionId: null,
        document: inlinePage,
        idempotencyKey: 'confirmed-r1',
        pageIdConfirmed: true
      },
      author
    );
    if (!saved.ok) throw new Error(saved.error.message);

    const appended = await service.saveRevision(
      {
        pageId: inlinePage.id,
        baseRevisionId: saved.revision.revisionId,
        document: inlinePage,
        idempotencyKey: 'confirmed-r2'
      },
      author
    );
    expect(appended.ok).toBe(true);
  });
});
