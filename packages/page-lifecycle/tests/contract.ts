import { describe, expect, it } from 'vitest';
import type { Page, PageDocument } from '@metriccanvas/page';
import type { DataContextVersionProvider, LifecycleContext, PageLifecycle } from '../src/types';

/**
 * memory、postgres 与 mysql 实现共用的行为契约。同一批用例分别喂给
 * 三份实现，任何一处断言在某一实现下失败，都说明实现出现了行为漂移。
 *
 * 注意：不覆盖 `SaveRevisionCommand.pageIdConfirmed` /
 * `PAGE_ID_CONFIRMATION_REQUIRED` 本身的语义——那是另一项独立变更
 * （pageId 确认规则下沉），这里的用例只是在首次保存时按现状带上
 * `pageIdConfirmed: true` 以越过这道门槛，不对其行为做断言。
 */

export interface ContractOptions {
  dataContext?: DataContextVersionProvider;
  clock?: { now(): Date };
  ids?: { next(): string };
  tokens?: { next(): string };
  urls?: { confirmation(requestId: string, token: string): string };
  publishLeaseMs?: number;
}

export interface ResolvedContractOptions {
  dataContext: DataContextVersionProvider;
  clock?: { now(): Date };
  ids: { next(): string };
  tokens: { next(): string };
  urls: { confirmation(requestId: string, token: string): string };
  publishLeaseMs?: number;
}

export interface ContractHarness {
  create(options: ResolvedContractOptions): Promise<PageLifecycle>;
}

const author: LifecycleContext = { actorId: 'author', clientId: 'test' };
const publisher: LifecycleContext = { actorId: 'author', clientId: 'test', roles: ['publisher'] };
const admin: LifecycleContext = { actorId: 'admin', clientId: 'test', roles: ['admin'] };

function textPage(id: string, sections: Page['sections']): PageDocument {
  return {
    schemaVersion: '5.0',
    id,
    dataSources: {},
    sections
  };
}

function defaultOptions(overrides: ContractOptions): ResolvedContractOptions {
  return {
    dataContext: overrides.dataContext ?? { current: async () => ({ version: 'contract-context-v1' }) },
    // 有意不覆盖 ids：postgres 的 revision_id/request_id 是 uuid 列，
    // 必须落到默认的 randomUUID() 上；测试通过读取返回值里的 id 来
    // 拿到后续调用需要的引用，不依赖可预测的 id。
    ids: overrides.ids ?? { next: () => crypto.randomUUID() },
    tokens: overrides.tokens ?? { next: () => 'contract-token' },
    urls:
      overrides.urls ??
      {
        confirmation: (requestId: string, token: string) =>
          `http://localhost/publish/${requestId}?token=${token}`
      },
    clock: overrides.clock,
    publishLeaseMs: overrides.publishLeaseMs
  };
}

