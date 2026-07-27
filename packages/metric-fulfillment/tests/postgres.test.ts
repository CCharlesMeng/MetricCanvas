import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer
} from '@testcontainers/postgresql';
import {
  createPostgresMetricFulfillment,
  type PostgresMetricFulfillmentOptions
} from '@metriccanvas/metric-fulfillment';

describe('指标履约:PostgreSQL 持久化', () => {
  let database: StartedPostgreSqlContainer;

  beforeAll(async () => {
    database = await new PostgreSqlContainer('postgres:17-alpine').start();
  }, 120_000);

  afterAll(async () => {
    await database.stop();
  });

  it('重开模块后保留页面搭建蓝图、原子指标需求和同一幂等结果', async () => {
    const generatedIds = ['blueprint-1', 'group-1', 'request-1', 'audit-1'];
    const options: PostgresMetricFulfillmentOptions = {
      databaseUrl: database.getConnectionUri(),
      ids: {
        next: () => {
          const next = generatedIds.shift();
          if (!next) throw new Error('不应继续生成 id');
          return next;
        }
      },
      clock: { now: () => new Date('2026-07-23T02:00:00.000Z') }
    };
    const first = await createPostgresMetricFulfillment(options);
    const saved = await first.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'tokens-operations',
        baseRevisionId: 'revision-4',
        goal: '按办公区和模型观察 Tokens 消耗趋势',
        modules: [
          {
            moduleId: 'overview',
            title: 'Tokens 消耗概览',
            metricRequestKeys: ['tokens-consumption']
          }
        ],
        metricRequests: [
          {
            requestKey: 'tokens-consumption',
            name: 'Tokens 消耗量',
            definition: '输入与输出 Tokens 总量',
            requiredDimensions: ['office', 'model'],
            requiredAggregations: ['sum'],
            necessity: 'required',
            suggestedBy: 'user',
            contextSummary: '页面主指标'
          }
        ],
        idempotencyKey: 'save-blueprint-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );
    await first.close();

    const reopened = await createPostgresMetricFulfillment({
      ...options,
      ids: {
        next: () => {
          throw new Error('幂等重放和读取不应生成 id');
        }
      }
    });
    const loaded = await reopened.getBlueprint('blueprint-1');
    const replay = await reopened.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'another-page',
        baseRevisionId: null,
        goal: '该输入应被幂等结果覆盖',
        modules: [],
        metricRequests: [
          {
            requestKey: 'ignored',
            name: '忽略',
            definition: '忽略',
            requiredDimensions: [],
            requiredAggregations: [],
            necessity: 'optional',
            suggestedBy: 'ai',
            contextSummary: '忽略'
          }
        ],
        idempotencyKey: 'save-blueprint-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );
    await reopened.close();

    expect(saved.ok).toBe(true);
    expect(loaded).toEqual(saved);
    expect(replay).toEqual(saved);
  }, 30_000);
});
