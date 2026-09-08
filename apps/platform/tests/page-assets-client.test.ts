import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageAssetsClient } from '../src/lib/page-assets-client';
import { installRuntimeConfig } from '../src/lib/runtime-config';

const config = {
  dqeEndpoint: '/dqe', pageAssetsBaseUrl: 'https://pages.example/rest/cdi/pageassets/v1/',
  authToken: 'token-1', operatorId: 'operator-1', workspaceId: 'ws-1'
};
const document = { id: 'report', schemaVersion: '6.0', title: '报告' };
const revision = {
  pageId: 'report', revisionId: 'rev-1', revisionNumber: 1, document,
  baseRevisionId: null, contentHash: 'hash', dataContextVersion: null,
  createdBy: 'operator-1', createdAt: '2026-09-08T00:00:00Z'
};
const command = { baseRevisionId: null, document, idempotencyKey: 'save-1', pageIdConfirmed: true };
afterEach(() => installRuntimeConfig(null));

describe('平台页面资产客户端', () => {
  it('目录、最新、精确修订、保存都使用注入基址和三个身份头，适配 Java 信封', async () => {
    installRuntimeConfig(config);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createPageAssetsClient({ fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return String(input).endsWith('/pages')
        ? Response.json({ pages: [{ pageId: 'report', latestRevision: { revisionId: 'rev-1' } }], nextAfter: 'report' })
        : Response.json(revision, { status: init?.method === 'POST' ? 201 : 200 });
    } });
    await expect(client.listPages()).resolves.toEqual({ pages: [{ pageId: 'report', latestRevision: { revisionId: 'rev-1' }, publishedRevision: null, visibility: 'visible' }], nextPageId: 'report' });
    await expect(client.getLatest('report')).resolves.toEqual(revision);
    await expect(client.getRevision('report', 'rev-1')).resolves.toEqual(revision);
    await expect(client.saveRevision('report', command)).resolves.toEqual(revision);
    expect(calls.map((call) => call.url)).toEqual([
      `${config.pageAssetsBaseUrl}pages`, `${config.pageAssetsBaseUrl}pages/report`,
      `${config.pageAssetsBaseUrl}pages/report/revisions/rev-1`, `${config.pageAssetsBaseUrl}pages/report/revisions`
    ]);
    for (const { init } of calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Auth-Token')).toBe('token-1');
      expect(headers.get('X-Operator-Id')).toBe('operator-1');
      expect(headers.get('X-Workspace-Id')).toBe('ws-1');
    }
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ ...command, source: { type: 'manual' }, dataContextVersion: null });
  });

  it.each(['absent', 'missing-base'] as const)('%s 时回退当前同源路径，包含应用 base，保留首次保存确认', async (kind) => {
    installRuntimeConfig(kind === 'absent' ? null : { ...config, pageAssetsBaseUrl: '' });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createPageAssetsClient({ applicationBase: '/metriccanvas', fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return String(input).endsWith('/api/pages')
        ? Response.json({ pages: [], nextPageId: null })
        : Response.json({ ok: true, revision });
    } });
    await client.listPages();
    await client.getLatest('a/b');
    await client.getRevision('a/b', 'rev?1');
    await client.saveRevision('a/b', command);
    expect(calls.map((call) => call.url)).toEqual([
      '/metriccanvas/api/pages', '/metriccanvas/api/pages/a%2Fb',
      '/metriccanvas/api/pages/a%2Fb?revisionId=rev%3F1', '/metriccanvas/api/pages/a%2Fb/revisions'
    ]);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual(command);
  });

  it('请求时现读：更换基址和三个身份字段无需重建客户端', async () => {
    installRuntimeConfig(config);
    const calls: Array<{ url: string; headers: Headers }> = [];
    const client = createPageAssetsClient({ fetchImpl: async (input, init) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return Response.json(revision);
    } });
    await client.getLatest('report');
    installRuntimeConfig({ ...config, pageAssetsBaseUrl: '/new-assets', authToken: 'token-2', operatorId: 'operator-2', workspaceId: 'ws-2' });
    await client.saveRevision('report', command);
    expect(calls[1]?.url).toBe('/new-assets/pages/report/revisions');
    expect(calls[1]?.headers.get('X-Auth-Token')).toBe('token-2');
    expect(calls[1]?.headers.get('X-Operator-Id')).toBe('operator-2');
    expect(calls[1]?.headers.get('X-Workspace-Id')).toBe('ws-2');
  });

  it('有基址而缺身份时，读和写在发网前报告未注入配置，不回退 Node', async () => {
    installRuntimeConfig({ ...config, authToken: '' });
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createPageAssetsClient({ fetchImpl });
    await expect(client.getLatest('report')).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR', message: '集成应用未注入运行配置' });
    await expect(client.saveRevision('report', command)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR', message: '集成应用未注入运行配置' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('精确修订读取携带信号，取消到达实际请求', async () => {
    installRuntimeConfig(config);
    const controller = new AbortController();
    const client = createPageAssetsClient({ fetchImpl: (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }) });
    const pending = client.getRevision('report', 'rev-1', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([false, true])('业务冲突与校验问题保留分类，Java=%s', async (injected) => {
    installRuntimeConfig(injected ? config : null);
    const issue = { type: 'INVALID_FIELD', path: 'sections', message: '字段错误' };
    const error = { code: 'INVALID_PAGE', message: '页面校验失败', ...(injected ? { details: { errors: [issue] } } : { validationErrors: [issue] }) };
    const client = createPageAssetsClient({ fetchImpl: async () => Response.json(injected ? error : { error }, { status: 422 }) });
    await expect(client.saveRevision('report', command)).rejects.toMatchObject({ code: 'INVALID_PAGE', message: '页面校验失败', validationErrors: [issue] });
  });

  it('HTTP 401 报告需要登录，无刷新重试', async () => {
    installRuntimeConfig(config);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const client = createPageAssetsClient({ fetchImpl });
    await expect(client.getLatest('report')).rejects.toMatchObject({ code: 'DQE_AUTH_REQUIRED', message: expect.stringContaining('需要登录') });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('Java 详情只展示该服务的最新修订，不混入旧 Node 历史', async () => {
    installRuntimeConfig(config);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(revision));
    const client = createPageAssetsClient({ fetchImpl });
    await expect(client.getDetails('report')).resolves.toMatchObject({ revision, revisions: [revision], historyUnavailable: expect.any(String) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
