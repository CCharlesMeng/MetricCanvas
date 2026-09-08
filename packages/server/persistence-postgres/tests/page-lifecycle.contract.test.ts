import { afterAll, beforeAll, describe } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer
} from '@testcontainers/postgresql';
import { createPostgresPageLifecycle } from '../src/index';
import { runPageLifecycleContract } from '@metriccanvas/page-lifecycle/testing';

// 只在显式要求时跑（需要真实的 Docker/Postgres 环境）：
//   TEST_POSTGRES=1 pnpm --filter @metriccanvas/persistence-postgres exec vitest run
// 与模板库 PostgreSQL 契约的约定一致，默认不在 `pnpm test` / CI 中执行。
describe.runIf(process.env.TEST_POSTGRES === '1')('postgres 契约测试', () => {
  let postgres: StartedPostgreSqlContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:17-alpine').start();
  }, 120_000);

  afterAll(async () => {
    await postgres?.stop();
  });

  runPageLifecycleContract({
    create: async (options) =>
      createPostgresPageLifecycle({
        databaseUrl: postgres.getConnectionUri(),
        ...options
      })
  });
});
