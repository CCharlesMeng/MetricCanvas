import type { PageLifecycle } from '@metriccanvas/page-lifecycle';

const seedContext = {
  actorId: 'offline-seed',
  clientId: 'offline-seed',
  roles: ['publisher'] as const
};

export async function seedPublishedPages(
  lifecycle: PageLifecycle,
  documents: unknown[]
): Promise<void> {
  for (const document of documents) {
    const pageId = pageIdOf(document);
    const existing = await lifecycle.getPublished({ pageId });
    if (existing.ok) continue;

    const latest = await lifecycle.getPage({ pageId, selector: { type: 'latest' } });
    const revision = latest.ok
      ? latest.revision
      : await saveSeedRevision(lifecycle, pageId, document);
    const requested = await lifecycle.requestPublish(
      {
        pageId,
        revisionId: revision.revisionId,
        idempotencyKey: `offline-seed-publish:${pageId}`
      },
      seedContext
    );
    if (!requested.ok) {
      throw new Error(`离线页面申请发布失败:${pageId}:${requested.error.message}`);
    }
    const token = new URL(
      requested.request.confirmationUrl,
      'http://localhost'
    ).searchParams.get('token');
    if (!token) throw new Error(`离线页面确认链接缺少 token:${pageId}`);
    const confirmed = await lifecycle.confirmPublish(
      { requestId: requested.request.requestId, token },
      seedContext
    );
    if (!confirmed.ok) {
      throw new Error(`离线页面发布失败:${pageId}:${confirmed.error.message}`);
    }
  }
}

async function saveSeedRevision(
  lifecycle: PageLifecycle,
  pageId: string,
  document: unknown
) {
  const saved = await lifecycle.saveRevision(
    {
      pageId,
      baseRevisionId: null,
      document,
      idempotencyKey: `offline-seed-save:${pageId}`
    },
    seedContext
  );
  if (!saved.ok) {
    throw new Error(`离线页面导入失败:${pageId}:${saved.error.message}`);
  }
  return saved.revision;
}

function pageIdOf(document: unknown): string {
  if (
    typeof document === 'object' &&
    document !== null &&
    'id' in document &&
    typeof document.id === 'string' &&
    document.id.length > 0
  ) {
    return document.id;
  }
  throw new Error('离线种子不是合法看板页面:缺少 id');
}
