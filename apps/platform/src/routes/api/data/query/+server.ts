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
  const result = await executeDataQuery(getServerDataGateway(env), payload);
  return json(result, {
    status: dataQueryHttpStatus(result),
    headers: { 'cache-control': 'no-store' }
  });
};
