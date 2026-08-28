import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MySqlContainer,
  type StartedMySqlContainer
} from '@testcontainers/mysql';
import type { Page } from '@metriccanvas/page';
import { runTemplateLibraryContract } from '@metriccanvas/template-library/testing';
import {
  createMySqlPageLifecycle,
  createMySqlTemplateLibrary
} from '../src/index';
import { applyMySqlTestSchema } from './schema';

const page: Page = {
  schemaVersion: '5.0',
  id: 'mysql-regional-overview',
  dataSources: {},
  sections: [
    {
      id: 'overview',
      components: [
        {
          id: 'intro',
          type: 'text',
          layout: { span: 12 },
          props: { title: '区域经营', body: '模板来源' }
        }
      ]
    }
  ]
};

describe.runIf(process.env.TEST_MYSQL === '1')('MySQL 页面模板库', () => {
  let mysql: StartedMySqlContainer;

  beforeAll(async () => {
    mysql = await new MySqlContainer('mysql:8.0').start();
    await applyMySqlTestSchema(mysql.getConnectionUri());
  }, 120_000);

  afterAll(async () => {
    await mysql?.stop();
  });

  runTemplateLibraryContract({
    create: async (options) =>
      createMySqlTemplateLibrary({
        databaseUrl: mysql.getConnectionUri(),
        ...options
      })
  });

  it('重开 adapter 后仍按模板 ACL 检索精确的已发布来源修订', async () => {
    const pageRevisionId = crypto.randomUUID();
    const pagePublishId = crypto.randomUUID();
    const newerPageRevisionId = crypto.randomUUID();
    const pageLifecycle = await createMySqlPageLifecycle({
      databaseUrl: mysql.getConnectionUri(),
      dataContext: { current: async () => ({ version: 'context-v1' }) },
      ids: {
        next: (() => {
          const values = [pageRevisionId, pagePublishId, newerPageRevisionId];
          return () => values.shift() ?? crypto.randomUUID();
        })()
      },
      tokens: { next: () => 'page-token' }
    });
    const editor = { actorId: 'developer-mysql', clientId: 'workbench' };
    const savedPage = await pageLifecycle.saveRevision(
      {
        pageId: page.id,
        baseRevisionId: null,
        document: page,
        idempotencyKey: 'mysql-reopen-save-page',
        pageIdConfirmed: true
      },
      editor
    );
    if (!savedPage.ok) throw new Error(savedPage.error.message);
    const pagePublish = await pageLifecycle.requestPublish(
      {
        pageId: page.id,
        revisionId: savedPage.revision.revisionId,
        idempotencyKey: 'mysql-reopen-publish-page'
      },
      editor
    );
    if (!pagePublish.ok) throw new Error(pagePublish.error.message);
    const publishedPage = await pageLifecycle.confirmPublish(
      { requestId: pagePublish.request.requestId, token: 'page-token' },
      {
        actorId: 'developer-mysql',
        clientId: 'publish-confirmation',
        roles: ['publisher']
      }
    );
    if (!publishedPage.ok) throw new Error(publishedPage.error.message);

    const templateRevisionId = crypto.randomUUID();
    const templatePublishId = crypto.randomUUID();
    const admin = {
      actorId: 'developer-mysql',
      clientId: 'management-console',
      roles: ['admin'] as const
    };
    const templates = await createMySqlTemplateLibrary({
      databaseUrl: mysql.getConnectionUri(),
      pageLifecycle,
      ids: {
        next: (() => {
          const values = [templateRevisionId, templatePublishId];
          return () => values.shift() ?? crypto.randomUUID();
        })()
      },
      tokens: { next: () => 'template-token' }
    });
    const savedTemplate = await templates.saveRevision(
      {
        templateId: 'mysql-regional-overview',
        baseRevisionId: null,
        title: '区域经营模板',
        description: '按区域查看经营情况',
        tags: ['区域', '经营'],
        viewerSubjectIds: ['developer-mysql'],
        source: {
          pageId: page.id,
          revisionId: publishedPage.revision.revisionId
        },
        idempotencyKey: 'mysql-reopen-save-template'
      },
      admin
    );
    if (!savedTemplate.ok) throw new Error(savedTemplate.error.message);
    const requested = await templates.requestPublish(
      {
        templateId: 'mysql-regional-overview',
        revisionId: savedTemplate.revision.revisionId,
        idempotencyKey: 'mysql-reopen-publish-template'
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
                  props: { title: '区域经营（新）', body: '来源页面已更新' }
                }
              ]
            }
          ]
        },
        idempotencyKey: 'mysql-reopen-save-page-r2'
      },
      editor
    );
    expect(newerPage).toMatchObject({
      ok: true,
      revision: { revisionId: newerPageRevisionId }
    });

    const reopened = await createMySqlTemplateLibrary({
      databaseUrl: mysql.getConnectionUri(),
      pageLifecycle
    });
    await expect(
      reopened.search(
        { query: '区域', limit: 5 },
        { actorId: 'developer-mysql', clientId: 'workbench' }
      )
    ).resolves.toMatchObject({
      matches: [
        {
          templateId: 'mysql-regional-overview',
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

  it('首次保存、同基线保存与同幂等键并发时保持单线性模板修订链', async () => {
    const pageId = 'mysql-template-concurrency-source';
    const sourcePage: Page = { ...page, id: pageId };
    const pageLifecycle = await createMySqlPageLifecycle({
      databaseUrl: mysql.getConnectionUri(),
      dataContext: { current: async () => ({ version: 'context-v1' }) },
      tokens: { next: () => 'mysql-template-concurrency-page-token' }
    });
    const author = { actorId: 'mysql-template-admin', clientId: 'workbench' };
    const savedPage = await pageLifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: sourcePage,
        idempotencyKey: 'mysql-template-concurrency-source-save',
        pageIdConfirmed: true
      },
      author
    );
    if (!savedPage.ok) throw new Error(savedPage.error.message);
    const requestedPage = await pageLifecycle.requestPublish(
      {
        pageId,
        revisionId: savedPage.revision.revisionId,
        idempotencyKey: 'mysql-template-concurrency-source-publish'
      },
      author
    );
    if (!requestedPage.ok) throw new Error(requestedPage.error.message);
    const publishedPage = await pageLifecycle.confirmPublish(
      {
        requestId: requestedPage.request.requestId,
        token: 'mysql-template-concurrency-page-token'
      },
      { ...author, roles: ['publisher'] }
    );
    if (!publishedPage.ok) throw new Error(publishedPage.error.message);

    const library = await createMySqlTemplateLibrary({
      databaseUrl: mysql.getConnectionUri(),
      pageLifecycle
    });
    const libraryPeer = await createMySqlTemplateLibrary({
      databaseUrl: mysql.getConnectionUri(),
      pageLifecycle
    });
    const admin = {
      actorId: 'mysql-template-admin',
      clientId: 'management-console',
      roles: ['admin'] as const
    };
    const command = {
      templateId: 'mysql-template-concurrency',
      baseRevisionId: null,
      title: '并发模板',
      viewerSubjectIds: [admin.actorId],
      source: {
        pageId,
        revisionId: publishedPage.revision.revisionId
      }
    };
    const firstResults = await Promise.all([
      library.saveRevision(
        { ...command, idempotencyKey: 'mysql-template-first-left' },
        admin
      ),
      libraryPeer.saveRevision(
        { ...command, idempotencyKey: 'mysql-template-first-right' },
        admin
      )
    ]);
    expect(firstResults.filter((result) => result.ok)).toHaveLength(1);
    expect(
      firstResults.filter(
        (result) => !result.ok && result.error.code === 'TEMPLATE_REVISION_CONFLICT'
      )
    ).toHaveLength(1);
    const first = firstResults.find((result) => result.ok);
    if (!first?.ok) throw new Error('首次并发模板保存应恰一成功');

    const nextCommand = { ...command, baseRevisionId: first.revision.revisionId };
    const nextResults = await Promise.all([
      library.saveRevision(
        { ...nextCommand, idempotencyKey: 'mysql-template-next-left' },
        admin
      ),
      libraryPeer.saveRevision(
        { ...nextCommand, idempotencyKey: 'mysql-template-next-right' },
        admin
      )
    ]);
    expect(nextResults.filter((result) => result.ok)).toHaveLength(1);
    expect(
      nextResults.filter(
        (result) => !result.ok && result.error.code === 'TEMPLATE_REVISION_CONFLICT'
      )
    ).toHaveLength(1);
    const second = nextResults.find((result) => result.ok);
    if (!second?.ok) throw new Error('同基线并发模板保存应恰一成功');

    const replayCommand = {
      ...command,
      baseRevisionId: second.revision.revisionId,
      idempotencyKey: 'mysql-template-same-idempotency'
    };
    const [replayLeft, replayRight] = await Promise.all([
      library.saveRevision(replayCommand, admin),
      libraryPeer.saveRevision(replayCommand, admin)
    ]);
    expect(replayLeft).toEqual(replayRight);
    expect(replayLeft).toMatchObject({
      ok: true,
      revision: { revisionNumber: 3 }
    });

    await library.close();
    await libraryPeer.close();
    await pageLifecycle.close();
  }, 30_000);
});
