import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { executeDqeItem } from './execute';

export const DQE_EXECUTE_PATH =
  '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
export const DEFAULT_DQE_SIM_PORT = 18228;

type JsonRecord = Record<string, unknown>;

export interface DqeSimServerOptions {
  logger?: ((message: string) => void) | false;
  createRequestId?: () => string;
  now?: () => number;
}

interface RouteResult {
  status: number;
  body?: unknown;
  requestBody?: unknown;
}

export function createDqeSimServer(options: DqeSimServerOptions = {}) {
  const logger = options.logger === false ? undefined : options.logger ?? console.log;
  const now = options.now ?? Date.now;
  let requestSequence = 0;
  const createRequestId =
    options.createRequestId ?? (() => `dqe-sim-${++requestSequence}`);

  return createServer((request, response) => {
    const startedAt = now();
    const requestId = createRequestId();
    void route(request).then(
      (result) => {
        writeResponse(response, result.status, result.body, requestId);
        logExchange(logger, requestId, request, result, now() - startedAt);
      },
      (cause) => {
        const result: RouteResult = {
          status: 500,
          body: {
            retCode: 'CBC.9999',
            retDesc: `DQE Sim 内部错误:${String(cause)}`
          }
        };
        writeResponse(response, result.status, result.body, requestId);
        logExchange(logger, requestId, request, result, now() - startedAt);
      }
    );
  });
}

async function route(request: IncomingMessage): Promise<RouteResult> {
  const url = new URL(request.url ?? '/', 'http://dqe-sim');
  if (request.method === 'OPTIONS') return { status: 204 };
  if (request.method === 'GET' && url.pathname === '/__health') {
    return {
      status: 200,
      body: { status: 'ok', service: 'dqe-sim' }
    };
  }
  if (request.method !== 'POST' || url.pathname !== DQE_EXECUTE_PATH) {
    return {
      status: 404,
      body: {
        retCode: 'CBC.9404',
        retDesc: `未知端点:${request.method ?? 'UNKNOWN'} ${url.pathname}`
      }
    };
  }

  const parsed = await readJson(request);
  if (!parsed.ok) {
    return {
      status: 400,
      body: { retCode: 'CBC.9001', retDesc: '请求体不是合法 JSON' },
      requestBody: parsed.raw
    };
  }
  if (!isRecord(parsed.value) || !Array.isArray(parsed.value.dsl_list)) {
    return {
      status: 400,
      body: { retCode: 'CBC.9001', retDesc: '请求体必须包含 dsl_list 数组' },
      requestBody: parsed.value
    };
  }
  return {
    status: 200,
    body: {
      retCode: 'CBC.0000',
      retDesc: null,
      results: parsed.value.dsl_list.map(executeDqeItem)
    },
    requestBody: parsed.value
  };
}

function writeResponse(
  response: ServerResponse,
  status: number,
  body: unknown,
  requestId: string
): void {
  cors(response);
  response.setHeader('x-request-id', requestId);
  if (status === 204) {
    response.writeHead(status).end();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  response.end(JSON.stringify(body));
}

function cors(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-expose-headers', 'x-request-id');
}

function logExchange(
  logger: ((message: string) => void) | undefined,
  requestId: string,
  request: IncomingMessage,
  result: RouteResult,
  durationMs: number
): void {
  if (!logger) return;
  logger(
    `[DQE Sim][${requestId}] ${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} ${result.status} ${durationMs}ms\n${JSON.stringify(
      {
        request: result.requestBody ?? null,
        response: result.body ?? null
      },
      null,
      2
    )}`
  );
}

async function readJson(
  request: IncomingMessage
): Promise<{ ok: true; value: unknown } | { ok: false; raw: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, raw };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

if (process.argv[1]?.endsWith('server.ts')) {
  const port = Number(process.env.DQE_SIM_PORT ?? DEFAULT_DQE_SIM_PORT);
  createDqeSimServer().listen(port, '127.0.0.1', () => {
    console.log(
      `DQE Sim 已启动:http://127.0.0.1:${port}${DQE_EXECUTE_PATH}(Ctrl+C 停止)`
    );
  });
}
