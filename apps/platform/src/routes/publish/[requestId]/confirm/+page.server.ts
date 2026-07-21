import { error, fail } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { Actions, PageServerLoad } from './$types';

const confirmationContext = {
  actorId: 'developer-1',
  clientId: 'publish-confirmation'
};

export const load: PageServerLoad = async ({ params }) => {
  const { lifecycle, runtimeOrigin } = await getPlatformServices();
  const result = await lifecycle.getPublishRequest(
    { requestId: params.requestId },
    confirmationContext
  );
  if (!result.ok) {
    error(result.error.code === 'PUBLISH_REQUEST_NOT_FOUND' ? 404 : 403, {
      message: result.error.message
    });
  }
  const revision = await lifecycle.getRevision({
    pageId: result.request.pageId,
    revisionId: result.request.revisionId
  });
  if (!revision.ok) {
    error(404, { message: revision.error.message });
  }
  return {
    request: result.request,
    revision: {
      revisionNumber: revision.revision.revisionNumber,
      metadataVersion: revision.revision.metadataVersion,
      contentHash: revision.revision.contentHash,
      createdBy: revision.revision.createdBy,
      createdAt: revision.revision.createdAt
    },
    previewUrl:
      `${runtimeOrigin}/pages/${encodeURIComponent(result.request.pageId)}` +
      `?revision=${encodeURIComponent(result.request.revisionId)}`
  };
};

export const actions: Actions = {
  default: async ({ params, url }) => {
    const token = url.searchParams.get('token');
    if (!token) {
      return fail(400, {
        error: { code: 'MISSING_CONFIRMATION_TOKEN', message: '确认链接缺少 token' }
      });
    }
    const { lifecycle, runtimeOrigin } = await getPlatformServices();
    const result = await lifecycle.confirmPublish(
      { requestId: params.requestId, token },
      confirmationContext
    );
    if (!result.ok) {
      return fail(409, { error: result.error });
    }
    return {
      success: true,
      pageId: result.revision.pageId,
      revisionId: result.revision.revisionId,
      publishedUrl: `${runtimeOrigin}/pages/${result.revision.pageId}`
    };
  }
};
