import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import { createJavaPageLifecycle, JavaPageAssetsError } from '../src';

/**
 * 契约测试:用一个按 rest-services-page-assets.yaml 信封说话的替身 Java,证明 Adapter 把四个
 * Interface 映射成 `PageLifecycle`,其余方法返回 `NOT_SUPPORTED`。真实 Java 的端到端走
 * `pnpm slice:page-assets`。
 */

interface RecordedRequest {
  method: string;
  url: string;
  operator: string | undefined;
  contentType: string | undefined;
  body: unknown;
}

const REVISION = {
  revisionId: '0123456789abcdef0123456789abcdef',
  revisionNumber: 2,
  pageId: 'tokens-by-region',
  baseRevisionId: 'ffffffffffffffffffffffffffffffff',
  document: { schemaVersion: '5.4', id: 'tokens-by-region', sections: [] },
  contentHash: 'c'.repeat(64),
  dataContextVersion: '2026-09-02.1',
  source: { type: 'manual' },
  createdBy: 'developer-1',
  createdAt: '2026-09-02T10:00:00.000Z'
};

const CONTEXT: LifecycleContext = { actorId: 'developer-1', clientId: 'page-editor' };

type Responder = (request: RecordedRequest) => { status: number; body: unknown };

let server: Server;
let baseUrl: string;
let requests: RecordedRequest[];
let respond: Responder;

async function readBody(message: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of message) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

