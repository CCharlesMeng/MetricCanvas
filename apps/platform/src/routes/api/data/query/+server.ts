import { json } from '@sveltejs/kit';
import {
  dataQueryHttpStatus,
  executeDataQuery
} from '$lib/server/data-gateway.server';
import {
  bindIdentity,
  getRuntimePlatformServices
} from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const payload: unknown = await request.json().catch(() => undefined);
  const { dataGateway } = bindIdentity(
    await getRuntimePlatformServices(),
    locals.identity
  );
  // 浏览器中止取数即断开本请求;request.signal 随之中止,贯穿到上游 DQE。
  const result = await executeDataQuery(
    dataGateway,
    payload,
    request.signal
  );
  return json(result, {
    status: dataQueryHttpStatus(result),
    headers: { 'cache-control': 'no-store' }
  });
};
