import { canonicalizeJson, validate, type PageDocument } from '@metriccanvas/page';
import { PageAssetsError, type PageRevision, type PageListItem, type SavePageRevision, type AssetRef, type PageAssets, type MutationOutcome } from './contract';
import { DqeGatewayError } from '@metriccanvas/engine/dqe';
import {
  MISSING_RUNTIME_CONFIG_MESSAGE,
  readPageAssetsRuntimeConfig,
  type InjectedRuntimeConfig
} from '../runtime-config';

const PAGE_SIZE = 1000;
const HISTORY_UNAVAILABLE = '当前页面资产接口只支持目录与当前修订，尚未开放历史修订读取。';

interface ProviderPageMetadata {
  is_draft?: unknown;
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

/**
 * 静态平台的页面资产客户端。每次请求现读集成门户注入的基址与用户态身份，
 * 直接消费 CDINL2DataBuilderService 已确认的 user-page-metadata 接口。
 */
export function createPageAssetsClient({
  fetchImpl = fetch
}: { fetchImpl?: typeof fetch } = {}) {
  function requireConfig(): InjectedRuntimeConfig {
    const config = readPageAssetsRuntimeConfig();
    if (!config) {
      throw new DqeGatewayError('DQE_CONFIG_ERROR', MISSING_RUNTIME_CONFIG_MESSAGE);
    }
    return config;
  }

  function collectionUrl(config: InjectedRuntimeConfig): string {
    const base = config.pageMetadataBaseUrl.replace(/\/+$/, '');
    return base.endsWith('/user-page-metadata') ? base : `${base}/user-page-metadata`;
  }

  async function request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    config: InjectedRuntimeConfig,
    { body, signal }: { body?: unknown; signal?: AbortSignal } = {}
  ): Promise<Record<string, unknown>> {
    const headers = new Headers({
      accept: 'application/json',
      'X-Auth-Token': config.authToken,
      'X-Operator-Id': config.operatorId
    });
    if (config.cftk) headers.set('cftk', config.cftk);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const response = await fetchImpl(url, {
      method,
      redirect: 'error',
      headers,
      credentials: 'include',
      ...(signal ? { signal } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (method === 'DELETE' && response.status === 204) return {};
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.status === 401) {
      throw new DqeGatewayError('DQE_AUTH_REQUIRED', '需要登录后才能访问页面资产(401)');
    }
    if (!response.ok) throw providerError(payload, response.status);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回无效响应', response.status);
    }
    if (typeof payload.retCode !== 'string') {
      throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产返回缺少 retCode', response.status);
    }
    // The YAML uses CBC.0000; retain the previously deployed string code during rollout.
    if (payload.retCode !== 'CBC.0000' && payload.retCode !== '0') {
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
    if (matches.length > 1) throw new PageAssetsError('AMBIGUOUS_RESOURCE', '同一页面有多个资源，请从目录选择具体记录。', 409);
    const record = matches[0];
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
    return revisionOf(payload, null, pageId, metadataId);
  }

  const legacy = {
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
          publishedRevision: record.is_draft === false && typeof record.revision_id === 'string'
            ? { revisionId: record.revision_id }
            : null,
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
            page_metadata_definition: command.document,
            is_draft: command.isDraft ?? true
          }
        });
        return revisionOf(payload, null, pageId);
      }
      const metadataId = command.resourceId ?? (await findRecord(pageId, config)).metadataId;
      const payload = await request(
        'PUT',
        `${collection}/${encodeURIComponent(metadataId)}`,
        config,
        {
          body: {
            page_metadata_definition: command.document,
            base_revision_id: command.baseRevisionId,
            is_draft: command.isDraft ?? true,
            ...(command.comment === undefined ? {} : { comment: command.comment })
          }
        }
      );
      return revisionOf(payload, command.baseRevisionId, pageId, metadataId);
    }
  };
  const resourceUrl = (config: InjectedRuntimeConfig, asset: AssetRef) => {
    if (!asset.resourceId || !asset.pageId) throw new PageAssetsError('INVALID_INPUT', '页面资源标识缺失。', 400);
    return `${collectionUrl(config)}/${encodeURIComponent(asset.resourceId)}`;
  };
  async function mutate<T>(action: () => Promise<T>): Promise<MutationOutcome<T>> {
    try { return { status: 'confirmed', value: await action() }; }
    catch (error) {
      if (error instanceof PageAssetsError && [400, 401, 403, 404, 409].includes(error.status)) {
        return { status: 'rejected', code: ({400:'INVALID_REQUEST',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'REVISION_NOT_FOUND',409:'REVISION_CONFLICT'} as Record<number,string>)[error.status], message: error.message };
      }
      if (error instanceof DqeGatewayError && ['DQE_CONFIG_ERROR', 'DQE_AUTH_REQUIRED'].includes(error.code)) {
        return { status: 'rejected', code: error.code === 'DQE_AUTH_REQUIRED' ? 'UNAUTHENTICATED' : 'CONFIG_UNAVAILABLE', message: error.message };
      }
      return { status: 'unknown', message: error instanceof Error ? error.message : '写入结果未确认，请保留工作并核实。' };
    }
  }
  const assets: PageAssets = {
    async list(input, signal) {
      const config = requireConfig();
      const query = new URLSearchParams({pageNo:String(input.page),pageSize:String(input.pageSize),needDefinition:'false'});
      if (input.state) query.set('isDraft', String(input.state === 'draft'));
      const value = await request('GET', `${collectionUrl(config)}?${query}`, config, {signal});
      if (!Array.isArray(value.page_metadata_list) || !Number.isInteger(value.total) || Number(value.total) < 0) throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '目录响应无效。', 200);
      return { total: Number(value.total), items: value.page_metadata_list.map((item: Record<string, unknown>) => ({
        resourceId: requiredString(item.page_metadata_id,'page_metadata_id'), pageId:requiredString(item.page_id,'page_id'),
        revisionId:requiredString(item.revision_id,'revision_id'), revisionNumber:providerRevisionNumber(item),
        state: item.is_draft === true ? 'draft' as const : item.is_draft === false ? 'published' as const : 'unknown' as const,
        description: typeof item.description === 'string' ? item.description : '', updatedAt: typeof item.updated_at === 'string' ? item.updated_at : ''
      })) };
    },
    async resolve(pageId, signal) {
      const {metadataId} = await findRecord(pageId, requireConfig(), signal);
      return {pageId,resourceId:metadataId};
    },
    async read(asset, signal) {
      const config = requireConfig();
      const revision = revisionOf(await request('GET', resourceUrl(config,asset),config,{signal}),null,asset.pageId,asset.resourceId);
      assertDocument(revision.document);
      return revision;
    },
    save(command) {
      return mutate(async () => {
        assertDocument(command.document, 400);
        const pageId = command.target.kind === 'new' ? command.target.pageId : command.target.asset.pageId;
        if (command.document.id !== pageId || (command.target.kind === 'new' && command.intent !== 'saveDraft')) throw new PageAssetsError('INVALID_INPUT','保存目标不匹配。',400);
        if (command.target.kind === 'existing' && !command.target.revisionId) throw new PageAssetsError('INVALID_INPUT','缺少基线修订。',400);
        const revision = await legacy.saveRevision(pageId, {document:command.document, baseRevisionId:command.target.kind === 'new' ? null : command.target.revisionId,
          resourceId:command.target.kind === 'existing' ? command.target.asset.resourceId : undefined,
          isDraft:command.intent === 'saveDraft',comment:command.comment,idempotencyKey:''});
        assertDocument(revision.document);
        if (canonicalizeJson(revision.document) !== canonicalizeJson(command.document) || revision.isDraft !== (command.intent === 'saveDraft') ||
          (command.target.kind === 'existing' && revision.revisionId === command.target.revisionId)) throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR','保存回执与提交内容、状态或修订不匹配。',200);
        return revision;
      });
    },
    async history(asset, signal) {
      const config = requireConfig();
      const value = await request('GET',`${resourceUrl(config,asset)}/history`,config,{signal});
      if (!Array.isArray(value.history_list)) throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR','草稿历史响应无效。',200);
      return value.history_list.map((item: Record<string, unknown>) => {
        if (item.page_metadata_id !== asset.resourceId || !Number.isInteger(item.draft_version) || Number(item.draft_version) < 1) throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR','草稿历史资源或版本不匹配。',200);
        return {historyId:requiredString(item.history_id,'history_id'),draftVersion:Number(item.draft_version),
          createdBy:typeof item.created_by === 'string' ? item.created_by : '',createdAt:typeof item.created_at === 'string' ? item.created_at : '',
          comment:typeof item.comment === 'string' ? item.comment : '',description:typeof item.description === 'string' ? item.description : ''};
      });
    },
    restore({asset,draftVersion}) {
      return mutate(async () => {
        if (!Number.isInteger(draftVersion) || draftVersion < 1) throw new PageAssetsError('INVALID_INPUT','必须选择草稿版本。',400);
        const config = requireConfig();
        const revision = revisionOf(await request('POST',`${resourceUrl(config,asset)}/rollback`,config,{body:{target_draft_version:draftVersion}}),null,asset.pageId,asset.resourceId);
        assertDocument(revision.document); return revision;
      });
    },
    remove(asset) {
      return mutate(async () => { const config = requireConfig(); await request('DELETE',resourceUrl(config,asset),config); });
    }
  };
  return {...legacy,...assets};
}

