import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { executeDqeItem } from './execute';

export const DQE_EXECUTE_PATH =
  '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
export const AI_SUMMARY_CONVERSATIONS_PATH = '/api/ai/conversations/';
export const DEFAULT_DQE_SIM_PORT = 18228;

const DEFAULT_AI_SUMMARY_TEXT = [
  '1. **整体NA客户未考察情况**：各代表处均存在无公司考察NA客户，需结合清单逐项关注。',
  '',
  '2. **2026年未考察情况**：2026年无公司考察NA客户数据已纳入本次风险检查。',
  '',
  '3. **TOP100项目客户未考察情况**：TOP100项目客户相关未考察数据已纳入重点跟踪。'
].join('\n');

const CUSTOMER_FLOW_AI_SUMMARY_TEXT = [
  '1. **增长客户**：头部增长客户贡献集中，建议持续跟踪增量来源与可延续性。',
  '',
  '2. **下降客户**：下降客户需要结合同比下滑原因逐项制定恢复动作。',
  '',
  '3. **风险客户**：风险客户存在月度流水波动，应优先核验一次性收入与续签节奏。'
].join('\n');

const TRACK_FLOW_AI_SUMMARY_TEXT = [
  '1. **主要贡献赛道**：头部赛道仍是流水的主要支撑，应巩固稳定贡献。',
  '',
  '2. **环比变化**：赛道间环比分化明显，需要关注回落赛道的交付与回款节奏。',
  '',
  '3. **年度推演压力**：部分赛道年度推演压力偏高，需补充新增机会与确定性项目。'
].join('\n');

const INDUSTRY_FLOW_AI_SUMMARY_TEXT = [
  '1. **主要贡献产业**：核心产业保持主要流水贡献，结构集中度需要持续观察。',
  '',
  '2. **增长来源**：当前增长来源由重点产业与新增项目共同驱动。',
  '',
  '3. **目标支撑风险**：部分产业的年度推演不足以支撑目标，需提前识别目标支撑风险。'
].join('\n');

type JsonRecord = Record<string, unknown>;

export interface DqeSimServerOptions {
  logger?: ((message: string) => void) | false;
  createRequestId?: () => string;
  now?: () => number;
  aiSummaryText?: string;
  aiSummaryCharacterIntervalMs?: number;
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
    const url = new URL(request.url ?? '/', 'http://dqe-sim');
    if (request.method === 'POST' && isAiSummaryChatPath(url.pathname)) {
      void streamAiSummary(request, response, {
        requestId,
        text: options.aiSummaryText,
        characterIntervalMs: options.aiSummaryCharacterIntervalMs ?? 35
      }).then(
        (result) => {
          logExchange(logger, requestId, request, result, now() - startedAt);
        },
        (cause) => {
          const result: RouteResult = {
            status: 500,
            body: {
              retCode: 'CBC.9999',
              retDesc: `DQE Sim AI Summary 内部错误:${String(cause)}`
            }
          };
          if (!response.headersSent) {
            writeResponse(response, result.status, result.body, requestId, request);
          } else if (!response.writableEnded) {
            response.destroy(cause instanceof Error ? cause : undefined);
          }
          logExchange(logger, requestId, request, result, now() - startedAt);
        }
      );
      return;
    }
    void route(request).then(
      (result) => {
        writeResponse(response, result.status, result.body, requestId, request);
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
        writeResponse(response, result.status, result.body, requestId, request);
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
  requestId: string,
  request: IncomingMessage
): void {
  cors(response, request);
  response.setHeader('x-request-id', requestId);
  if (status === 204) {
    response.writeHead(status).end();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  response.end(JSON.stringify(body));
}

function cors(response: ServerResponse, request: IncomingMessage): void {
  const origin = request.headers.origin;
  response.setHeader('access-control-allow-origin', origin ?? '*');
  if (origin) {
    response.setHeader('access-control-allow-credentials', 'true');
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-headers', 'content-type,client,env');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-expose-headers', 'x-request-id');
}

function isAiSummaryChatPath(pathname: string): boolean {
  if (!pathname.startsWith(AI_SUMMARY_CONVERSATIONS_PATH)) return false;
  const conversationRoute = pathname.slice(AI_SUMMARY_CONVERSATIONS_PATH.length);
  return /^[^/]+\/chat$/u.test(conversationRoute);
}

async function streamAiSummary(
  request: IncomingMessage,
  response: ServerResponse,
  input: {
    requestId: string;
    text?: string;
    characterIntervalMs: number;
  }
): Promise<RouteResult> {
  const parsed = await readJson(request);
  if (!parsed.ok) {
    const result: RouteResult = {
      status: 400,
      body: { retCode: 'CBC.9001', retDesc: '请求体不是合法 JSON' },
      requestBody: parsed.raw
    };
    writeResponse(response, result.status, result.body, input.requestId, request);
    return result;
  }
  if (!isRecord(parsed.value)) {
    const result: RouteResult = {
      status: 400,
      body: { retCode: 'CBC.9001', retDesc: '请求体必须是 JSON 对象' },
      requestBody: parsed.value
    };
    writeResponse(response, result.status, result.body, input.requestId, request);
    return result;
  }

  cors(response, request);
  response.setHeader('x-request-id', input.requestId);
  response.writeHead(200, {
    'content-type': 'text/event-stream;charset=utf-8',
    'cache-control': 'no-cache,no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  });
  response.flushHeaders();

  const text = input.text ?? aiSummaryTextForRequest(parsed.value);
  const characters = Array.from(text);
  const characterIntervalMs = Math.max(0, input.characterIntervalMs);
  for (let index = 0; index < characters.length; index += 1) {
    if (response.destroyed) break;
    response.write(
      `data: ${JSON.stringify({ event: 'generate', content: characters[index] })}\n\n`
    );
    if (index < characters.length - 1) {
      await delay(characterIntervalMs);
    }
  }
  if (!response.destroyed) {
    response.end(`data: ${JSON.stringify({ event: 'finish', content: {} })}\n\n`);
  }
  return {
    status: response.destroyed ? 499 : 200,
    body: { streamedCharacters: characters.length },
    requestBody: parsed.value
  };
}

function aiSummaryTextForRequest(body: JsonRecord): string {
  const prompt = aiSummaryPrompt(body);
  if (prompt.includes('赛道')) return TRACK_FLOW_AI_SUMMARY_TEXT;
  if (prompt.includes('产业')) return INDUSTRY_FLOW_AI_SUMMARY_TEXT;
  if (prompt.includes('客户')) return CUSTOMER_FLOW_AI_SUMMARY_TEXT;
  return DEFAULT_AI_SUMMARY_TEXT;
}

function aiSummaryPrompt(body: JsonRecord): string {
  const context = body.context_info;
  if (!isRecord(context)) return '';
  const summary = context['ai-summary'];
  if (!isRecord(summary) || !isRecord(summary.input_data)) return '';
  const config = summary.input_data.custom_config;
  if (!isRecord(config) || !Array.isArray(config.output_paragraphs)) return '';
  return config.output_paragraphs
    .filter(isRecord)
    .flatMap((paragraph) =>
      typeof paragraph.description === 'string' ? [paragraph.description] : []
    )
    .join('\n');
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
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
