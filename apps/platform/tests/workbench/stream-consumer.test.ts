import { describe, expect, it } from 'vitest';
import { encodeSseFrame } from '../../src/lib/server/agent/stream-endpoint';
import {
  AgentStreamProtocolError,
  AgentStreamRequestError,
  openAgentRunStream,
  readAgentStreamFrames,
  type AgentStreamFrame
} from '../../src/lib/workbench/stream-consumer';

/**
 * SSE 分帧解析的确定性测试:用服务端同一个编码器(encodeSseFrame)构造
 * 字节流,按任意位置切块喂给消费端,断言事件按序还原。
 */

function byteStream(
  chunks: Uint8Array[],
  onCancel?: () => void
): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
    }
  });
}

function splitBytes(text: string, chunkSize: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let at = 0; at < bytes.length; at += chunkSize) {
    chunks.push(bytes.slice(at, at + chunkSize));
  }
  return chunks;
}

async function collect(
  stream: ReadableStream<Uint8Array>
): Promise<AgentStreamFrame[]> {
  const frames: AgentStreamFrame[] = [];
  for await (const frame of readAgentStreamFrames(stream)) frames.push(frame);
  return frames;
}

const RUN_TEXT =
  encodeSseFrame({
    id: '1',
    data: JSON.stringify({ type: 'run_started', runId: 'run-1', sessionId: null })
  }) +
  encodeSseFrame({
    id: '2',
    data: JSON.stringify({
      type: 'tool_call_started',
      toolCallId: 'call-1',
      toolName: 'validate_page'
    })
  }) +
  encodeSseFrame({
    id: '3',
    data: JSON.stringify({ type: 'assistant_replied', content: '页面已生成,含中文内容。' })
  }) +
  encodeSseFrame({ id: '4', data: JSON.stringify({ type: 'run_completed' }) }) +
  encodeSseFrame({
    event: 'outcome',
    data: JSON.stringify({
      status: 'completed',
      messages: [{ role: 'user', content: '创建销售概览' }],
      document: { schemaVersion: '5.0', id: 'sales-overview' },
      checkpointVersion: 4,
      runtimeOrigin: 'http://localhost:5173',
      agentModel: { provider: 'scripted', model: 'component-selecting-scripted' }
    })
  });

describe('Agent 运行推送流的分帧解析', () => {
  it('按序还原事件帧与 outcome 帧', async () => {
    const frames = await collect(byteStream(splitBytes(RUN_TEXT, RUN_TEXT.length)));

    expect(frames.map((frame) => frame.kind)).toEqual([
      'event',
      'event',
      'event',
      'event',
      'outcome'
    ]);
    expect(
      frames.flatMap((frame) => (frame.kind === 'event' ? [frame.sequence] : []))
    ).toEqual([1, 2, 3, 4]);
    const outcome = frames.at(-1);
    if (outcome?.kind !== 'outcome') throw new Error('缺少 outcome 帧');
    expect(outcome.outcome.status).toBe('completed');
    expect(outcome.outcome.document).toEqual({
      schemaVersion: '5.0',
      id: 'sales-overview'
    });
    expect(outcome.outcome.interaction).toBeNull();
    expect(outcome.outcome.error).toBeNull();
    expect(outcome.outcome.checkpointVersion).toBe(4);
  });

  it('帧被任意字节边界切开(含多字节中文)仍完整还原', async () => {
    for (const chunkSize of [1, 3, 7, 16]) {
      const frames = await collect(byteStream(splitBytes(RUN_TEXT, chunkSize)));
      expect(frames).toHaveLength(5);
      const reply = frames[2];
      if (reply?.kind !== 'event' || reply.event.type !== 'assistant_replied') {
        throw new Error('第三帧应是 assistant_replied');
      }
      expect(reply.event.content).toBe('页面已生成,含中文内容。');
    }
  });

  it('跨多个 data 行的帧按协议以换行拼接', async () => {
    const text = encodeSseFrame({
      id: '1',
      data: '{"type":\n"run_completed"}'
    });
    const frames = await collect(byteStream(splitBytes(text, 8)));
    expect(frames).toEqual([
      { kind: 'event', sequence: 1, event: { type: 'run_completed' } }
    ]);
  });

  it('outcome 帧还原人工交互与归一化错误', async () => {
    const text = encodeSseFrame({
      event: 'outcome',
      data: JSON.stringify({
        status: 'interaction_required',
        messages: [],
        interaction: {
          id: 'confirm-page-id:sales-overview',
          kind: 'confirm_page_id',
          payload: { pageId: 'sales-overview' }
        },
        error: {
          code: 'RUN_TIMEOUT',
          message: '运行超时',
          stage: 'generation',
          retryable: true
        }
      })
    });
    const [frame] = await collect(byteStream(splitBytes(text, 32)));
    if (frame?.kind !== 'outcome') throw new Error('应是 outcome 帧');
    expect(frame.outcome.interaction).toEqual({
      id: 'confirm-page-id:sales-overview',
      kind: 'confirm_page_id',
      payload: { pageId: 'sales-overview' }
    });
    expect(frame.outcome.error).toEqual({
      code: 'RUN_TIMEOUT',
      message: '运行超时',
      stage: 'generation',
      retryable: true
    });
    expect(frame.outcome.checkpointVersion).toBeNull();
  });

  it('data 不是合法 JSON 时抛协议错误', async () => {
    const stream = byteStream(splitBytes('id: 1\ndata: {broken\n\n', 64));
    await expect(collect(stream)).rejects.toBeInstanceOf(AgentStreamProtocolError);
  });

  it('未知事件类型不静默透传,抛协议错误', async () => {
    const text = encodeSseFrame({
      id: '1',
      data: JSON.stringify({ type: 'unknown_event' })
    });
    await expect(collect(byteStream(splitBytes(text, 64)))).rejects.toBeInstanceOf(
      AgentStreamProtocolError
    );
  });

  it('消费方提前放弃时取消底层可读流(中止服务端运行)', async () => {
    let cancelled = false;
    const stream = byteStream(splitBytes(RUN_TEXT, 16), () => {
      cancelled = true;
    });
    for await (const frame of readAgentStreamFrames(stream)) {
      if (frame.kind === 'event' && frame.sequence === 2) break;
    }
    expect(cancelled).toBe(true);
  });
});

describe('openAgentRunStream', () => {
  it('POST 被拒绝时抛出携带服务端稳定错误码的请求错误', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: { code: 'AGENT_RUN_ALREADY_ACTIVE', message: '运行进行中' }
        }),
        { status: 409, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;

    const consume = async () => {
      for await (const frame of openAgentRunStream({ body: { runId: 'r' }, fetchImpl })) {
        void frame;
      }
    };
    await expect(consume()).rejects.toMatchObject({
      code: 'AGENT_RUN_ALREADY_ACTIVE',
      status: 409
    });
    await expect(consume()).rejects.toBeInstanceOf(AgentStreamRequestError);
  });

  it('请求成功时把响应体交给分帧解析', async () => {
    const fetchImpl = (async () =>
      new Response(byteStream(splitBytes(RUN_TEXT, 24)), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })) as typeof fetch;

    const frames: AgentStreamFrame[] = [];
    for await (const frame of openAgentRunStream({ body: { runId: 'r' }, fetchImpl })) {
      frames.push(frame);
    }
    expect(frames).toHaveLength(5);
    expect(frames.at(-1)?.kind).toBe('outcome');
  });
});
