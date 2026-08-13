import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import {
  createMemoryPageLifecycle,
  type PageLifecycle,
  type RevisionReference
} from '@metriccanvas/page-lifecycle';
import type { TemplateContext, TemplateLibrary } from '../src/index';

/**
 * memory 与 postgres 两份模板库实现共用的行为契约,结构照
 * `page-lifecycle/tests/contract.ts`:同一批用例分别喂给两份实现
 * (memory.contract.test.ts / postgres.contract.test.ts),任何一处断言
 * 在某一实现下失败,都说明两份实现出现了行为漂移。
 *
 * 来源页面修订统一由进程内页面生命周期提供:模板库只经 `PageLifecycle`
 * 端口消费来源,契约不关心其存储形态。
 */

export interface TemplateContractOptions {
  pageLifecycle: PageLifecycle;
  tokens: { next(): string };
  urls: { confirmation(requestId: string, token: string): string };
}

export interface TemplateContractHarness {
  create(options: TemplateContractOptions): Promise<TemplateLibrary>;
}

const admin: TemplateContext = {
  actorId: 'contract-admin',
  clientId: 'contract',
  roles: ['admin']
};
const viewer: TemplateContext = { actorId: 'contract-viewer', clientId: 'contract' };

function sourcePage(pageId: string): Page {
  return {
    schemaVersion: '5.0',
    id: pageId,
    dataSources: {},
    sections: [
      {
        id: 'overview',
        components: [
          { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
        ]
      }
    ]
  };
}

export function runTemplateLibraryContract(harness: TemplateContractHarness): void {
  async function setup(): Promise<{ pageLifecycle: PageLifecycle; library: TemplateLibrary }> {
    const pageLifecycle = createMemoryPageLifecycle({
      dataContext: { current: async () => ({ version: 'contract-context' }) },
      tokens: { next: () => 'page-token' }
    });
    const library = await harness.create({
      pageLifecycle,
      tokens: { next: () => 'template-token' },
      urls: {
        confirmation: (requestId, token) =>
          `http://localhost/templates/publish/${requestId}?token=${token}`
      }
    });
    return { pageLifecycle, library };
  }

  async function savePage(
    pageLifecycle: PageLifecycle,
    pageId: string
  ): Promise<RevisionReference> {
    const saved = await pageLifecycle.saveRevision(
      {
        pageId,
        baseRevisionId: null,
        document: sourcePage(pageId),
        idempotencyKey: `${pageId}:save-1`,
        pageIdConfirmed: true
      },
      { actorId: 'contract-author', clientId: 'contract' }
    );
    if (!saved.ok) throw new Error(saved.error.message);
    return { pageId, revisionId: saved.revision.revisionId };
  }

  async function publishPage(
    pageLifecycle: PageLifecycle,
    reference: RevisionReference
  ): Promise<RevisionReference> {
    const requested = await pageLifecycle.requestPublish(
      { ...reference, idempotencyKey: `${reference.pageId}:publish-1` },
      { actorId: 'contract-author', clientId: 'contract' }
    );
    if (!requested.ok) throw new Error(requested.error.message);
    const confirmed = await pageLifecycle.confirmPublish(
      { requestId: requested.request.requestId, token: 'page-token' },
      { actorId: 'contract-author', clientId: 'contract', roles: ['publisher'] }
    );
    if (!confirmed.ok) throw new Error(confirmed.error.message);
    return reference;
  }

  function saveCommand(
    templateId: string,
    source: RevisionReference,
    overrides: Partial<Parameters<TemplateLibrary['saveRevision']>[0]> = {}
  ) {
    return {
      templateId,
      baseRevisionId: null,
      title: `${templateId} 模板`,
      viewerSubjectIds: ['contract-viewer'],
      source,
      idempotencyKey: `${templateId}:save-1`,
      ...overrides
    };
  }

  describe('template-library 共享契约（memory 与 postgres 必须一致）', () => {
    it('保存与发布申请的幂等重放返回同一结果', async () => {
      const { pageLifecycle, library } = await setup();
      const source = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-idem-src')
      );
      const command = saveCommand('tpl-contract-idem', source);
      const first = await library.saveRevision(command, admin);
      const replay = await library.saveRevision(command, admin);
      expect(replay).toEqual(first);
      if (!first.ok) throw new Error(first.error.message);

      const publishCommand = {
        templateId: 'tpl-contract-idem',
        revisionId: first.revision.revisionId,
        idempotencyKey: 'tpl-contract-idem:publish-1'
      };
      const requestFirst = await library.requestPublish(publishCommand, admin);
      const requestReplay = await library.requestPublish(publishCommand, admin);
      expect(requestReplay).toEqual(requestFirst);
      await library.close();
    });

    it('首保 baseRevisionId 必须为 null,基线漂移返回 TEMPLATE_REVISION_CONFLICT 并附当前最新修订', async () => {
      const { pageLifecycle, library } = await setup();
      const source = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-conflict-src')
      );
      await expect(
        library.saveRevision(
          saveCommand('tpl-contract-conflict', source, { baseRevisionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
          admin
        )
      ).resolves.toMatchObject({ ok: false, error: { code: 'TEMPLATE_REVISION_CONFLICT' } });

      const saved = await library.saveRevision(saveCommand('tpl-contract-conflict', source), admin);
      if (!saved.ok) throw new Error(saved.error.message);
      await expect(
        library.saveRevision(
          saveCommand('tpl-contract-conflict', source, {
            idempotencyKey: 'tpl-contract-conflict:save-2'
          }),
          admin
        )
      ).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'TEMPLATE_REVISION_CONFLICT',
          currentLatestRevision: { revisionId: saved.revision.revisionId }
        }
      });
      await library.close();
    });

    // 漂移回归:memory 曾先查基线冲突、postgres 曾先查来源发布态,同一输入
    // 返回不同错误码。契约裁决为基线冲突优先(调用方状态问题先于来源问题)。
    it('基线冲突与来源未发布同时存在时,优先返回 TEMPLATE_REVISION_CONFLICT', async () => {
      const { pageLifecycle, library } = await setup();
      const published = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-priority-published')
      );
      const unpublished = await savePage(pageLifecycle, 'tpl-contract-priority-unpublished');

      const saved = await library.saveRevision(
        saveCommand('tpl-contract-priority', published),
        admin
      );
      if (!saved.ok) throw new Error(saved.error.message);

      // baseRevisionId 漂移(应为 saved.revision.revisionId)且来源未发布。
      await expect(
        library.saveRevision(
          saveCommand('tpl-contract-priority', unpublished, {
            baseRevisionId: null,
            idempotencyKey: 'tpl-contract-priority:save-2'
          }),
          admin
        )
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'TEMPLATE_REVISION_CONFLICT' }
      });
      await library.close();
    });

    it('来源必须是已发布页面修订,未发布返回 SOURCE_REVISION_NOT_PUBLISHED', async () => {
      const { pageLifecycle, library } = await setup();
      const unpublished = await savePage(pageLifecycle, 'tpl-contract-unpublished-src');
      await expect(
        library.saveRevision(saveCommand('tpl-contract-unpublished', unpublished), admin)
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'SOURCE_REVISION_NOT_PUBLISHED' }
      });
      await library.close();
    });

    it('完整发布流程:保存、申请、确认;search 按 viewerSubjectIds 过滤', async () => {
      const { pageLifecycle, library } = await setup();
      const source = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-flow-src')
      );
      const saved = await library.saveRevision(saveCommand('tpl-contract-flow', source), admin);
      if (!saved.ok) throw new Error(saved.error.message);
      const requested = await library.requestPublish(
        {
          templateId: 'tpl-contract-flow',
          revisionId: saved.revision.revisionId,
          idempotencyKey: 'tpl-contract-flow:publish-1'
        },
        admin
      );
      if (!requested.ok) throw new Error(requested.error.message);
      await expect(
        library.confirmPublish(
          { requestId: requested.request.requestId, token: 'template-token' },
          admin
        )
      ).resolves.toMatchObject({ ok: true, revision: { revisionId: saved.revision.revisionId } });

      const visible = await library.search({ query: 'tpl-contract-flow' }, viewer);
      expect(visible.matches).toHaveLength(1);
      expect(visible.matches[0]).toMatchObject({
        templateId: 'tpl-contract-flow',
        sourcePageRevision: { revisionId: source.revisionId }
      });

      const invisible = await library.search(
        { query: 'tpl-contract-flow' },
        { actorId: 'contract-stranger', clientId: 'contract' }
      );
      expect(invisible.matches).toHaveLength(0);
      await library.close();
    });

    it('全部治理入口拒绝非 admin 身份', async () => {
      const { pageLifecycle, library } = await setup();
      const source = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-authz-src')
      );
      await expect(
        library.saveRevision(saveCommand('tpl-contract-authz', source), viewer)
      ).resolves.toMatchObject({ ok: false, error: { code: 'TEMPLATE_FORBIDDEN' } });
      await expect(
        library.requestPublish(
          {
            templateId: 'tpl-contract-authz',
            revisionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            idempotencyKey: 'tpl-contract-authz:publish-1'
          },
          viewer
        )
      ).resolves.toMatchObject({ ok: false, error: { code: 'TEMPLATE_FORBIDDEN' } });
      await expect(
        library.confirmPublish({ requestId: 'any', token: 'any' }, viewer)
      ).resolves.toMatchObject({ ok: false, error: { code: 'TEMPLATE_FORBIDDEN' } });
      await expect(
        library.getPublishRequest({ requestId: 'any' }, viewer)
      ).resolves.toMatchObject({ ok: false, error: { code: 'TEMPLATE_FORBIDDEN' } });
      await library.close();
    });

    it('确认发布:token 错误与请求已结束分别返回专属错误码', async () => {
      const { pageLifecycle, library } = await setup();
      const source = await publishPage(
        pageLifecycle,
        await savePage(pageLifecycle, 'tpl-contract-token-src')
      );
      const saved = await library.saveRevision(saveCommand('tpl-contract-token', source), admin);
      if (!saved.ok) throw new Error(saved.error.message);
      const requested = await library.requestPublish(
        {
          templateId: 'tpl-contract-token',
          revisionId: saved.revision.revisionId,
          idempotencyKey: 'tpl-contract-token:publish-1'
        },
        admin
      );
      if (!requested.ok) throw new Error(requested.error.message);

      await expect(
        library.confirmPublish(
          { requestId: requested.request.requestId, token: 'wrong-token' },
          admin
        )
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'INVALID_TEMPLATE_CONFIRMATION_TOKEN' }
      });

      const confirmed = await library.confirmPublish(
        { requestId: requested.request.requestId, token: 'template-token' },
        admin
      );
      expect(confirmed.ok).toBe(true);

      await expect(
        library.confirmPublish(
          { requestId: requested.request.requestId, token: 'template-token' },
          admin
        )
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'TEMPLATE_PUBLISH_REQUEST_CLOSED' }
      });
      await library.close();
    });
  });
}
