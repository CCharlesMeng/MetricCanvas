import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
  dimensionValuesHttpStatus,
  executeDimensionValues,
  getServerDataGateway
} from '$lib/server/data-gateway.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const payload: unknown = await request.json().catch(() => undefined);
  const result = await executeDimensionValues(
    getServerDataGateway(env),
    payload,
    request.signal
  );
  return json(result, {
    status: dimensionValuesHttpStatus(result),
    headers: { 'cache-control': 'no-store' }
  });
};
