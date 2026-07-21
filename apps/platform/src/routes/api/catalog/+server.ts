import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const { catalog } = await getPlatformServices();
  const current = await catalog.current();
  return json(current, { headers: { 'cache-control': 'no-store' } });
};
