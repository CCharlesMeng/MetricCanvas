import type { PageDocument } from '@metriccanvas/page';
import type { PageRevision } from '@metriccanvas/page-lifecycle';
import { DqeGatewayError } from '@metriccanvas/engine/dqe';
import {
  MISSING_RUNTIME_CONFIG_MESSAGE,
  readPageAssetsBaseUrl,
  readRuntimeConfig
} from './runtime-config';

export interface PageListItem {
  pageId: string;
  latestRevision: { revisionId: string } | null;
  publishedRevision: { revisionId: string } | null;
  visibility: 'visible' | 'hidden';
}

export interface SavePageRevision {
  baseRevisionId: string | null;
  document: PageDocument | Record<string, unknown>;
  idempotencyKey: string;
  pageIdConfirmed?: boolean;
  dataContextVersion?: string | null;
}

export class PageAssetsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly validationErrors: unknown[] = []
  ) {
    super(message);
    this.name = 'PageAssetsError';
  }
}

/** 仅第一方平台使用；不扩展引擎公开面，不缓存端点或用户身份。 */
export function createPageAssetsClient({
  fetchImpl = fetch,
  applicationBase = ''
}: { fetchImpl?: typeof fetch; applicationBase?: string } = {}) {
  async function request(
    path: string,
    { body, signal, exactRevisionId }: {
      body?: SavePageRevision;
      signal?: AbortSignal;
      exactRevisionId?: string;
    } = {}
  ) {
    const injectedBase = readPageAssetsBaseUrl();
    const headers = new Headers({ accept: 'application/json' });
    if (injectedBase) {
      const config = readRuntimeConfig();
      if (!config) throw new DqeGatewayError('DQE_CONFIG_ERROR', MISSING_RUNTIME_CONFIG_MESSAGE);
      headers.set('X-Auth-Token', config.authToken);
      headers.set('X-Operator-Id', config.operatorId);
      headers.set('X-Workspace-Id', config.workspaceId);
    }
    if (body) headers.set('content-type', 'application/json');
    const prefix = injectedBase ? `${injectedBase.replace(/\/+$/, '')}/pages` : `${applicationBase}/api/pages`;
    const suffix = exactRevisionId === undefined ? path : injectedBase
      ? `${path}/revisions/${encodeURIComponent(exactRevisionId)}`
      : `${path}?${new URLSearchParams({ revisionId: exactRevisionId })}`;
    const response = await fetchImpl(`${prefix}${suffix}`, {
      method: body ? 'POST' : 'GET',
      headers,
      credentials: 'same-origin',
      ...(signal ? { signal } : {}),
      ...(body ? { body: JSON.stringify(injectedBase
        ? { ...body, source: { type: 'manual' }, dataContextVersion: body.dataContextVersion ?? null }
        : body) } : {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = injectedBase ? payload : payload?.error;
      if (response.status === 401) throw new DqeGatewayError('DQE_AUTH_REQUIRED', '需要登录后才能访问页面资产(401)');
      throw new PageAssetsError(
        typeof error?.code === 'string' ? error.code : 'PAGE_ASSETS_HTTP_ERROR',
        typeof error?.message === 'string' ? error.message : `页面资产请求失败:HTTP ${response.status}`,
        response.status,
        error?.validationErrors ?? error?.details?.errors ?? []
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回无效响应', response.status);
    }
    return { payload, injected: Boolean(injectedBase) };
  }

  function revisionOf(payload: unknown): PageRevision {
    const value = payload as Partial<PageRevision> | null;
    if (!value || typeof value.pageId !== 'string' || typeof value.revisionId !== 'string' ||
      typeof value.revisionNumber !== 'number' || !value.document || typeof value.document !== 'object') {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回的修订缺少必填字段', 200);
    }
    return value as PageRevision;
  }

  async function read(pageId: string, revisionId?: string, signal?: AbortSignal) {
    const { payload, injected } = await request(`/${encodeURIComponent(pageId)}`, { exactRevisionId: revisionId, signal });
    return { revision: revisionOf(injected ? payload : payload.revision), injected };
  }

  return {
    async listPages(signal?: AbortSignal): Promise<{ pages: PageListItem[]; nextPageId: string | null }> {
      const { payload, injected } = await request('', { signal });
      if (!Array.isArray(payload.pages)) {
        throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回的目录缺少 pages', 200);
      }
      return {
        pages: injected ? payload.pages.map((item: PageListItem) => ({
          pageId: item.pageId, latestRevision: item.latestRevision,
          publishedRevision: null, visibility: 'visible'
        })) : payload.pages,
        nextPageId: (injected ? payload.nextAfter : payload.nextPageId) ?? null
      };
    },
    async getLatest(pageId: string, signal?: AbortSignal) {
      return (await read(pageId, undefined, signal)).revision;
    },
    async getRevision(pageId: string, revisionId: string, signal?: AbortSignal) {
      return (await read(pageId, revisionId, signal)).revision;
    },
    async getDetails(pageId: string) {
      const { revision, injected } = await read(pageId);
      // Java 首批仅开放最新/精确修订；不能混入旧 Node 服务的另一份历史。
      if (injected) return { revision, revisions: [revision], historyUnavailable: '当前页面资产只支持最新与精确修订读取。' };
      try {
        const { payload } = await request(`/${encodeURIComponent(pageId)}/revisions`);
        return { revision, revisions: payload.revisions as PageRevision[], historyUnavailable: '' };
      } catch (cause) {
        if (cause instanceof PageAssetsError && cause.status === 501) {
          return { revision, revisions: [revision], historyUnavailable: cause.message };
        }
        throw cause;
      }
    },
    async saveRevision(pageId: string, command: SavePageRevision): Promise<PageRevision> {
      const { payload, injected } = await request(`/${encodeURIComponent(pageId)}/revisions`, { body: command });
      return revisionOf(injected ? payload : payload.revision);
    }
  };
}
