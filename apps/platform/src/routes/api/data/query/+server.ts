import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  dataQueryHttpStatus,
  executeDataQuery,
  getServerDataGateway
} from '$lib/server/data-gateway.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const payload: unknown = await request.json().catch(() => undefined);
  // 浏览器中止取数即断开本请求;request.signal 随之中止,贯穿到上游 DQE。
  const result = await executeDataQuery(
    getServerDataGateway(env),
    payload,
    request.signal
  );
  return json(result, {
    status: dataQueryHttpStatus(result),
    headers: { 'cache-control': 'no-store' }
  });
};
