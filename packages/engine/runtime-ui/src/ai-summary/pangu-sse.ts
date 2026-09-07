import type { AiSummaryRequest } from './assemble-request';

export interface AiSummaryConfig {
  conversationBaseUrl: string;
  env?: string;
}

export type AiSummaryStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'finish' };

export interface AiSummaryTransport {
  stream(
    request: AiSummaryRequest,
    signal: AbortSignal
  ): AsyncIterable<AiSummaryStreamEvent>;
}

interface PanguSseDependencies {
  fetchImpl?: typeof fetch;
  now?: () => number;
  random?: () => number;
  conversationSeed?: string;
}

export interface PanguRequestEnvelope {
  conversationId: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export function createPanguSseClient(
  config: AiSummaryConfig,
  dependencies: PanguSseDependencies = {}
): AiSummaryTransport {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const conversationSeed = dependencies.conversationSeed ?? createConversationSeed();
  let sequence = 0;

  return {
    async *stream(request, signal) {
      const envelope = buildPanguRequest(
        request,
        config,
        `${conversationSeed}${++sequence}${now()}`,
        now(),
        random()
      );
      const response = await fetchImpl(envelope.url, {
        method: 'POST',
        credentials: 'include',
        headers: envelope.headers,
        body: JSON.stringify(envelope.body),
        signal
      });
      if (!response.ok) {
        throw new Error(`AI 总结请求失败（HTTP ${response.status}）`);
      }
      if (!response.body) throw new Error('AI 总结响应缺少 SSE 流');
      yield* parsePanguSse(response.body);
    }
  };
}

export function buildPanguRequest(
  request: AiSummaryRequest,
  config: AiSummaryConfig,
  conversationId: string,
  now: number,
  random: number
): PanguRequestEnvelope {
  const baseUrl = config.conversationBaseUrl.trim();
  if (!baseUrl) throw new Error('AI 总结未配置 conversationBaseUrl');
  const title = request.title?.trim() || 'AI 总结';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    client: 'PC_CloudIoc'
  };
  if (config.env?.trim()) headers.env = config.env.trim();
  const date = new Date(now);
  const timeContext = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const requestId = String(Math.floor(normalizeRandom(random) * 900000) + 100000);

  return {
    conversationId,
    url: `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${conversationId}/chat`,
    headers,
    body: {
      question: title,
      query_type: 'ai-summary',
      context_info: {
        user_id: '',
        app_id: '',
        org_id: '',
        'ai-summary': {
          input_data: {
            scene_type: 'custom',
            scene_label: title,
            time_context: timeContext,
            custom_config: {
              output_paragraphs: [
                {
                  name: title,
                  description: request.promptTemplate,
                  data_questions: request.datasets.map((dataset) => dataset.question)
                }
              ],
              term_mapping: request.termMapping
            },
            business_data: request.datasets.map((dataset) => ({
              question: dataset.question,
              data: dataset.data
            }))
          }
        }
      },
      result_info: {},
      version_id: 'V2',
      suggestion: { from: 'NA', id: '' },
      replay_flag: 0,
      deepthink_switch: false,
      skill_info: null,
      question_id: '',
      request_id: requestId,
      message_id: '1',
      conversation_id: conversationId
    }
  };
}

export async function* parsePanguSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AiSummaryStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  try {
    while (true) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/u, '');
        buffer = buffer.slice(newline + 1);
        const event = parseEventLine(line);
        if (event) {
          yield event;
          if (event.type === 'finish') {
            finished = true;
            return;
          }
        }
        newline = buffer.indexOf('\n');
      }
      if (result.done) break;
    }
    if (buffer.trim()) {
      const event = parseEventLine(buffer.replace(/\r$/u, ''));
      if (event) {
        yield event;
        finished = event.type === 'finish';
      }
    }
    if (!finished) throw new Error('AI 总结 SSE 流在 finish 事件前结束');
  } finally {
    reader.releaseLock();
  }
}

function parseEventLine(line: string): AiSummaryStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new Error('AI 总结 SSE 事件不是完整 JSON');
  }
  if (!isRecord(value)) throw new Error('AI 总结 SSE 事件格式无效');
  if (value.event === 'finish') return { type: 'finish' };
  if (value.event !== 'generate') return null;
  const content =
    typeof value.content === 'string'
      ? value.content
      : isRecord(value.content) && typeof value.content.content === 'string'
        ? value.content.content
        : '';
  return content ? { type: 'delta', text: content } : null;
}

function createConversationSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '');
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.9999999999999999);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
