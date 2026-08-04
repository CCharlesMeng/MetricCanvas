import type {
  AgentMessage,
  ModelProvider,
  ModelResponse
} from '@metriccanvas/agent-runner';

const AUTHORING_CONTEXT_PREFIX = 'METRICCANVAS_AUTHORING_CONTEXT:';

/**
 * 无外部模型时的确定性回退。它只生成 v4 inline 页面；用户明确要求动态数据时，
 * 先检索数据上下文，再生成最小 DQE 页面。
 */
export function createComponentSelectingScriptedProvider(runId = 'local'): ModelProvider {
  const pageId =
    `ai-dashboard-${runId.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8) || 'local'}`;
  return {
    async complete({ messages }) {
      const called = new Set(
        messages.flatMap((message) =>
          message.role === 'tool' ? [message.name] : []
        )
      );
      const context = authoringContext(messages);
      const intent = latestUserText(messages);
      const dynamic = /(实时|动态|DQE|查询)/iu.test(intent);

      if (dynamic && !called.has('search_data_context')) {
        return toolCall('search-data-context-1', 'search_data_context', {
          query: intent || '客户活动',
          limit: 10
        });
      }

      const document = context?.document ?? (
        dynamic ? dqePage(pageId) : inlinePage(pageId, intent)
      );
      if (!called.has('validate_page')) {
        return toolCall('validate-page-1', 'validate_page', { document });
      }
      if (isAuthoringConversation(messages)) {
        return {
          content: 'v4 看板页面已生成并校验，当前仍是未保存工作副本。',
          toolCalls: []
        };
      }
      if (!called.has('save_page')) {
        return toolCall('save-page-1', 'save_page', {
          pageId,
          baseRevisionId: null,
          document,
          idempotencyKey: `scripted-save-${pageId}`
        });
      }
      const revisionId = stringAt(toolResult(messages, 'save_page'), [
        'revision',
        'revisionId'
      ]);
      if (!called.has('preview_page')) {
        return toolCall('preview-page-1', 'preview_page', { pageId, revisionId });
      }
      return {
        content: '页面修订已保存并加载精确预览；明确要求发布后再申请发布。',
        toolCalls: []
      };
    }
  };
}

function inlinePage(pageId: string, intent: string): Record<string, unknown> {
  const title = intent.trim() || '业务概览';
  return {
    schemaVersion: '4.0',
    id: pageId,
    meta: { description: title },
    dataSources: {
      summary: {
        fields: {
          value: {
            type: 'number',
            role: 'measure',
            label: '当前值',
            nullable: false,
            defaultFormat: 'number-grouped'
          }
        },
        source: { type: 'inline', rows: [{ value: 0 }] }
      }
    },
    sections: [
      {
        id: 'overview',
        layout: { type: 'grid', columns: 12 },
        components: [
          {
            id: 'header',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title }
          },
          {
            id: 'value-card',
            type: 'metricCard',
            layout: { span: 4 },
            data: { main: 'summary' },
            props: { rows: [{ label: '当前值', valueField: 'value' }] }
          }
        ]
      }
    ]
  };
}

function dqePage(pageId: string): Record<string, unknown> {
  return {
    schemaVersion: '4.0',
    id: pageId,
    dataSources: {
      customers: {
        fields: {
          'customer-level': {
            queryField: '客户级别',
            type: 'string',
            role: 'dimension',
            nullable: false
          },
          'customer-count': {
            queryField: 'NA客户数',
            type: 'number',
            role: 'measure',
            nullable: false
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: ['客户级别'],
                output_metrics: ['NA客户数'],
                filter: { dims: [], metrics: [] },
                order: {}
              }]
            }
          }
        }
      }
    },
    sections: [{
      id: 'overview',
      layout: { type: 'grid', columns: 12 },
      components: [{
        id: 'customers-table',
        type: 'table',
        layout: { span: 12 },
        data: { main: 'customers' },
        props: {
          title: '客户分层',
          columns: [
            { field: 'customer-level', title: '客户级别' },
            { field: 'customer-count', title: '客户数' }
          ]
        }
      }]
    }]
  };
}

function authoringContext(
  messages: AgentMessage[]
): { document: Record<string, unknown> } | null {
  const entry = [...messages].reverse().find(
    (message) =>
      message.role === 'system' &&
      message.content.startsWith(AUTHORING_CONTEXT_PREFIX)
  );
  if (!entry || entry.role !== 'system') return null;
  try {
    const parsed = JSON.parse(
      entry.content.slice(AUTHORING_CONTEXT_PREFIX.length)
    ) as unknown;
    return isRecord(parsed) && isRecord(parsed.document)
      ? { document: parsed.document }
      : null;
  } catch {
    return null;
  }
}

function isAuthoringConversation(messages: AgentMessage[]): boolean {
  return messages.some(
    (message) =>
      message.role === 'system' &&
      (message.content.includes('METRICCANVAS_AUTHORING_MODE') ||
        message.content.startsWith(AUTHORING_CONTEXT_PREFIX))
  );
}

function latestUserText(messages: AgentMessage[]): string {
  const message = [...messages].reverse().find((entry) => entry.role === 'user');
  return message?.content ?? '';
}

function toolCall(
  id: string,
  name: string,
  input: Record<string, unknown>
): ModelResponse {
  return { content: '', toolCalls: [{ id, name, input }] };
}

function toolResult(
  messages: AgentMessage[],
  name: string
): Record<string, unknown> {
  const message = [...messages].reverse().find(
    (entry) => entry.role === 'tool' && entry.name === name
  );
  if (!message || message.role !== 'tool') return {};
  try {
    const parsed = JSON.parse(message.content) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringAt(
  value: Record<string, unknown>,
  path: string[]
): string {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return '';
    current = current[segment];
  }
  return typeof current === 'string' ? current : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
