import { json } from '@sveltejs/kit';
import {
  dimensionValuesHttpStatus,
  executeDimensionValues
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
  const result = await executeDimensionValues(
    dataGateway,
    payload,
    request.signal
  );
  return json(result, {
    status: dimensionValuesHttpStatus(result),
    headers: { 'cache-control': 'no-store' }
  });
};
