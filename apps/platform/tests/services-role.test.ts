import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import type { DataGateway, DimensionValuesGateway } from '@metriccanvas/engine';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('../src/lib/server/bundled-assets.server', async () => {
  const { readFileSync } = await import('node:fs');
  return {
    bundledDataContext: JSON.parse(
      readFileSync(new URL('../../../docs/examples/schema-metadata.example.json', import.meta.url), 'utf8')
    ),
    bundledPageModules: {}
  };
});

import {
  createPlatformServices,
  resolvePageAssetsBackend,
  resolvePlatformDatabaseUrl
} from '../src/lib/server/services.server';
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
  it.each(['reader', 'authoring'])('%s 只提供页面资产，不再构造旧对话服务', async (role) => {
    const services = await createPlatformServices({ METRICCANVAS_ROLE: role, METRICCANVAS_OFFLINE: '1' });
    expect(services.role).toBe(role);
    for (const key of ['createRunner', 'agentRuns', 'agentModel', 'sessions', 'metricGaps', 'dataContext']) {
      expect(key in services).toBe(false);
    }
    expect(await services.lifecycle.listPages({ limit: 5 })).toEqual({ pages: [], nextPageId: null });
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
        }
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
      expect('templates' in services).toBe(false);
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
        { METRICCANVAS_ROLE: 'authoring', METRICCANVAS_PAGE_ASSETS: 'java' }
      )
    ).rejects.toThrowError(/METRICCANVAS_PAGE_ASSETS_BASE_URL/);
  });

});
