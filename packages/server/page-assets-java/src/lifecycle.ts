import type { PageDocument, TypedError } from '@metriccanvas/page';
import type {
  DataContextVersionProvider,
  LifecycleContext,
  LifecycleError,
  LifecycleErrorCode,
  PageLifecycle,
  PageList,
  PageListQuery,
  PageReference,
  PageRevision,
  RevisionReference,
  RevisionResult,
  SaveRevisionCommand
} from '@metriccanvas/page-lifecycle';

/**
 * 第一方 Java 页面资产的 `PageLifecycle` Adapter(ADR-0062 J4)。
 *
 * 四个接口真实调用 `rest-services-page-assets.yaml` 声明的 Interface:保存、读 latest、
 * 读精确修订、目录。其余方法(发布、回滚、历史、差异、已发布读取)返回稳定码
 * `NOT_SUPPORTED`,让 platform 界面如实显示"首批未开放",而不是在失去修订表后半工作。
 * 业务错误按 Java 信封原样映射为 `LifecycleError`;传输层失败(网络、500、非信封响应)
 * 抛 {@link JavaPageAssetsError},与 postgres 实现遇到数据库故障时的行为一致。
 */
export interface JavaPageLifecycleOptions {
  /** Interface 根,含 `{service}` 前缀,如 `http://host:8080/rest/cdi/pageassets/v1`。 */
  baseUrl: string;
  /**
   * 读接口没有 `LifecycleContext`,而 Java 的 `X-Operator-Id` 必填:读取以这一服务态身份进行。
   * 它只出现在请求头,不写入任何修订。缺省 `platform`。
   */
  readOperatorId?: string;
  /** 保存时给修订盖的数据上下文版本;不提供则记 `null`(仅内联页面)。 */
  dataContext?: DataContextVersionProvider;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class JavaPageAssetsError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, status: number | null, code: string | null) {
    super(message);
    this.name = 'JavaPageAssetsError';
    this.status = status;
    this.code = code;
  }
}

interface JavaRevision {
  revisionId: string;
  revisionNumber: number;
  pageId: string;
  baseRevisionId: string | null;
  document: unknown;
  contentHash: string;
  dataContextVersion: string | null;
  createdBy: string;
  createdAt: string;
}

interface JavaErrorEnvelope {
  code: string;
  message: string;
  details: unknown;
}

interface JavaPageList {
  pages: Array<{
    pageId: string;
    latestRevision: { revisionId: string; revisionNumber: number; createdAt: string };
  }>;
  nextAfter: string | null;
}

/** Java 业务闭集(加 J2 登记的两个传输层码)中可以直接成为 `LifecycleErrorCode` 的部分。 */
const BUSINESS_CODES: ReadonlySet<LifecycleErrorCode> = new Set<LifecycleErrorCode>([
  'INVALID_PAGE',
  'PAGE_ID_MISMATCH',
  'PAGE_ID_CONFIRMATION_REQUIRED',
  'PAGE_NOT_FOUND',
  'REVISION_NOT_FOUND',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'NOT_SUPPORTED'
]);

const NOT_SUPPORTED_MESSAGE =
  '首批 Java 页面资产未开放此能力(ADR-0062):当前只支持保存、读取最新 / 精确修订与页面目录。';

