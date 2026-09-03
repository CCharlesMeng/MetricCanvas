import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { EffectiveQuery } from '@metriccanvas/page';
import type { DataGateway, DimensionValuesGateway } from '@metriccanvas/runtime';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('../src/lib/server/bundled-assets.server', async () => {
  const { readFileSync } = await import('node:fs');
  return {
    bundledDataContext: JSON.parse(
      readFileSync(new URL('../../../docs/examples/schema-metadata.example.json', import.meta.url), 'utf8')
    ),
    bundledPageModules: {},
    bundledTemplateModules: {}
  };
});

import {
  bindIdentity,
  createPlatformServices,
  resolvePageAssetsBackend,
  resolvePlatformDatabaseUrl
} from '../src/lib/server/services.server';
import {
  createRunScopedMcpConnector,
  type RunScopedMcpDependencies
} from '../src/lib/server/agent/run-mcp';

const READER_IDENTITY: LifecycleContext = {
  actorId: 'reader-42',
  clientId: 'reader',
  roles: []
};

const gateway: DataGateway & DimensionValuesGateway = {
  async fetchData() {
    return { rows: [] };
  },
  async fetchDimensionValues() {
    return { kind: 'values', candidates: [] };
  }
};

describe('平台部署角色组合根', () => {
  it('reader 不构造 Agent runner、MCP connector、模型 provider 与 run registry', async () => {
    const createDataGateway = vi.fn(() => gateway);
    const forbidden = vi.fn(() => {
      throw new Error('reader 不得构造创作期对象');
    });
    const environment = {
      METRICCANVAS_ROLE: 'reader',
      METRICCANVAS_OFFLINE: '1',
      METRICCANVAS_READER_DATABASE_URL: 'postgres://reader'
    };

    const services = await createPlatformServices(environment, {
      createDataGateway,
      createAgentRunner: forbidden,
      createMcpConnector: forbidden,
      createModelProvider: forbidden,
      createRunRegistry: forbidden
    });
    const bound = bindIdentity(services, READER_IDENTITY);

    expect(services.role).toBe('reader');
    expect(bound.role).toBe('reader');
    expect(bound.dataGateway).toBe(gateway);
    expect(createDataGateway).toHaveBeenCalledWith({
      environment,
      actor: READER_IDENTITY
    });
    expect(forbidden).not.toHaveBeenCalled();
    expect('createRunner' in services).toBe(false);
    expect('createRunner' in bound).toBe(false);
    expect('agentRuns' in services).toBe(false);
    expect('agentModel' in services).toBe(false);
  });

  it('reader 可独立使用只读数据库 URL，authoring 保持 DATABASE_URL', () => {
    const environment = {
      DATABASE_URL: 'postgres://authoring',
      METRICCANVAS_READER_DATABASE_URL: 'postgres://reader'
    };
    expect(resolvePlatformDatabaseUrl(environment, 'reader')).toBe('postgres://reader');
    expect(resolvePlatformDatabaseUrl(environment, 'authoring')).toBe('postgres://authoring');
    expect(() =>
      resolvePlatformDatabaseUrl({ DATABASE_URL: 'postgres://authoring' }, 'reader')
    ).toThrowError('reader 部署必须配置 METRICCANVAS_READER_DATABASE_URL 只读账号');
  });

  it('METRICCANVAS_PAGE_ASSETS=java 以 Java HTTP Adapter 承载页面生命周期,其余能力如实 NOT_SUPPORTED', async () => {
    const seen: Array<{ method: string; url: string; operator: string | undefined }> = [];
    const server = createServer((request, response) => {
      seen.push({
        method: request.method ?? '',
        url: request.url ?? '',
        operator: request.headers['x-operator-id'] as string | undefined
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ pages: [], nextAfter: null }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    try {
      const services = await createPlatformServices(
        {
          METRICCANVAS_ROLE: 'authoring',
          METRICCANVAS_PAGE_ASSETS: 'java',
          METRICCANVAS_PAGE_ASSETS_BASE_URL: `http://127.0.0.1:${address.port}/rest/cdi/pageassets/v1`
        },
        { createDataGateway: () => gateway, createModelProvider: () => null }
      );
      if (services.role !== 'authoring') throw new Error('测试需要 authoring 组合根');

      expect(await services.lifecycle.listPages({ limit: 5 })).toEqual({ pages: [], nextPageId: null });
      expect(seen).toEqual([
        { method: 'GET', url: '/rest/cdi/pageassets/v1/pages?limit=5', operator: 'platform' }
      ]);
      const publish = await services.lifecycle.requestPublish(
        { pageId: 'p', revisionId: 'r', idempotencyKey: 'k' },
        READER_IDENTITY
      );
      expect(!publish.ok && publish.error.code).toBe('NOT_SUPPORTED');
      // 模板库退到内存实现,不需要 PostgreSQL。
      expect(
        await services.templates.list({ actorId: 'developer-1', clientId: 'management-console' })
      ).toEqual({ templates: [] });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('页面资产后端只接受 postgres | java,java 必须给 base URL', async () => {
    expect(resolvePageAssetsBackend({})).toBe('postgres');
    expect(resolvePageAssetsBackend({ METRICCANVAS_PAGE_ASSETS: 'Java' })).toBe('java');
    expect(() => resolvePageAssetsBackend({ METRICCANVAS_PAGE_ASSETS: 'mysql' })).toThrowError(
      /只接受 postgres \| java/
    );
    await expect(
      createPlatformServices(
        { METRICCANVAS_ROLE: 'authoring', METRICCANVAS_PAGE_ASSETS: 'java' },
        { createDataGateway: () => gateway, createModelProvider: () => null }
      )
    ).rejects.toThrowError(/METRICCANVAS_PAGE_ASSETS_BASE_URL/);
  });

  it('同一 actor 身份化 gateway 同时承载普通取数、候选值与 Agent signal 验真', async () => {
    const fetchData = vi.fn(async () => ({ rows: [{ metric: 7 }] }));
    const fetchDimensionValues = vi.fn(async () => ({
      kind: 'values' as const,
      candidates: [{ value: '华东', label: '华东' }]
    }));
    const requestGateway = { fetchData, fetchDimensionValues };
    const createDataGateway = vi.fn(() => requestGateway);
    let mcpDependencies: RunScopedMcpDependencies | undefined;
    const createMcpConnector = vi.fn((dependencies: RunScopedMcpDependencies) => {
      mcpDependencies = dependencies;
      return createRunScopedMcpConnector(dependencies);
    });
    const environment = {
      METRICCANVAS_ROLE: 'authoring',
      METRICCANVAS_OFFLINE: '1'
    };
    const services = await createPlatformServices(environment, {
      createDataGateway,
      createMcpConnector,
      createModelProvider: () => null
    });
    if (services.role !== 'authoring') throw new Error('测试需要 authoring 组合根');
    const bound = bindIdentity(services, READER_IDENTITY);

    await bound.dataGateway.fetchData({} as EffectiveQuery);
    await bound.dataGateway.fetchDimensionValues('区域');
    const controller = new AbortController();
    const query = {
      language: 'dqe',
      body: { dsl_list: [{ output_metrics: ['指标'], output_dims: [] }] },
      fieldMappings: {
        metric: { queryField: '指标', type: 'number', role: 'measure' }
      },
      filterValues: []
    } as unknown as EffectiveQuery;
    await mcpDependencies?.executeDataRequestUnitQuery(query, controller.signal);

    expect(createDataGateway).toHaveBeenCalledTimes(1);
    expect(createDataGateway).toHaveBeenCalledWith({
      environment,
      actor: READER_IDENTITY
    });
    expect(fetchDimensionValues).toHaveBeenCalledWith('区域');
    expect(fetchData).toHaveBeenNthCalledWith(2, query, undefined, controller.signal);
  });
});
