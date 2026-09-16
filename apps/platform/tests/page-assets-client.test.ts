import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageAssetsClient } from '../src/lib/page-assets-client';
import { createAuthoringCoordinator, confirmedPageAssetCapabilities } from '../src/lib/workbench/authoring-coordinator';
import { installRuntimeConfig } from '../src/lib/runtime-config';

const config = {
  dqeEndpoint: '/dqe',
  pageAssetsBaseUrl: 'https://pages.example/rest/cdi/cdinl2databuilderservice/v1/',
  authToken: 'token-1',
  operatorId: 'operator-1',
  workspaceId: 'ws-1'
};
const document = { id: 'report', schemaVersion: '6.0', title: '报告' };
const providerRevision = {
  retCode: '0',
  retDesc: '',
  page_metadata_id: 'metadata-1',
  page_id: 'report',
  revision_id: 'rev-1',
  revision_number: 1,
  page_metadata_definition: JSON.stringify(document),
  created_at: '2026-09-08T00:00:00Z',
  updated_at: '2026-09-08T00:00:00Z'
};
const command = {
  baseRevisionId: null,
  document,
  idempotencyKey: 'save-1',
  pageIdConfirmed: true
};

afterEach(() => installRuntimeConfig(null));

describe('静态平台页面资产客户端', () => {
  it('目录与详情按已确认的 user-page-metadata 契约读取', async () => {
    installRuntimeConfig(config);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createPageAssetsClient({
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        return String(input).includes('?')
          ? Response.json({
              retCode: '0',
              page_metadata_list: [providerRevision],
              total: 1,
              page_no: 1,
              page_size: 1000
            })
          : Response.json(providerRevision);
      }
    });

    await expect(client.listPages()).resolves.toEqual({
      pages: [{
        pageId: 'report',
        latestRevision: { revisionId: 'rev-1' },
        publishedRevision: null,
        visibility: 'visible'
      }],
      nextPageId: null
    });
    await expect(client.getLatest('report')).resolves.toMatchObject({
      pageId: 'report',
      revisionId: 'rev-1',
      revisionNumber: 1,
      document
    });

    expect(calls.map((call) => call.url)).toEqual([
      `${config.pageAssetsBaseUrl}user-page-metadata?pageNo=1&pageSize=1000&needDefinition=false`,
      `${config.pageAssetsBaseUrl}user-page-metadata?pageNo=1&pageSize=1000&needDefinition=false`,
      `${config.pageAssetsBaseUrl}user-page-metadata/metadata-1`
    ]);
    for (const { init } of calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Auth-Token')).toBe('token-1');
      expect(headers.get('X-Operator-Id')).toBe('operator-1');
      expect(headers.has('X-Workspace-Id')).toBe(false);
    }
  });

  it('首建使用 POST，后续修订先解析记录 id 再使用 PUT', async () => {
    installRuntimeConfig(config);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createPageAssetsClient({
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        if (String(input).includes('?')) {
          return Response.json({ retCode: '0', page_metadata_list: [providerRevision], total: 1 });
        }
        return Response.json({ ...providerRevision, revision_id: init?.method === 'PUT' ? 'rev-2' : 'rev-1', revision_number: init?.method === 'PUT' ? 2 : 1 });
      }
    });

    await client.saveRevision('report', command);
    await expect(client.saveRevision('report', { ...command, baseRevisionId: 'rev-1' }))
      .resolves.toMatchObject({ revisionId: 'rev-2', revisionNumber: 2, baseRevisionId: 'rev-1' });

    expect(calls.map(({ url, init }) => [init?.method, url])).toEqual([
      ['POST', `${config.pageAssetsBaseUrl}user-page-metadata`],
      ['GET', `${config.pageAssetsBaseUrl}user-page-metadata?pageNo=1&pageSize=1000&needDefinition=false`],
      ['PUT', `${config.pageAssetsBaseUrl}user-page-metadata/metadata-1`]
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      page_id: 'report',
      page_metadata_definition: document
    });
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      page_metadata_definition: document,
      base_revision_id: 'rev-1'
    });
  });

  it('每次请求现读基址与身份，不保留 Node 同源回退', async () => {
    installRuntimeConfig(config);
    const calls: Array<{ url: string; headers: Headers }> = [];
    const client = createPageAssetsClient({
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), headers: new Headers(init?.headers) });
        return Response.json({ retCode: '0', page_metadata_list: [], total: 0 });
      }
    });
    await client.listPages();
    installRuntimeConfig({
      ...config,
      pageAssetsBaseUrl: '/new-assets/user-page-metadata',
      authToken: 'token-2',
      operatorId: 'operator-2'
    });
    await client.listPages();
    expect(calls[1]?.url).toBe('/new-assets/user-page-metadata?pageNo=1&pageSize=1000&needDefinition=false');
    expect(calls[1]?.headers.get('X-Auth-Token')).toBe('token-2');
    expect(calls[1]?.headers.get('X-Operator-Id')).toBe('operator-2');
  });

  it('未注入完整配置时在发网前失败', async () => {
    installRuntimeConfig({ ...config, pageAssetsBaseUrl: '' });
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createPageAssetsClient({ fetchImpl });
    await expect(client.listPages()).rejects.toMatchObject({
      code: 'DQE_CONFIG_ERROR',
      message: '集成应用未注入运行配置'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('精确修订只能命中当前修订，不伪造历史读取', async () => {
    installRuntimeConfig(config);
    const client = createPageAssetsClient({
      fetchImpl: async (input) => String(input).includes('?')
        ? Response.json({ retCode: '0', page_metadata_list: [providerRevision], total: 1 })
        : Response.json(providerRevision)
    });
    await expect(client.getRevision('report', 'rev-1')).resolves.toMatchObject({ revisionId: 'rev-1' });
    await expect(client.getRevision('report', 'old-rev')).rejects.toMatchObject({
      code: 'REVISION_NOT_FOUND',
      status: 404
    });
  });

  it('HTTP 401 报告需要登录，CommonRsp 业务失败保留返回码', async () => {
    installRuntimeConfig(config);
    const unauthorized = createPageAssetsClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    });
    await expect(unauthorized.listPages()).rejects.toMatchObject({
      code: 'DQE_AUTH_REQUIRED',
      message: expect.stringContaining('需要登录')
    });

    const failed = createPageAssetsClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ retCode: 'E42', retDesc: '服务拒绝' }))
    });
    await expect(failed.listPages()).rejects.toMatchObject({ code: 'E42', message: '服务拒绝' });
  });
});