export function createJavaPageLifecycle(options: JavaPageLifecycleOptions): PageLifecycle {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Java 页面资产 baseUrl 不能为空');
  const readOperatorId = options.readOperatorId ?? 'platform';
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function call(
    method: 'GET' | 'POST',
    path: string,
    operatorId: string,
    body?: unknown
  ): Promise<{ status: number; payload: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          'x-operator-id': operatorId,
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (cause) {
      throw new JavaPageAssetsError(
        `Java 页面资产不可达(${baseUrl}):${cause instanceof Error ? cause.message : String(cause)}`,
        null,
        null
      );
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    return { status: response.status, payload };
  }

  function failure(status: number, payload: unknown): { ok: false; error: LifecycleError } {
    const envelope = asEnvelope(payload);
    if (!envelope || !BUSINESS_CODES.has(envelope.code as LifecycleErrorCode)) {
      throw new JavaPageAssetsError(
        envelope
          ? `Java 页面资产返回 ${envelope.code}(HTTP ${status}):${envelope.message}`
          : `Java 页面资产返回 HTTP ${status} 且没有错误信封`,
        status,
        envelope?.code ?? null
      );
    }
    const error: LifecycleError = {
      code: envelope.code as LifecycleErrorCode,
      message: envelope.message
    };
    if (envelope.code === 'INVALID_PAGE') {
      error.validationErrors = validationErrorsOf(envelope.details);
    }
    return { ok: false, error };
  }

  async function readRevision(
    path: string,
    operatorId: string = readOperatorId
  ): Promise<RevisionResult> {
    const { status, payload } = await call('GET', path, operatorId);
    if (status === 200) return { ok: true, revision: toRevision(payload) };
    return failure(status, payload);
  }

  const notSupported = async <T>(): Promise<T> =>
    ({ ok: false, error: { code: 'NOT_SUPPORTED', message: NOT_SUPPORTED_MESSAGE } }) as T;

  return {
    async saveRevision(command: SaveRevisionCommand, context: LifecycleContext) {
      const dataContextVersion = options.dataContext
        ? (await options.dataContext.current()).version
        : null;
      const { status, payload } = await call(
        'POST',
        `/pages/${encodeURIComponent(command.pageId)}/revisions`,
        context.actorId,
        {
          baseRevisionId: command.baseRevisionId,
          document: command.document,
          idempotencyKey: command.idempotencyKey,
          pageIdConfirmed: command.pageIdConfirmed === true,
          source: { type: 'manual' },
          dataContextVersion
        }
      );
      if (status === 201) return { ok: true, revision: toRevision(payload) };
      const result = failure(status, payload);
      if (result.error.code === 'REVISION_CONFLICT') {
        result.error.currentLatestRevision = await currentLatestOf(
          command.pageId,
          asEnvelope(payload)?.details,
          context.actorId
        );
      }
      return result;
    },

    getRevision(reference: RevisionReference) {
      return readRevision(
        `/pages/${encodeURIComponent(reference.pageId)}/revisions/${encodeURIComponent(reference.revisionId)}`
      );
    },

    getPage(reference: PageReference) {
      switch (reference.selector.type) {
        case 'latest':
          return readRevision(`/pages/${encodeURIComponent(reference.pageId)}`);
        case 'exact':
          return readRevision(
            `/pages/${encodeURIComponent(reference.pageId)}/revisions/${encodeURIComponent(reference.selector.revisionId)}`
          );
        case 'published':
          return notSupported<RevisionResult>();
      }
    },

    async listPages(query: PageListQuery = {}): Promise<PageList> {
      const search = new URLSearchParams();
      if (query.afterPageId) search.set('after', query.afterPageId);
      if (query.limit !== undefined) search.set('limit', String(query.limit));
      const encoded = search.toString();
      const suffix = encoded ? `?${encoded}` : '';
      const { status, payload } = await call('GET', `/pages${suffix}`, readOperatorId);
      if (status !== 200) {
        failure(status, payload);
        throw new JavaPageAssetsError(`listPages 返回 HTTP ${status}`, status, null);
      }
      const list = payload as JavaPageList;
      return {
        pages: list.pages.map((page) => ({
          pageId: page.pageId,
          latestRevision: { pageId: page.pageId, revisionId: page.latestRevision.revisionId },
          // 首批没有发布表:目录里没有"已发布"概念,页面一律可见。
          publishedRevision: null,
          visibility: 'visible'
        })),
        nextPageId: list.nextAfter
      };
    },

    listRevisionHistory: notSupported,
    diffRevisions: notSupported,
    requestPublish: notSupported,
    getPublishRequest: notSupported,
    confirmPublish: notSupported,
    rejectPublish: notSupported,
    cancelPublish: notSupported,
    forceReleasePublish: notSupported,
    listPublishAudit: notSupported,
    rollbackRevision: notSupported,
    getPublished: notSupported,
    getPublishedRevision: notSupported,

    async close() {
      // HTTP 无连接池状态可关。
    }
  };

  /**
   * Java 的 `REVISION_CONFLICT` 只携带 `currentLatest { revisionId, revisionNumber } | null`
   * (ADR-0062 明确拒绝返回完整修订);`LifecycleError` 的契约是完整 `PageRevision`,
   * 这里补一次读取。读不到(刚被别人删了、竟态)就按 null 处理,不让保存失败再失败一次。
   */
  async function currentLatestOf(
    pageId: string,
    details: unknown,
    operatorId: string
  ): Promise<PageRevision | null> {
    const ref =
      typeof details === 'object' && details !== null
        ? (details as { currentLatest?: { revisionId?: unknown } | null }).currentLatest
        : null;
    if (!ref || typeof ref.revisionId !== 'string') return null;
    try {
      const result = await readRevision(
        `/pages/${encodeURIComponent(pageId)}/revisions/${encodeURIComponent(ref.revisionId)}`,
        operatorId
      );
      return result.ok ? result.revision : null;
    } catch {
      return null;
    }
  }
}

function asEnvelope(payload: unknown): JavaErrorEnvelope | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidate = payload as Partial<JavaErrorEnvelope>;
  if (typeof candidate.code !== 'string') return null;
  return {
    code: candidate.code,
    message: typeof candidate.message === 'string' ? candidate.message : candidate.code,
    details: candidate.details ?? null
  };
}

function validationErrorsOf(details: unknown): TypedError[] {
  if (typeof details !== 'object' || details === null) return [];
  const errors = (details as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (entry): entry is TypedError =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as TypedError).type === 'string' &&
      typeof (entry as TypedError).path === 'string' &&
      typeof (entry as TypedError).message === 'string'
  );
}

function toRevision(payload: unknown): PageRevision {
  const row = payload as JavaRevision;
  if (
    typeof row !== 'object' ||
    row === null ||
    typeof row.revisionId !== 'string' ||
    typeof row.pageId !== 'string' ||
    typeof row.revisionNumber !== 'number'
  ) {
    throw new JavaPageAssetsError('Java 页面资产返回的修订缺少必填字段', null, null);
  }
  return {
    revisionId: row.revisionId,
    revisionNumber: row.revisionNumber,
    pageId: row.pageId,
    baseRevisionId: row.baseRevisionId ?? null,
    // Java 在保存时已完整复验(结构 + 全部不变式),这里不重复解析,修订原样交给运行时。
    document: row.document as PageDocument,
    contentHash: row.contentHash,
    dataContextVersion: row.dataContextVersion ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt
  };
}
