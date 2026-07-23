import type { PageLifecycle } from '@metriccanvas/page-lifecycle';
import type { TemplateLibrary } from '@metriccanvas/template-library';

const seedContext = {
  actorId: 'offline-seed',
  clientId: 'offline-seed',
  roles: ['publisher'] as const
};

const templateSeedContext = {
  actorId: 'offline-seed',
  clientId: 'offline-seed',
  roles: ['admin'] as const
};

export interface OfflineTemplateSeed {
  templateId: string;
  title: string;
  description?: string;
  tags?: string[];
  viewerSubjectIds: string[];
  sourcePageId: string;
}

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

export async function seedPublishedTemplates(
  templates: TemplateLibrary,
  lifecycle: PageLifecycle,
  seeds: OfflineTemplateSeed[]
): Promise<void> {
  const existing = await templates.list(templateSeedContext);
  for (const seed of seeds) {
    const current = existing.templates.find(
      (template) => template.templateId === seed.templateId
    );
    if (current?.publishedRevision) continue;
    const source = await lifecycle.getPublished({ pageId: seed.sourcePageId });
    if (!source.ok) {
      throw new Error(
        `离线页面模板来源尚未发布:${seed.templateId}:${seed.sourcePageId}`
      );
    }
    const saved = await templates.saveRevision(
      {
        templateId: seed.templateId,
        baseRevisionId: current?.latestRevision.revisionId ?? null,
        title: seed.title,
        description: seed.description,
        tags: seed.tags,
        viewerSubjectIds: seed.viewerSubjectIds,
        source: {
          pageId: source.revision.pageId,
          revisionId: source.revision.revisionId
        },
        idempotencyKey: `offline-template-save:${seed.templateId}`
      },
      templateSeedContext
    );
    if (!saved.ok) {
      throw new Error(
        `离线页面模板导入失败:${seed.templateId}:${saved.error.message}`
      );
    }
    const requested = await templates.requestPublish(
      {
        templateId: seed.templateId,
        revisionId: saved.revision.revisionId,
        idempotencyKey: `offline-template-publish:${seed.templateId}`
      },
      templateSeedContext
    );
    if (!requested.ok) {
      throw new Error(
        `离线页面模板申请发布失败:${seed.templateId}:${requested.error.message}`
      );
    }
    const token = new URL(
      requested.request.confirmationUrl,
      'http://localhost'
    ).searchParams.get('token');
    if (!token) {
      throw new Error(`离线页面模板确认链接缺少 token:${seed.templateId}`);
    }
    const confirmed = await templates.confirmPublish(
      { requestId: requested.request.requestId, token },
      templateSeedContext
    );
    if (!confirmed.ok) {
      throw new Error(
        `离线页面模板发布失败:${seed.templateId}:${confirmed.error.message}`
      );
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