it('rejects malformed CommonRsp and sends an explicit resource ID without rediscovering latest', async () => {
  installRuntimeConfig(config);
  const malformed = createPageAssetsClient({ fetchImpl: async () => Response.json({ ...providerRevision, retCode: 0 }) });
  await expect(malformed.getLatest('report')).rejects.toMatchObject({ code: 'PAGE_ASSETS_RESPONSE_ERROR' });
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...providerRevision, page_metadata_id: 'metadata-exact' }));
  const client = createPageAssetsClient({ fetchImpl });
  await client.saveRevision('report', { ...command, baseRevisionId: 'rev-0', resourceId: 'metadata-exact' });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(String(fetchImpl.mock.calls[0][0])).toContain('/user-page-metadata/metadata-exact');
  expect(fetchImpl.mock.calls[0][1]?.method).toBe('PUT');
});

it.each([
  ['resource', { page_metadata_id: 'other-resource' }],
  ['page', { page_id: 'other-page' }],
  ['document', { page_metadata_definition: JSON.stringify({ ...document, id: 'other-page' }) }]
])('rejects mismatched %s identity from current detail and update receipts', async (_field, mismatch) => {
  installRuntimeConfig(config);
  const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).includes('?')
    ? Response.json({ retCode: '0', page_metadata_list: [providerRevision], total: 1 })
    : Response.json({ ...providerRevision, ...mismatch }));
  const client = createPageAssetsClient({ fetchImpl });
  await expect(client.getLatest('report')).rejects.toMatchObject({ code: 'PAGE_ASSETS_RESPONSE_ERROR' });
  await expect(client.saveRevision('report', { ...command, baseRevisionId: 'rev-0', resourceId: 'metadata-1' }))
    .rejects.toMatchObject({ code: 'PAGE_ASSETS_RESPONSE_ERROR' });
});

it.each([
  { page_id: 'other-page' },
  { page_metadata_definition: JSON.stringify({ ...document, id: 'other-page' }) }
])('rejects wrong-page creation receipts', async (mismatch) => {
  installRuntimeConfig(config);
  const client = createPageAssetsClient({ fetchImpl: async () => Response.json({ ...providerRevision, ...mismatch }) });
  await expect(client.saveRevision('report', command)).rejects.toMatchObject({ code: 'PAGE_ASSETS_RESPONSE_ERROR' });
});


it('keeps a mismatched HTTP success unknown and prevents resubmission through the workbench', async () => {
  installRuntimeConfig(config);
  const page = { schemaVersion: '6.1', layout: 'report', id: 'report', dataSources: {}, sections: [
    { id: 's', title: 's', container: 'panel', components: [
      { id: 't', type: 'text', layout: { span: 12 }, props: { title: '标题', body: '正文' } }
    ] }
  ] };
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => String(input).includes('?')
    ? Response.json({ retCode: '0', page_metadata_list: [providerRevision], total: 1 })
    : Response.json({ ...providerRevision, page_metadata_definition: JSON.stringify(page),
        page_metadata_id: init?.method === 'PUT' ? 'wrong-resource' : 'metadata-1' }));
  const client = createPageAssetsClient({ fetchImpl });
  const coordinator = createAuthoringCoordinator({
    port: { ...client, capabilities: confirmedPageAssetCapabilities },
    identity: () => ({ actorId: 'operator-1', workspaceId: 'ws-1' }), operationId: () => 'save-1'
  });
  await coordinator.load('report');
  await expect(coordinator.save()).resolves.toMatchObject({ status: 'unknown' });
  await coordinator.save();
  expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  expect(coordinator.snapshot().ref?.resourceId).toBe('metadata-1');
  expect(coordinator.snapshot().draft?.pageDocument).toEqual(page);
  coordinator.dispose();
});
