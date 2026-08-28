import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MySqlContainer,
  type StartedMySqlContainer
} from '@testcontainers/mysql';
import { runPageLifecycleContract } from '@metriccanvas/page-lifecycle/testing';
import { createMySqlPageLifecycle } from '../src/index';
import { applyMySqlTestSchema } from './schema';

// 只在显式要求时跑（需要真实 Docker/MySQL 8.0 环境）：
//   TEST_MYSQL=1 pnpm exec vitest run packages/persistence-mysql/tests
describe.runIf(process.env.TEST_MYSQL === '1')('MySQL 契约测试', () => {
  let mysql: StartedMySqlContainer;

  beforeAll(async () => {
    mysql = await new MySqlContainer('mysql:8.0').start();
    await applyMySqlTestSchema(mysql.getConnectionUri());
  }, 120_000);

  afterAll(async () => {
    await mysql?.stop();
  });

  runPageLifecycleContract({
    create: async (options) =>
      createMySqlPageLifecycle({
        databaseUrl: mysql.getConnectionUri(),
        ...options
      })
  });

  it('两个独立 adapter pool 对首次保存和同幂等键仍由数据库互斥', async () => {
    const options = {
      databaseUrl: mysql.getConnectionUri(),
      dataContext: { current: async () => ({ version: 'contract-context-v1' }) }
    };
    const left = await createMySqlPageLifecycle(options);
    const right = await createMySqlPageLifecycle(options);
    const context = { actorId: 'cross-pool-author', clientId: 'cross-pool-client' };
    const document = (pageId: string) => ({
      schemaVersion: '5.0' as const,
      id: pageId,
      dataSources: {},
      sections: [
        {
          id: 'overview',
          components: [
            {
              id: 'a',
              type: 'text' as const,
              layout: { span: 12 },
              props: { title: 'A', body: '' }
            }
          ]
        }
      ]
    });

    const firstPageId = 'mysql-cross-pool-first-save';
    const firstResults = await Promise.all([
      left.saveRevision(
        {
          pageId: firstPageId,
          baseRevisionId: null,
          document: document(firstPageId),
          idempotencyKey: 'mysql-cross-pool-first-left',
          pageIdConfirmed: true
        },
        context
      ),
      right.saveRevision(
        {
          pageId: firstPageId,
          baseRevisionId: null,
          document: document(firstPageId),
          idempotencyKey: 'mysql-cross-pool-first-right',
          pageIdConfirmed: true
        },
        context
      )
    ]);
    expect(firstResults.filter((result) => result.ok)).toHaveLength(1);
    expect(
      firstResults.filter(
        (result) => !result.ok && result.error.code === 'REVISION_CONFLICT'
      )
    ).toHaveLength(1);

    const idemPageId = 'mysql-cross-pool-same-idempotency';
    const idemCommand = {
      pageId: idemPageId,
      baseRevisionId: null,
      document: document(idemPageId),
      idempotencyKey: 'mysql-cross-pool-shared-idem',
      pageIdConfirmed: true
    };
    const [idemLeft, idemRight] = await Promise.all([
      left.saveRevision(idemCommand, context),
      right.saveRevision(idemCommand, context)
    ]);
    expect(idemLeft).toEqual(idemRight);
    expect(idemLeft).toMatchObject({ ok: true, revision: { revisionNumber: 1 } });

    await left.close();
    await right.close();
  }, 30_000);
});
