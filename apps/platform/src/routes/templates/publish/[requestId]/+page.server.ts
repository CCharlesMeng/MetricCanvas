import { error, fail } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { Actions, PageServerLoad } from './$types';

const confirmationContext = {
  actorId: 'developer-1',
  clientId: 'template-publish-confirmation',
  roles: ['admin'] as const
};

export const load: PageServerLoad = async ({ params }) => {
  const { templates } = await getPlatformServices();
  const result = await templates.getPublishRequest(
    { requestId: params.requestId },
    confirmationContext
  );
  if (!result.ok) {
    error(
      result.error.code === 'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND' ? 404 : 403,
      { message: result.error.message }
    );
  }
  const listed = await templates.list(confirmationContext);
  const template = listed.templates.find(
    (candidate) => candidate.templateId === result.request.templateId
  );
  const revision =
    template?.latestRevision.revisionId === result.request.revisionId
      ? template.latestRevision
      : template?.publishedRevision?.revisionId === result.request.revisionId
        ? template.publishedRevision
        : null;
  if (!revision) error(404, { message: '模板发布请求绑定的模板修订不存在' });
  return { request: result.request, revision };
};

export const actions: Actions = {
  default: async ({ params, url }) => {
    const token = url.searchParams.get('token');
    if (!token) {
      return fail(400, {
        error: {
          code: 'MISSING_TEMPLATE_CONFIRMATION_TOKEN',
          message: '确认链接缺少 token'
        }
      });
    }
    const { templates } = await getPlatformServices();
    const result = await templates.confirmPublish(
      { requestId: params.requestId, token },
      confirmationContext
    );
    if (!result.ok) return fail(409, { error: result.error });
    return {
      success: true,
      templateId: result.revision.templateId,
      revisionId: result.revision.revisionId
    };
  }
};