beforeEach(async () => {
  requests = [];
  respond = () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'unset', details: null } });
  server = createServer(async (message: IncomingMessage, response: ServerResponse) => {
    const recorded: RecordedRequest = {
      method: message.method ?? '',
      url: message.url ?? '',
      operator: message.headers['x-operator-id'] as string | undefined,
      contentType: message.headers['content-type'],
      body: await readBody(message)
    };
    requests.push(recorded);
    const { status, body } = respond(recorded);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body === undefined ? '' : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}/rest/cdi/testsvc/v1/`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

describe('createJavaPageLifecycle', () => {
  it('saveRevision posts the Interface body with the actor as X-Operator-Id', async () => {
    respond = () => ({ status: 201, body: REVISION });
    const lifecycle = createJavaPageLifecycle({
      baseUrl,
      dataContext: { current: async () => ({ version: '2026-09-02.1' }) }
    });

    const result = await lifecycle.saveRevision(
      {
        pageId: 'tokens-by-region',
        baseRevisionId: REVISION.baseRevisionId,
        document: REVISION.document,
        idempotencyKey: 'tokens-by-region:k1',
        pageIdConfirmed: true
      },
      CONTEXT
    );

    expect(result).toEqual({
      ok: true,
      revision: {
        revisionId: REVISION.revisionId,
        revisionNumber: 2,
        pageId: 'tokens-by-region',
        baseRevisionId: REVISION.baseRevisionId,
        document: REVISION.document,
        contentHash: REVISION.contentHash,
        dataContextVersion: '2026-09-02.1',
        createdBy: 'developer-1',
        createdAt: REVISION.createdAt
      }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/rest/cdi/testsvc/v1/pages/tokens-by-region/revisions',
      operator: 'developer-1',
      contentType: 'application/json',
      body: {
        baseRevisionId: REVISION.baseRevisionId,
        document: REVISION.document,
        idempotencyKey: 'tokens-by-region:k1',
        pageIdConfirmed: true,
        source: { type: 'manual' },
        dataContextVersion: '2026-09-02.1'
      }
    });
  });

  it('maps INVALID_PAGE details to validationErrors', async () => {
    respond = () => ({
      status: 422,
      body: {
        code: 'INVALID_PAGE',
        message: '页面未通过校验',
        details: { errors: [{ type: 'schema', path: '/schemaVersion', message: 'required' }] }
      }
    });
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    const result = await lifecycle.saveRevision(
      { pageId: 'p', baseRevisionId: null, document: {}, idempotencyKey: 'p:k' },
      CONTEXT
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_PAGE',
        message: '页面未通过校验',
        validationErrors: [{ type: 'schema', path: '/schemaVersion', message: 'required' }]
      }
    });
    expect(requests[0]?.body).toMatchObject({ dataContextVersion: null, pageIdConfirmed: false });
  });

  it('REVISION_CONFLICT reads the current latest revision the envelope points at', async () => {
    respond = (request) =>
      request.method === 'POST'
        ? {
            status: 409,
            body: {
              code: 'REVISION_CONFLICT',
              message: '保存基线不是当前最新页面修订',
              details: { currentLatest: { revisionId: REVISION.revisionId, revisionNumber: 2 } }
            }
          }
        : { status: 200, body: REVISION };
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    const result = await lifecycle.saveRevision(
      { pageId: 'tokens-by-region', baseRevisionId: 'a'.repeat(32), document: {}, idempotencyKey: 'k' },
      CONTEXT
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('REVISION_CONFLICT');
    expect(result.error.currentLatestRevision?.revisionId).toBe(REVISION.revisionId);
    expect(requests.map((request) => request.url)).toEqual([
      '/rest/cdi/testsvc/v1/pages/tokens-by-region/revisions',
      `/rest/cdi/testsvc/v1/pages/tokens-by-region/revisions/${REVISION.revisionId}`
    ]);
    expect(requests[1]?.operator).toBe('developer-1');
  });

  it('first-save conflict without a latest keeps currentLatestRevision null', async () => {
    respond = () => ({
      status: 409,
      body: { code: 'REVISION_CONFLICT', message: '首次保存的 baseRevisionId 必须为 null', details: { currentLatest: null } }
    });
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    const result = await lifecycle.saveRevision(
      { pageId: 'p', baseRevisionId: 'a'.repeat(32), document: {}, idempotencyKey: 'k' },
      CONTEXT
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'REVISION_CONFLICT',
        message: '首次保存的 baseRevisionId 必须为 null',
        currentLatestRevision: null
      }
    });
    expect(requests).toHaveLength(1);
  });

  it('getPage latest / exact and getRevision hit the read Interfaces with the read operator', async () => {
    respond = () => ({ status: 200, body: REVISION });
    const lifecycle = createJavaPageLifecycle({ baseUrl, readOperatorId: 'platform-reader' });

    await lifecycle.getPage({ pageId: 'tokens-by-region', selector: { type: 'latest' } });
    await lifecycle.getPage({
      pageId: 'tokens-by-region',
      selector: { type: 'exact', revisionId: REVISION.revisionId }
    });
    const exact = await lifecycle.getRevision({
      pageId: 'tokens-by-region',
      revisionId: REVISION.revisionId
    });

    expect(exact.ok && exact.revision.revisionNumber).toBe(2);
    expect(requests.map((request) => [request.method, request.url, request.operator])).toEqual([
      ['GET', '/rest/cdi/testsvc/v1/pages/tokens-by-region', 'platform-reader'],
      ['GET', `/rest/cdi/testsvc/v1/pages/tokens-by-region/revisions/${REVISION.revisionId}`, 'platform-reader'],
      ['GET', `/rest/cdi/testsvc/v1/pages/tokens-by-region/revisions/${REVISION.revisionId}`, 'platform-reader']
    ]);
  });

  it('not-found codes pass through unchanged', async () => {
    respond = (request) => ({
      status: 404,
      body: request.url.includes('/revisions/')
        ? { code: 'REVISION_NOT_FOUND', message: '修订不存在', details: null }
        : { code: 'PAGE_NOT_FOUND', message: '页面不存在', details: null }
    });
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    expect(await lifecycle.getPage({ pageId: 'missing', selector: { type: 'latest' } })).toEqual({
      ok: false,
      error: { code: 'PAGE_NOT_FOUND', message: '页面不存在' }
    });
    expect(await lifecycle.getRevision({ pageId: 'p', revisionId: 'x'.repeat(32) })).toEqual({
      ok: false,
      error: { code: 'REVISION_NOT_FOUND', message: '修订不存在' }
    });
  });

  it('listPages projects the catalog with after/limit and no published concept', async () => {
    respond = () => ({
      status: 200,
      body: {
        pages: [
          {
            pageId: 'a',
            latestRevision: { revisionId: '1'.repeat(32), revisionNumber: 3, createdAt: REVISION.createdAt }
          }
        ],
        nextAfter: 'a'
      }
    });
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    const list = await lifecycle.listPages({ afterPageId: 'Z', limit: 1 });
    expect(list).toEqual({
      pages: [
        {
          pageId: 'a',
          latestRevision: { pageId: 'a', revisionId: '1'.repeat(32) },
          publishedRevision: null,
          visibility: 'visible'
        }
      ],
      nextPageId: 'a'
    });
    expect(requests[0]?.url).toBe('/rest/cdi/testsvc/v1/pages?after=Z&limit=1');
    await lifecycle.listPages();
    expect(requests[1]?.url).toBe('/rest/cdi/testsvc/v1/pages');
  });

  it('everything outside the four Interfaces is NOT_SUPPORTED without touching the network', async () => {
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    const results = await Promise.all([
      lifecycle.getPage({ pageId: 'p', selector: { type: 'published' } }),
      lifecycle.listRevisionHistory({ pageId: 'p' }),
      lifecycle.diffRevisions({ pageId: 'p', fromRevisionId: 'a', toRevisionId: 'b' }),
      lifecycle.requestPublish({ pageId: 'p', revisionId: 'a', idempotencyKey: 'k' }, CONTEXT),
      lifecycle.getPublishRequest({ requestId: 'r' }, CONTEXT),
      lifecycle.confirmPublish({ requestId: 'r', token: 't' }, CONTEXT),
      lifecycle.rejectPublish({ requestId: 'r', token: 't' }, CONTEXT),
      lifecycle.cancelPublish({ requestId: 'r' }, CONTEXT),
      lifecycle.forceReleasePublish({ requestId: 'r', reason: 'x' }, CONTEXT),
      lifecycle.listPublishAudit({ requestId: 'r' }, CONTEXT),
      lifecycle.rollbackRevision({ pageId: 'p', targetRevisionId: 'a', idempotencyKey: 'k' }, CONTEXT),
      lifecycle.getPublished({ pageId: 'p' }),
      lifecycle.getPublishedRevision({ pageId: 'p', revisionId: 'a' })
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('NOT_SUPPORTED');
    }
    expect(requests).toHaveLength(0);
    await lifecycle.close();
  });

  it('transport-level failures throw instead of masquerading as business errors', async () => {
    respond = () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom', details: null } });
    const lifecycle = createJavaPageLifecycle({ baseUrl });
    await expect(
      lifecycle.getPage({ pageId: 'p', selector: { type: 'latest' } })
    ).rejects.toBeInstanceOf(JavaPageAssetsError);

    respond = () => ({ status: 502, body: undefined });
    await expect(lifecycle.listPages()).rejects.toThrow(/HTTP 502/);

    const unreachable = createJavaPageLifecycle({ baseUrl: 'http://127.0.0.1:9/rest/cdi/x/v1' });
    await expect(unreachable.listPages()).rejects.toThrow(/不可达/);
  });
});
