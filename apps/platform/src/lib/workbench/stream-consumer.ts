import type { AgentInteraction, AgentMessage } from '../server/agent/types';
import type { AgentRunOutcomeStatus } from '../server/agent/stream';
import type { AgentRunStreamEvent, FailureStage } from '../server/session/step-event';

/**
 * Agent 运行推送通道的浏览器消费端(#65):fetch POST /api/agent/stream 后
 * 读取 response.body,按空行分帧解析 `id:` / `event:` / `data:` 字段;
 * EventSource 不支持 POST,不适用(协议真源:
 * $lib/server/agent/stream-endpoint.ts 模块注释)。
 *
 * 每条普通帧的 data 是一条 AgentRunStreamEvent——事件契约的唯一真源是
 * $lib/server/session/step-event.ts,本模块只做类型导入,不复制事件形状;
 * 结束前的 `event: outcome` 帧承载运行终态、过滤后的会话消息、已通过
 * 校验的页面文档、人工交互与归一化错误。
 *
 * 分层:本模块只负责传输与分帧;事件到界面状态的映射在 ./run-state.ts。
 * 两者都不依赖浏览器,可在 Node 测试中用构造的字节流驱动。
 */

/** outcome 帧的归一化错误:与非流式端点的 error 载荷同构。 */
export interface AgentRunOutcomeError {
  code: string;
  message: string;
  stage: FailureStage;
  retryable: boolean;
}

/** outcome 帧载荷:运行终态、续跑基线消息、(如有)已校验页面文档与人工交互。 */
export interface AgentRunOutcomeFrame {
  status: AgentRunOutcomeStatus;
  /** 运行结束时的会话消息(服务端已滤掉创作上下文):下一轮请求的基线。 */
  messages: AgentMessage[];
  /** 已通过 validate_page 校验的页面文档;本次运行未产出时为 null。 */
  document: Record<string, unknown> | null;
  interaction: AgentInteraction | null;
  error: AgentRunOutcomeError | null;
  /** 服务端已保存的会话检查点版本;未开启会话或写入失败时为 null。 */
  checkpointVersion: number | null;
}

export type AgentStreamFrame =
  | { kind: 'event'; sequence: number; event: AgentRunStreamEvent }
  | { kind: 'outcome'; outcome: AgentRunOutcomeFrame };

/** 推送响应不符合分帧协议(缺 data、JSON 不合法、事件形状不符)。 */
export class AgentStreamProtocolError extends Error {}

/** POST /api/agent/stream 被拒绝(400/409 等),携带服务端稳定错误码。 */
export class AgentStreamRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export interface OpenAgentRunStreamInput {
  /** 请求体:由 ./agent-request.ts 构造,已符合工作台 Agent 请求契约。 */
  body: Record<string, unknown>;
  /** 测试注入;缺省用全局 fetch。 */
  fetchImpl?: typeof fetch;
}

/**
 * 发起一次 Agent 流式运行并顺序产出分帧结果。消费方提前放弃(生成器
 * return)时取消底层可读流——服务端把连接断开与取消端点当同一语义处理。
 */
export async function* openAgentRunStream(
  input: OpenAgentRunStreamInput
): AsyncGenerator<AgentStreamFrame> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl('/api/agent/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(input.body)
  });
  if (!response.ok) {
    throw await requestError(response);
  }
  if (!response.body) {
    throw new AgentStreamProtocolError('推送响应没有可读流');
  }
  yield* readAgentStreamFrames(response.body);
}

/** 按 SSE 分帧解析推送响应体。独立导出,测试用构造的字节流直接驱动。 */
export async function* readAgentStreamFrames(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AgentStreamFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffered += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let boundary = buffered.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = parseFrame(buffered.slice(0, boundary));
        buffered = buffered.slice(boundary + 2);
        boundary = buffered.indexOf('\n\n');
        if (frame) yield frame;
      }
      if (done) return;
    }
  } finally {
    // 正常读尽时 cancel 是空操作;消费方提前放弃时它中止服务端运行。
    await reader.cancel().catch(() => undefined);
  }
}

