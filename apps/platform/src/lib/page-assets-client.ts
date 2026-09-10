import type { PageDocument } from '@metriccanvas/page';
import { DqeGatewayError } from '@metriccanvas/engine/dqe';
import {
  MISSING_RUNTIME_CONFIG_MESSAGE,
  readRuntimeConfig,
  type InjectedRuntimeConfig
} from './runtime-config';

const PAGE_SIZE = 1000;
const HISTORY_UNAVAILABLE = '当前页面资产接口只支持目录与当前修订，尚未开放历史修订读取。';

export interface PageRevision {
  pageId: string;
  revisionId: string;
  revisionNumber: number;
  document: PageDocument;
  baseRevisionId: string | null;
  contentHash: string;
  dataContextVersion: string | null;
  createdBy: string;
  createdAt: string;
}

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

interface ProviderPageMetadata {
  page_metadata_id?: unknown;
  page_id?: unknown;
  revision_id?: unknown;
  revision_number?: unknown;
  page_metadata_definition?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

interface ProviderListResponse extends Record<string, unknown> {
  page_metadata_list?: unknown;
  total?: unknown;
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

/**
 * 静态平台的页面资产客户端。每次请求现读集成门户注入的基址与用户态身份，
 * 直接消费 CDINL2DataBuilderService 已确认的 user-page-metadata 接口。
 */
export function createPageAssetsClient({
  fetchImpl = fetch
}: { fetchImpl?: typeof fetch } = {}) {
  function requireConfig(): InjectedRuntimeConfig {
    const config = readRuntimeConfig();
    if (!config) {
      throw new DqeGatewayError('DQE_CONFIG_ERROR', MISSING_RUNTIME_CONFIG_MESSAGE);
    }
    return config;
  }

  function collectionUrl(config: InjectedRuntimeConfig): string {
    const base = config.pageAssetsBaseUrl.replace(/\/+$/, '');
    return base.endsWith('/user-page-metadata') ? base : `${base}/user-page-metadata`;
  }

  async function request(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    config: InjectedRuntimeConfig,
    { body, signal }: { body?: unknown; signal?: AbortSignal } = {}
  ): Promise<Record<string, unknown>> {
    const headers = new Headers({
      accept: 'application/json',
      'X-Auth-Token': config.authToken,
      'X-Operator-Id': config.operatorId
    });
    if (body !== undefined) headers.set('content-type', 'application/json');
    const response = await fetchImpl(url, {
      method,
      headers,
      credentials: 'same-origin',
      ...(signal ? { signal } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.status === 401) {
      throw new DqeGatewayError('DQE_AUTH_REQUIRED', '需要登录后才能访问页面资产(401)');
    }
    if (!response.ok) throw providerError(payload, response.status);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回无效响应', response.status);
    }
    if (typeof payload.retCode === 'string' && payload.retCode !== '0') {
      throw providerError(payload, response.status);
    }
    return payload;
  }

  async function listRecords(config: InjectedRuntimeConfig, signal?: AbortSignal): Promise<ProviderPageMetadata[]> {
    const records: ProviderPageMetadata[] = [];
    let pageNo = 1;
    while (true) {
      const query = new URLSearchParams({
        pageNo: String(pageNo),
        pageSize: String(PAGE_SIZE),
        needDefinition: 'false'
      });
      const payload = await request('GET', `${collectionUrl(config)}?${query}`, config, { signal }) as ProviderListResponse;
      if (!Array.isArray(payload.page_metadata_list)) {
        throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回的目录缺少 page_metadata_list', 200);
      }
      records.push(...payload.page_metadata_list as ProviderPageMetadata[]);
      const total = typeof payload.total === 'number' ? payload.total : records.length;
      if (records.length >= total || payload.page_metadata_list.length < PAGE_SIZE) return records;
      pageNo += 1;
    }
  }

  async function findRecord(pageId: string, config: InjectedRuntimeConfig, signal?: AbortSignal) {
    const matches = (await listRecords(config, signal)).filter((item) => item.page_id === pageId);
    const record = matches.sort((left, right) => providerRevisionNumber(right) - providerRevisionNumber(left))[0];
    if (!record) throw new PageAssetsError('PAGE_NOT_FOUND', `页面不存在:${pageId}`, 404);
    return { record, metadataId: requiredString(record.page_metadata_id, 'page_metadata_id') };
  }

  async function readCurrent(pageId: string, signal?: AbortSignal): Promise<PageRevision> {
    const config = requireConfig();
    const { metadataId } = await findRecord(pageId, config, signal);
    const payload = await request(
      'GET',
      `${collectionUrl(config)}/${encodeURIComponent(metadataId)}`,
      config,
      { signal }
    );
    const revision = revisionOf(payload, null);
    if (revision.pageId !== pageId) {
      throw new PageAssetsError(
        'PAGE_ID_MISMATCH',
        `页面目录与详情的 page_id 不一致:${pageId} != ${revision.pageId}`,
        409
      );
    }
    return revision;
  }

  return {
    async listPages(signal?: AbortSignal): Promise<{ pages: PageListItem[]; nextPageId: string | null }> {
      const config = requireConfig();
      const records = await listRecords(config, signal);
      const latestByPage = new Map<string, ProviderPageMetadata>();
      for (const record of records) {
        const pageId = requiredString(record.page_id, 'page_id');
        const existing = latestByPage.get(pageId);
        if (!existing || providerRevisionNumber(record) > providerRevisionNumber(existing)) {
          latestByPage.set(pageId, record);
        }
      }
      return {
        pages: [...latestByPage.entries()].map(([pageId, record]) => ({
          pageId,
          latestRevision: typeof record.revision_id === 'string'
            ? { revisionId: record.revision_id }
            : null,
          publishedRevision: null,
          visibility: 'visible'
        })),
        nextPageId: null
      };
    },

    getLatest(pageId: string, signal?: AbortSignal) {
      return readCurrent(pageId, signal);
    },

    async getRevision(pageId: string, revisionId: string, signal?: AbortSignal) {
      const revision = await readCurrent(pageId, signal);
      if (revision.revisionId !== revisionId) {
        throw new PageAssetsError(
          'REVISION_NOT_FOUND',
          `当前页面资产接口无法读取历史修订:${revisionId}`,
          404
        );
      }
      return revision;
    },

    async getDetails(pageId: string) {
      const revision = await readCurrent(pageId);
      return { revision, revisions: [revision], historyUnavailable: HISTORY_UNAVAILABLE };
    },

    async saveRevision(pageId: string, command: SavePageRevision): Promise<PageRevision> {
      const config = requireConfig();
      const collection = collectionUrl(config);
      if (command.baseRevisionId === null) {
        const payload = await request('POST', collection, config, {
          body: {
            page_id: pageId,
            page_metadata_definition: command.document
          }
        });
        return revisionOf(payload, null);
      }
      const { metadataId } = await findRecord(pageId, config);
      const payload = await request(
        'PUT',
        `${collection}/${encodeURIComponent(metadataId)}`,
        config,
        {
          body: {
            page_metadata_definition: command.document,
            base_revision_id: command.baseRevisionId
          }
        }
      );
      return revisionOf(payload, command.baseRevisionId);
    }
  };
}

function revisionOf(
  payload: ProviderPageMetadata,
  baseRevisionId: string | null
): PageRevision {
  return {
    pageId: requiredString(payload.page_id, 'page_id'),
    revisionId: requiredString(payload.revision_id, 'revision_id'),
    revisionNumber: providerRevisionNumber(payload),
    document: pageDocumentOf(payload.page_metadata_definition),
    baseRevisionId,
    contentHash: '',
    dataContextVersion: null,
    // 已确认的提供方响应不含创建人与内容哈希，不用当前操作人伪造审计事实。
    createdBy: '',
    createdAt: typeof payload.created_at === 'string' ? payload.created_at : ''
  };
}

function pageDocumentOf(value: unknown): PageDocument {
  let document = value;
  if (typeof value === 'string') {
    try {
      document = JSON.parse(value);
    } catch {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', 'page_metadata_definition 不是合法 JSON', 200);
    }
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回的修订缺少页面文档', 200);
  }
  return document as PageDocument;
}

function providerRevisionNumber(value: ProviderPageMetadata): number {
  if (typeof value.revision_number !== 'number' || !Number.isInteger(value.revision_number)) {
    throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回的修订缺少 revision_number', 200);
  }
  return value.revision_number;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', `页面资产返回缺少 ${field}`, 200);
  }
  return value;
}

function providerError(payload: Record<string, unknown> | null, status: number): PageAssetsError {
  const code = typeof payload?.code === 'string'
    ? payload.code
    : typeof payload?.retCode === 'string' ? payload.retCode : 'PAGE_ASSETS_HTTP_ERROR';
  const message = typeof payload?.message === 'string'
    ? payload.message
    : typeof payload?.retDesc === 'string' && payload.retDesc
      ? payload.retDesc
      : `页面资产请求失败:HTTP ${status}`;
  const details = payload?.details as { errors?: unknown } | undefined;
  return new PageAssetsError(code, message, status, Array.isArray(details?.errors) ? details.errors : []);
}
