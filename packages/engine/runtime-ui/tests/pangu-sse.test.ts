import { describe, expect, it, vi } from 'vitest';
import {
  buildPanguRequest,
  createPanguSseClient,
  parsePanguSse
} from '../src/ai-summary/pangu-sse';

const request = {
  title: '风险总结',
  promptTemplate: '只使用输入数据。',
  datasets: [{ id: 'risk', question: '风险数据', data: { office: ['A'], missing: [3] } }],
  termMapping: { office: '代表处', missing: '未考察数' }
};

describe('盘古 AI 总结 SSE Adapter', () => {
  it('固定组装协议字段、Header、ID 和业务数据', () => {
    const envelope = buildPanguRequest(
      request,
      { conversationBaseUrl: 'https://example.test/conversations', env: 'beta' },
      'conversation-1',
      new Date(2026, 7, 3).getTime(),
      0
    );

    expect(envelope.url).toBe('https://example.test/conversations/conversation-1/chat');
    expect(envelope.headers).toEqual({
      'Content-Type': 'application/json',
      client: 'PC_CloudIoc',
      env: 'beta'
    });
    expect(envelope.body).toMatchObject({
      question: '风险总结',
      query_type: 'ai-summary',
      request_id: '100000',
      conversation_id: 'conversation-1',
      context_info: {
        'ai-summary': {
          input_data: {
            scene_type: 'custom',
            scene_label: '风险总结',
            time_context: '2026-08',
            custom_config: {
              output_paragraphs: [
                {
                  description: '只使用输入数据。',
                  data_questions: ['风险数据']
                }
              ],
              term_mapping: { office: '代表处', missing: '未考察数' }
            },
            business_data: [{ question: '风险数据', data: { office: ['A'], missing: [3] } }]
          }
        }
      }
    });
  });

  it('在任意网络拆块下解析 generate 和 finish', async () => {
    const source =
      'data: {"event":"generate","content":"第一段"}\r\n' +
      'data: {"event":"generate","content":{"content":"第二段"}}\n' +
      'data: {"event":"finish","content":{}}';
    const events = await collect(parsePanguSse(chunked(source, [1, 2, 7, 3, 11])));
    expect(events).toEqual([
      { type: 'delta', text: '第一段' },
      { type: 'delta', text: '第二段' },
      { type: 'finish' }
    ]);
  });

  it('流结束前没有 finish 时报告协议错误', async () => {
    await expect(
      collect(parsePanguSse(chunked('data: {"event":"generate","content":"未完成"}\n', [5])))
    ).rejects.toThrow('finish');
  });

  it('POST 请求携带 cookie 且自动生成 conversationId', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(chunked('data: {"event":"finish"}\n', [2]), { status: 200 })
    );
    const client = createPanguSseClient(
      { conversationBaseUrl: 'https://example.test/conversations/' },
      {
        fetchImpl,
        now: () => 123,
        random: () => 0.5,
        conversationSeed: 'seed'
      }
    );
    await collect(client.stream(request, new AbortController().signal));
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/conversations/seed1123/chat',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });
});

function chunked(source: string, sizes: number[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor = 0;
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (cursor >= source.length) {
        controller.close();
        return;
      }
      const size = sizes[index++ % sizes.length] ?? source.length;
      controller.enqueue(encoder.encode(source.slice(cursor, cursor + size)));
      cursor += size;
    }
  });
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of source) values.push(value);
  return values;
}