export function runPageLifecycleContract(harness: ContractHarness): void {
  async function create(overrides: ContractOptions = {}): Promise<PageLifecycle> {
    return harness.create(defaultOptions(overrides));
  }

  describe('page-lifecycle 共享契约（memory、postgres 与 mysql 必须一致）', () => {
    it('保存与发布申请的幂等重放返回同一结果', async () => {
      const lifecycle = await create();
      const pageId = 'contract-idempotency';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const first = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      const replay = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      expect(replay).toEqual(first);
      if (!first.ok) throw new Error(first.error.message);

      const requestFirst = await lifecycle.requestPublish(
        { pageId, revisionId: first.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      const requestReplay = await lifecycle.requestPublish(
        { pageId, revisionId: first.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      expect(requestReplay).toEqual(requestFirst);

      await lifecycle.close();
    });

    it('baseRevisionId 与当前最新修订不一致时返回 REVISION_CONFLICT，并附带当前最新修订', async () => {
      const lifecycle = await create();
      const pageId = 'contract-conflict';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);

      const conflicted = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-2-conflict`
        },
        author
      );
      expect(conflicted).toMatchObject({
        ok: false,
        error: {
          code: 'REVISION_CONFLICT',
          currentLatestRevision: { revisionId: saved.revision.revisionId }
        }
      });

      await lifecycle.close();
    });

    // 修复 1/4：diffJson 对数组按下标逐元素比较，而不是整体替换。
    it('diffRevisions 对数组按下标逐元素比较，只报告实际变化的元素', async () => {
      const lifecycle = await create();
      const pageId = 'contract-array-diff';
      const componentAt = (id: string, title: string) =>
        ({ id, type: 'text' as const, layout: { span: 4 }, props: { title, body: '' } });
      const before = textPage(pageId, [
        {
          id: 'overview',
          components: [
            componentAt('text-a', 'A'),
            componentAt('text-b', 'B'),
            componentAt('text-c', 'C')
          ]
        }
      ]);
      const after = textPage(pageId, [
        {
          id: 'overview',
          components: [
            componentAt('text-a', 'A'),
            componentAt('text-b', 'B2'),
            componentAt('text-c', 'C')
          ]
        }
      ]);

      const r1 = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document: before,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!r1.ok) throw new Error(r1.error.message);
      const r2 = await lifecycle.saveRevision(
        { pageId, baseRevisionId: r1.revision.revisionId, document: after, idempotencyKey: `${pageId}:save-2` },
        author
      );
      if (!r2.ok) throw new Error(r2.error.message);

      const diff = await lifecycle.diffRevisions({
        pageId,
        fromRevisionId: r1.revision.revisionId,
        toRevisionId: r2.revision.revisionId
      });
      if (!diff.ok) throw new Error(diff.error.message);
      expect(diff.diff.changes).toEqual([
        {
          op: 'replace',
          path: '/sections/0/components/1/props/title',
          before: 'B',
          after: 'B2'
        }
      ]);

      await lifecycle.close();
    });

    // 修复 2/4：visibility 由 publishedRevisionId 派生，而不是恒为 visible。
    it('listPages 的 visibility 由 publishedRevisionId 派生：未发布为 hidden，发布后为 visible', async () => {
      const lifecycle = await create();
      const pageId = 'contract-visibility';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);

      const beforePublish = await lifecycle.listPages();
      expect(beforePublish.pages.find((page) => page.pageId === pageId)).toMatchObject({
        visibility: 'hidden'
      });

      const requested = await lifecycle.requestPublish(
        { pageId, revisionId: saved.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      if (!requested.ok) throw new Error(requested.error.message);
      const confirmed = await lifecycle.confirmPublish(
        { requestId: requested.request.requestId, token: 'contract-token' },
        publisher
      );
      expect(confirmed.ok).toBe(true);

      const afterPublish = await lifecycle.listPages();
      expect(afterPublish.pages.find((page) => page.pageId === pageId)).toMatchObject({
        visibility: 'visible'
      });

      await lifecycle.close();
    });

    // 修复 3/4：getPage 用 exact 选择器时，区分“页面不存在”与“修订不存在”。
    it('getPage 用 exact 选择器时区分页面不存在（PAGE_NOT_FOUND）与修订不存在（REVISION_NOT_FOUND）', async () => {
      const lifecycle = await create();
      const pageId = 'contract-exact-selector';

      const missingPage = await lifecycle.getPage({
        pageId: 'contract-exact-selector-missing-page',
        selector: { type: 'exact', revisionId: 'does-not-matter' }
      });
      expect(missingPage).toMatchObject({ ok: false, error: { code: 'PAGE_NOT_FOUND' } });

      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);

      // 语法上不合法的 UUID 字符串：postgres 的 revision_id 是 uuid 列，
      // 两份实现都必须把格式非法的 revisionId 当作“修订不存在”优雅处理，
      // 而不是让驱动层的 PostgresError 逸出为未捕获异常。
      const missingRevision = await lifecycle.getPage({
        pageId,
        selector: { type: 'exact', revisionId: 'not-a-uuid' }
      });
      expect(missingRevision).toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });

      const found = await lifecycle.getPage({
        pageId,
        selector: { type: 'exact', revisionId: saved.revision.revisionId }
      });
      expect(found).toMatchObject({ ok: true, revision: { pageId, revisionId: saved.revision.revisionId } });

      await lifecycle.close();
    });

    // 与上一个用例同源的驱动层异常风险：postgres 侧所有直接按 revisionId
    // 查询 uuid 列的入口（不止 getPage 的 exact 选择器）都必须把格式非法
    // 的字符串当作“修订不存在”优雅处理，而不是把 PostgresError 逸出给
    // 调用方。
    it('其它接受 revisionId 的入口对格式非法的字符串也返回 REVISION_NOT_FOUND 而不抛异常', async () => {
      const lifecycle = await create();
      const pageId = 'contract-invalid-revision-id-entrypoints';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);

      await expect(
        lifecycle.getRevision({ pageId, revisionId: 'not-a-uuid' })
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });

      await expect(
        lifecycle.diffRevisions({
          pageId,
          fromRevisionId: 'not-a-uuid',
          toRevisionId: saved.revision.revisionId
        })
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });
      await expect(
        lifecycle.diffRevisions({
          pageId,
          fromRevisionId: saved.revision.revisionId,
          toRevisionId: 'not-a-uuid'
        })
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });

      await expect(
        lifecycle.rollbackRevision(
          { pageId, targetRevisionId: 'not-a-uuid', idempotencyKey: `${pageId}:rollback-invalid` },
          author
        )
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });

      await expect(
        lifecycle.getPublishedRevision({ pageId, revisionId: 'not-a-uuid' })
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_FOUND' } });

      await lifecycle.close();
    });

    // 修复 4/4：保存非法文档不能有任何可观察的副作用——即便顺带发现了
    // 一个已过期但还没被任何读路径“懒过期”的发布租约，也必须等文档校验
    // 通过之后才提交释放与审计。用可控时钟在两个不同时刻观察，区分
    // “过期发生在无效保存时”还是“过期发生在之后的读取时”。
    it('保存非法文档不会提前释放已过期的发布租约（副作用只在校验通过后才提交）', async () => {
      let now = new Date('2026-01-01T00:00:00.000Z').getTime();
      const clock = { now: () => new Date(now) };
      const lifecycle = await create({ clock, publishLeaseMs: 1000 });
      const pageId = 'contract-lease-ordering';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);

      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);
      const requested = await lifecycle.requestPublish(
        { pageId, revisionId: saved.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      if (!requested.ok) throw new Error(requested.error.message);

      now += 2000; // 租约已过期，但还没有任何读路径触发过懒过期
      const invalidDocument = { ...saved.revision.document, schemaVersion: '2.0' };
      const invalidSave = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: saved.revision.revisionId,
          document: invalidDocument,
          idempotencyKey: `${pageId}:save-2-invalid`
        },
        author
      );
      expect(invalidSave).toMatchObject({ ok: false, error: { code: 'INVALID_PAGE' } });

      now += 1000; // 用一个不同的时刻做后续读取，借助 occurredAt 判断过期到底发生在哪一刻
      const audit = await lifecycle.listPublishAudit({ requestId: requested.request.requestId }, author);
      if (!audit.ok) throw new Error(audit.error.message);
      const expiredEvent = audit.events.find((event) => event.action === 'expired');
      expect(expiredEvent).toBeDefined();
      expect(expiredEvent?.occurredAt).toBe(new Date(now).toISOString());

      await lifecycle.close();
    });

    it('完整发布生命周期：申请、确认、已发布修订可读、回滚、审计记录', async () => {
      const lifecycle = await create();
      const pageId = 'contract-full-lifecycle';
      const documentV1 = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'V1', body: '' } }
          ]
        }
      ]);
      const documentV2 = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'V2', body: '' } }
          ]
        }
      ]);

      const v1 = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document: documentV1,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!v1.ok) throw new Error(v1.error.message);
      const requested1 = await lifecycle.requestPublish(
        { pageId, revisionId: v1.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      if (!requested1.ok) throw new Error(requested1.error.message);
      const confirmed1 = await lifecycle.confirmPublish(
        { requestId: requested1.request.requestId, token: 'contract-token' },
        publisher
      );
      if (!confirmed1.ok) throw new Error(confirmed1.error.message);

      const v2 = await lifecycle.saveRevision(
        { pageId, baseRevisionId: v1.revision.revisionId, document: documentV2, idempotencyKey: `${pageId}:save-2` },
        author
      );
      if (!v2.ok) throw new Error(v2.error.message);

      await expect(
        lifecycle.getPublishedRevision({ pageId, revisionId: v1.revision.revisionId })
      ).resolves.toMatchObject({ ok: true, revision: { revisionId: v1.revision.revisionId } });
      await expect(
        lifecycle.getPublishedRevision({ pageId, revisionId: v2.revision.revisionId })
      ).resolves.toMatchObject({ ok: false, error: { code: 'REVISION_NOT_PUBLISHED' } });

      const rolledBack = await lifecycle.rollbackRevision(
        { pageId, targetRevisionId: v1.revision.revisionId, idempotencyKey: `${pageId}:rollback-1` },
        author
      );
      expect(rolledBack).toMatchObject({ ok: true, revision: { document: { sections: [{ components: [{ props: { title: 'V1' } }] }] } } });

      const history = await lifecycle.listRevisionHistory({ pageId });
      if (!history.ok) throw new Error(history.error.message);
      expect(history.history.revisions).toHaveLength(3);
      expect(history.history.revisions.map((revision) => revision.revisionNumber)).toEqual([3, 2, 1]);

      const audit = await lifecycle.listPublishAudit({ requestId: requested1.request.requestId }, author);
      if (!audit.ok) throw new Error(audit.error.message);
      expect(audit.events.map((event) => event.action)).toEqual(['requested', 'approved']);

      await lifecycle.close();
    });

    // 漂移回归:memory 曾用 localeCompare 排序 + 码点游标过滤(两者不一致),
    // postgres 用数据库 collation。契约裁决为码点序(invariants.comparePageIds):
    // 连字符(45)排在数字(48-57)之前,`p-9` 必须先于 `p0a`;localeCompare
    // 把连字符当可忽略字符,会给出相反顺序。
    it('listPages 按码点序排列,游标严格大于且与排序使用同一比较', async () => {
      const lifecycle = await create();
      const prefix = 'contract-order';
      const ids = [`${prefix}-p-9`, `${prefix}-p0a`];
      for (const pageId of ids) {
        const saved = await lifecycle.saveRevision(
          {
            pageId,
            baseRevisionId: null,
            document: textPage(pageId, [
              {
                id: 'overview',
                components: [
                  { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
                ]
              }
            ]),
            idempotencyKey: `${pageId}:save-1`,
            pageIdConfirmed: true
          },
          author
        );
        if (!saved.ok) throw new Error(saved.error.message);
      }

      async function collectAll(afterPageId?: string): Promise<string[]> {
        const collected: string[] = [];
        let cursor = afterPageId;
        for (;;) {
          const page = await lifecycle.listPages(
            cursor === undefined ? {} : { afterPageId: cursor }
          );
          collected.push(...page.pages.map((item) => item.pageId));
          if (!page.nextPageId) return collected;
          cursor = page.nextPageId;
        }
      }

      const all = await collectAll();
      const mine = all.filter((pageId) => pageId.startsWith(prefix));
      expect(mine).toEqual([`${prefix}-p-9`, `${prefix}-p0a`]);

      const afterFirst = await collectAll(`${prefix}-p-9`);
      const mineAfter = afterFirst.filter((pageId) => pageId.startsWith(prefix));
      expect(mineAfter).toEqual([`${prefix}-p0a`]);

      await lifecycle.close();
    });

    // 漂移回归:memory 曾只对 saveRevision 加页面锁,requestPublish 无临界区,
    // 两个并发申请都能通过活动租约检查、双双持有租约。
    it('并发写路径串行化:同基线并发保存恰一成功,并发发布申请恰一持有租约', async () => {
      const lifecycle = await create();
      const pageId = 'contract-concurrency';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const base = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!base.ok) throw new Error(base.error.message);

      const [saveLeft, saveRight] = await Promise.all([
        lifecycle.saveRevision(
          {
            pageId,
            baseRevisionId: base.revision.revisionId,
            document,
            idempotencyKey: `${pageId}:save-2-left`
          },
          author
        ),
        lifecycle.saveRevision(
          {
            pageId,
            baseRevisionId: base.revision.revisionId,
            document,
            idempotencyKey: `${pageId}:save-2-right`
          },
          author
        )
      ]);
      const saveOutcomes = [saveLeft, saveRight];
      expect(saveOutcomes.filter((result) => result.ok)).toHaveLength(1);
      expect(
        saveOutcomes.filter(
          (result) => !result.ok && result.error.code === 'REVISION_CONFLICT'
        )
      ).toHaveLength(1);
      const winner = saveOutcomes.find((result) => result.ok);
      if (!winner || !winner.ok) throw new Error('并发保存应恰有一个成功');
      expect(winner.revision.revisionNumber).toBe(2);

      const [publishLeft, publishRight] = await Promise.all([
        lifecycle.requestPublish(
          {
            pageId,
            revisionId: winner.revision.revisionId,
            idempotencyKey: `${pageId}:publish-left`
          },
          author
        ),
        lifecycle.requestPublish(
          {
            pageId,
            revisionId: winner.revision.revisionId,
            idempotencyKey: `${pageId}:publish-right`
          },
          author
        )
      ]);
      const publishOutcomes = [publishLeft, publishRight];
      expect(publishOutcomes.filter((result) => result.ok)).toHaveLength(1);
      expect(
        publishOutcomes.filter(
          (result) => !result.ok && result.error.code === 'PAGE_LOCKED'
        )
      ).toHaveLength(1);

      await lifecycle.close();
    });

    it('cancelPublish 只允许发起人本人或 admin，其他身份返回 PUBLISH_FORBIDDEN', async () => {
      const lifecycle = await create();
      const pageId = 'contract-cancel-authz';
      const document = textPage(pageId, [
        {
          id: 'overview',
          components: [
            { id: 'a', type: 'text', layout: { span: 12 }, props: { title: 'A', body: '' } }
          ]
        }
      ]);
      const saved = await lifecycle.saveRevision(
        {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `${pageId}:save-1`,
          pageIdConfirmed: true
        },
        author
      );
      if (!saved.ok) throw new Error(saved.error.message);
      const requested = await lifecycle.requestPublish(
        { pageId, revisionId: saved.revision.revisionId, idempotencyKey: `${pageId}:publish-1` },
        author
      );
      if (!requested.ok) throw new Error(requested.error.message);

      const strangerCancel = await lifecycle.cancelPublish(
        { requestId: requested.request.requestId },
        { actorId: 'someone-else', clientId: 'test' }
      );
      expect(strangerCancel).toMatchObject({ ok: false, error: { code: 'PUBLISH_FORBIDDEN' } });

      const adminCancel = await lifecycle.cancelPublish(
        { requestId: requested.request.requestId },
        admin
      );
      expect(adminCancel).toMatchObject({ ok: true, request: { status: 'cancelled' } });

      await lifecycle.close();
    });
  });
}