function assertDocument(document: PageDocument, status = 200) {
  if (validate(document).length) throw new PageAssetsError(status === 400 ? 'INVALID_INPUT' : 'PAGE_ASSETS_RESPONSE_ERROR','页面文档校验失败。',status);
}

function revisionOf(
  payload: ProviderPageMetadata,
  baseRevisionId: string | null,
  expectedPageId: string,
  expectedResourceId?: string
): PageRevision {
  // A successful HTTP response with the wrong identity is an unknown write
  // outcome, not a provider rejection that permits another submission.
  const document = pageDocumentOf(payload.page_metadata_definition);
  const pageId = requiredString(payload.page_id, 'page_id');
  const resourceId = requiredString(payload.page_metadata_id, 'page_metadata_id');
  if (pageId !== expectedPageId || document.id !== expectedPageId) {
    throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产响应与请求的页面 ID 不一致。', 200);
  }
  if (expectedResourceId !== undefined && resourceId !== expectedResourceId) {
    throw new PageAssetsError('PAGE_ASSETS_RESPONSE_ERROR', '页面资产响应与请求的资源 ID 不一致。', 200);
  }
  return {
    ...(typeof payload.is_draft === 'boolean' || payload.is_draft === null
      ? { isDraft: payload.is_draft } : {}),
    resourceId,
    pageId,
    revisionId: requiredString(payload.revision_id, 'revision_id'),
    revisionNumber: providerRevisionNumber(payload),
    document,
    // Absent provider audit fields remain absent, never fabricated from request context.
    ...(typeof payload.created_at === 'string' ? {createdAt:payload.created_at} : {})
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
