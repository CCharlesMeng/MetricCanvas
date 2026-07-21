import type {
  AgentMessage,
  ModelProvider,
  ModelResponse
} from '@metriccanvas/agent-runner';

export function createSingleMetricCardScriptedProvider(runId = 'local'): ModelProvider {
  const pageId = `sales-total-${runId.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8) || 'local'}`;
  const pageDocument = pageDocumentFor(pageId);

  return {
    async complete({ messages }) {
      const called = new Set(
        messages.flatMap((message) => (message.role === 'tool' ? [message.name] : []))
      );
      if (!called.has('search_catalog')) {
        return toolCall('search-1', 'search_catalog', { query: '成交总额', limit: 10 });
      }

      if (!called.has('validate_page')) {
        return toolCall('validate-1', 'validate_page', { document: pageDocument });
      }
      if (!called.has('save_page')) {
        return toolCall('save-1', 'save_page', {
          pageId,
          baseRevisionId: null,
          document: pageDocument,
          idempotencyKey: `scripted-save-${pageId}-r1`
        });
      }

      const saved = toolResult(messages, 'save_page');
      const revisionId = stringAt(saved, ['revision', 'revisionId']);
      if (!called.has('preview_page')) {
        return toolCall('preview-1', 'preview_page', {
          pageId,
          revisionId
        });
      }
      if (!called.has('request_publish')) {
        return toolCall('publish-1', 'request_publish', {
          pageId,
          revisionId,
          idempotencyKey: `scripted-publish-${pageId}-r1`
        });
      }

      return {
        content: 'R1 已保存并加载精确预览。发布租约已取得，请在工作台中完成人工确认。',
        toolCalls: []
      };
    }
  };
}

function pageDocumentFor(pageId: string) {
  return {
    formatVersion: '1.0',
    id: pageId,
    title: '成交总额',
    layout: { type: 'grid', columns: 12 },
    widgets: [
      {
        id: 'w-gmv',
        type: 'metricCard',
        title: '成交总额',
        position: { x: 0, y: 0, w: 3, h: 2 },
        query: { metrics: ['gmv'], aggregation: 'sum' },
        display: { unit: '元', thousandsSeparator: true }
      }
    ]
  };
}

function toolCall(id: string, name: string, input: unknown): ModelResponse {
  return { content: '', toolCalls: [{ id, name, input }] };
}

function toolResult(messages: AgentMessage[], name: string): unknown {
  const message = [...messages]
    .reverse()
    .find(
      (candidate): candidate is Extract<AgentMessage, { role: 'tool' }> =>
        candidate.role === 'tool' && candidate.name === name
    );
  if (!message) throw new Error(`scripted model 缺少工具结果:${name}`);
  return JSON.parse(message.content);
}

function stringAt(value: unknown, path: string[]): string {
  let current = value;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      throw new Error(`scripted model 缺少字段:${path.join('.')}`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== 'string') {
    throw new Error(`scripted model 字段不是字符串:${path.join('.')}`);
  }
  return current;
}