function parseFrame(raw: string): AgentStreamFrame | null {
  let id: string | undefined;
  let eventName: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('id:')) id = stripFieldValue(line.slice(3));
    else if (line.startsWith('event:')) eventName = stripFieldValue(line.slice(6));
    else if (line.startsWith('data:')) dataLines.push(stripFieldValue(line.slice(5)));
    // 其余字段与 ':' 注释行按 SSE 约定忽略。
  }
  if (dataLines.length === 0) return null;
  const data = parseJson(dataLines.join('\n'));
  if (eventName === 'outcome') {
    return { kind: 'outcome', outcome: parseOutcome(data) };
  }
  return {
    kind: 'event',
    sequence: parseSequence(id),
    event: parseStreamEvent(data)
  };
}

/** SSE 字段值允许一个前导空格,原样保留其余内容。 */
function stripFieldValue(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AgentStreamProtocolError(`推送帧 data 不是合法 JSON:${text.slice(0, 120)}`);
  }
}

function parseSequence(id: string | undefined): number {
  const sequence = Number(id);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AgentStreamProtocolError(`推送帧缺少合法序号:${String(id)}`);
  }
  return sequence;
}

/**
 * 事件 type 闭集:以 Record<AgentRunStreamEvent['type'], true> 声明,
 * step-event.ts 契约增删成员时这里编译失败,不会静默漂移。
 */
const STREAM_EVENT_TYPES: Record<AgentRunStreamEvent['type'], true> = {
  domain_routed: true,
  candidates_retrieved: true,
  scope_card_presented: true,
  execution_started: true,
  rows_ready: true,
  document_ready: true,
  metric_gap_recorded: true,
  step_failed: true,
  run_started: true,
  tool_call_started: true,
  tool_call_finished: true,
  assistant_replied: true,
  run_interaction_required: true,
  run_completed: true,
  run_failed: true,
  run_cancelled: true
};

function parseStreamEvent(data: unknown): AgentRunStreamEvent {
  if (
    !isRecord(data) ||
    typeof data.type !== 'string' ||
    !(data.type in STREAM_EVENT_TYPES)
  ) {
    throw new AgentStreamProtocolError(
      `推送帧不是已知的 Agent 运行流事件:${JSON.stringify(data).slice(0, 120)}`
    );
  }
  return data as unknown as AgentRunStreamEvent;
}

const OUTCOME_STATUSES: Record<AgentRunOutcomeStatus, true> = {
  completed: true,
  interaction_required: true,
  failed: true,
  cancelled: true
};

function parseOutcome(data: unknown): AgentRunOutcomeFrame {
  if (
    !isRecord(data) ||
    typeof data.status !== 'string' ||
    !(data.status in OUTCOME_STATUSES) ||
    !Array.isArray(data.messages)
  ) {
    throw new AgentStreamProtocolError('outcome 帧缺少运行终态或会话消息');
  }
  return {
    status: data.status as AgentRunOutcomeStatus,
    messages: data.messages as AgentMessage[],
    document: isRecord(data.document) ? data.document : null,
    interaction: parseInteraction(data.interaction),
    error: parseOutcomeError(data.error),
    checkpointVersion:
      Number.isInteger(data.checkpointVersion) && (data.checkpointVersion as number) >= 1
        ? (data.checkpointVersion as number)
        : null
  };
}

function parseInteraction(value: unknown): AgentInteraction | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    !isRecord(value.payload)
  ) {
    return null;
  }
  return { id: value.id, kind: value.kind, payload: value.payload };
}

function parseOutcomeError(value: unknown): AgentRunOutcomeError | null {
  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    typeof value.message !== 'string'
  ) {
    return null;
  }
  return {
    code: value.code,
    message: value.message,
    stage: value.stage as FailureStage,
    retryable: value.retryable === true
  };
}

async function requestError(response: Response): Promise<AgentStreamRequestError> {
  let code = 'AGENT_STREAM_REJECTED';
  let message = `Agent 推送请求失败:${response.status}`;
  try {
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && isRecord(payload.error)) {
      if (typeof payload.error.code === 'string') code = payload.error.code;
      if (typeof payload.error.message === 'string') message = payload.error.message;
    }
  } catch {
    // 非 JSON 错误响应保持缺省文案。
  }
  return new AgentStreamRequestError(code, message, response.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
