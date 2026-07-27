import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  createDpMetricRegistry,
  DpMetricConflictError,
  type CreateDpMetricInput,
  type DpMetricRegistry,
  type DpMetricStatus,
  type SearchDpMetricsInput
} from './registry';

const PORT = Number(process.env.DP_SIM_PORT ?? 18227);

export function createDpSimServer(registry = createDpMetricRegistry()) {
  return createServer((request, response) => {
    void handle(request, response, registry).catch((cause) => {
      if (cause instanceof DpMetricConflictError) {
        json(response, 409, error('DP_METRIC_CONFLICT', cause.message));
        return;
      }
      json(response, 500, error('DP_SIM_INTERNAL_ERROR', String(cause)));
    });
  });
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  registry: DpMetricRegistry
): Promise<void> {
  if (request.method === 'OPTIONS') {
    cors(response);
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? '/', 'http://dp-sim');
  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/metric-candidates/search') {
    const body = await readJson(request);
    const parsed = parseSearch(body);
    if (!parsed.ok) {
      json(response, 400, error('DP_INVALID_SEARCH', parsed.message));
      return;
    }
    json(response, 200, { candidates: registry.search(parsed.value) });
    return;
  }

  const metricMatch = url.pathname.match(/^\/v1\/metrics\/([^/]+)$/u);
  if (request.method === 'GET' && metricMatch) {
    const metric = registry.get(decodeURIComponent(metricMatch[1] ?? ''));
    if (!metric) {
      json(response, 404, error('DP_METRIC_NOT_FOUND', '没有找到指标'));
      return;
    }
    json(response, 200, { metric });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/__admin/metrics') {
    const body = await readJson(request);
    const parsed = parseCreate(body);
    if (!parsed.ok) {
      json(response, 400, error('DP_INVALID_METRIC', parsed.message));
      return;
    }
    json(response, 201, { metric: registry.create(parsed.value) });
    return;
  }

  const publishMatch = url.pathname.match(/^\/__admin\/metrics\/([^/]+)\/publish$/u);
  if (request.method === 'POST' && publishMatch) {
    const body = await readJson(request);
    const code = readNonEmptyString(body, 'code');
    const catalog = readNonEmptyString(body, 'catalog');
    if (!code || !catalog) {
      json(response, 400, error('DP_INVALID_PUBLISH', 'code 和 catalog 必须是非空字符串'));
      return;
    }
    const metric = registry.publish(
      decodeURIComponent(publishMatch[1] ?? ''),
      code,
      catalog
    );
    if (!metric) {
      json(response, 404, error('DP_METRIC_NOT_FOUND', '没有找到指标'));
      return;
    }
    json(response, 200, { metric });
    return;
  }

  json(
    response,
    404,
    error('DP_ROUTE_NOT_FOUND', `未知端点:${request.method ?? 'UNKNOWN'} ${url.pathname}`)
  );
}

function parseSearch(
  body: unknown
): { ok: true; value: SearchDpMetricsInput } | { ok: false; message: string } {
  if (!isRecord(body)) return { ok: false, message: '请求体必须是 JSON 对象' };
  const query = readNonEmptyString(body, 'query');
  if (!query) return { ok: false, message: 'query 必须是非空字符串' };
  const requiredDimensions = readStringArray(body, 'requiredDimensions');
  const requiredAggregations = readStringArray(body, 'requiredAggregations');
  const statuses = readStatuses(body.statuses);
  if (requiredDimensions === null || requiredAggregations === null || statuses === null) {
    return {
      ok: false,
      message: 'requiredDimensions、requiredAggregations 和 statuses 必须是合法字符串数组'
    };
  }
  return {
    ok: true,
    value: {
      query,
      requiredDimensions,
      requiredAggregations,
      ...(statuses === undefined ? {} : { statuses })
    }
  };
}

function parseCreate(
  body: unknown
): { ok: true; value: CreateDpMetricInput } | { ok: false; message: string } {
  if (!isRecord(body)) return { ok: false, message: '请求体必须是 JSON 对象' };
  const name = readNonEmptyString(body, 'name');
  const definition = readNonEmptyString(body, 'definition');
  const dimensions = readStringArray(body, 'dimensions');
  const aggregations = readStringArray(body, 'aggregations');
  if (!name || !definition || dimensions === null || aggregations === null) {
    return {
      ok: false,
      message: 'name、definition 必须是非空字符串，dimensions、aggregations 必须是字符串数组'
    };
  }
  return { ok: true, value: { name, definition, dimensions, aggregations } };
}

function readStatuses(value: unknown): DpMetricStatus[] | undefined | null {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((candidate) => candidate !== 'draft' && candidate !== 'published')
  ) {
    return null;
  }
  return [...new Set(value)] as DpMetricStatus[];
}

function readStringArray(body: Record<string, unknown>, key: string): string[] | null {
  const value = body[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((candidate) => typeof candidate !== 'string')) {
    return null;
  }
  return value;
}

function readNonEmptyString(body: unknown, key: string): string | undefined {
  if (!isRecord(body) || typeof body[key] !== 'string') return undefined;
  const value = body[key].trim();
  return value || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(code: string, message: string) {
  return { error: { code, message } };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  cors(response);
  response.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  response.end(JSON.stringify(body));
}

function cors(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}

if (process.argv[1]?.endsWith('server.ts')) {
  createDpSimServer().listen(PORT, () => {
    console.log(`DP 仿真已启动:http://localhost:${PORT}(Ctrl+C 停止)`);
  });
}
