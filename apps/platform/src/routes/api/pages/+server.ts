import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

const MAX_PAGE_SIZE = 100;

export const GET: RequestHandler = async ({ url }) => {
  const { lifecycle } = await getPlatformServices();
  const afterPageId = url.searchParams.get('afterPageId') ?? undefined;
  const limit = parseLimit(url.searchParams.get('limit'));
  const pages = await lifecycle.listPages({ afterPageId, ...(limit ? { limit } : {}) });

  return json(pages, { headers: { 'cache-control': 'no-store' } });
};

function parseLimit(value: string | null): number | undefined {
  if (value === null) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return undefined;
  return limit;
}
