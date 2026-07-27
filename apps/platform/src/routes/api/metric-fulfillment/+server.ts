import { json } from '@sveltejs/kit';
import type { SaveBlueprintCommand } from '@metriccanvas/metric-fulfillment';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const pageId = url.searchParams.get('pageId')?.trim();
  if (!pageId) {
    return json(
      {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'pageId 不能为空' }
      },
      { status: 400 }
    );
  }
  const { metricFulfillment } = await getPlatformServices();
  const found = await metricFulfillment.findBlueprintForPage(pageId);
  if (!found.ok) {
    return json(found, {
      status: 404,
      headers: { 'cache-control': 'no-store' }
    });
  }
  const refreshed = await metricFulfillment.refresh(
    { blueprintId: found.snapshot.blueprint.blueprintId },
    { actorId: 'system-sync', clientId: 'workbench-poller' }
  );
  return json(refreshed, {
    headers: { 'cache-control': 'no-store' }
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await requestJson(request);
  if (!isSaveBlueprintCommand(body)) {
    return json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '页面搭建蓝图请求不合法'
        }
      },
      { status: 400 }
    );
  }

  const { metricFulfillment } = await getPlatformServices();
  const result = await metricFulfillment.saveBlueprint(body, {
    actorId: 'developer-1',
    clientId: 'workbench'
  });
  return json(result, {
    status: result.ok ? 201 : 400,
    headers: { 'cache-control': 'no-store' }
  });
};

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSaveBlueprintCommand(value: unknown): value is SaveBlueprintCommand {
  if (!isRecord(value)) return false;
  return (
    (typeof value.blueprintId === 'string' || value.blueprintId === null) &&
    (typeof value.pageId === 'string' || value.pageId === null) &&
    (typeof value.baseRevisionId === 'string' || value.baseRevisionId === null) &&
    typeof value.goal === 'string' &&
    Array.isArray(value.modules) &&
    Array.isArray(value.metricRequests) &&
    typeof value.idempotencyKey === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
