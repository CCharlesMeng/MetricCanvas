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
      const requestedPageId = requestedExistingPageId(messages);
      if (requestedPageId && !called.has('get_page')) {
        return toolCall('get-page-existing-1', 'get_page', {
          pageId: requestedPageId,
          selector: { type: 'latest' }
        });
      }
      const loadedPage = loadedExistingPage(messages);
      if (loadedPage) {
        const editedDocument = editedPageDocument(loadedPage.document);
        if (!called.has('validate_page')) {
          return toolCall('validate-existing-1', 'validate_page', {
            document: editedDocument
          });
        }
        if (!called.has('save_page')) {
          return toolCall('save-existing-1', 'save_page', {
            pageId: loadedPage.pageId,
            baseRevisionId: loadedPage.revisionId,
            document: editedDocument,
            idempotencyKey: `scripted-save-${loadedPage.pageId}-r2`
          });
        }

        const saved = toolResult(messages, 'save_page');
        if (toolResultIsError(messages, 'save_page')) {
          return {
            content: '页面修订发生冲突，请在工作台中重新加载当前页面修订后再继续。',
            toolCalls: []
          };
        }
        const revisionId = stringAt(saved, ['revision', 'revisionId']);
        if (!called.has('preview_page')) {
          return toolCall('preview-existing-1', 'preview_page', {
            pageId: loadedPage.pageId,
            revisionId
          });
        }
        return {
          content: 'R2 已保存并加载精确预览。',
          toolCalls: []
        };
      }

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

interface LoadedExistingPage {
  pageId: string;
  revisionId: string;
  document: Record<string, unknown>;
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

function editedPageDocument(document: Record<string, unknown>): Record<string, unknown> {
  const edited = structuredClone(document);
  if (typeof edited.title === 'string') {
    edited.title = `${edited.title}（更新）`;
  }
  return edited;
}

function toolCall(id: string, name: string, input: unknown): ModelResponse {
  return { content: '', toolCalls: [{ id, name, input }] };
}

function loadedExistingPage(messages: AgentMessage[]): LoadedExistingPage | undefined {
  const result = toolResult(messages, 'get_page', false);
  if (!isRecord(result) || !isRecord(result.revision)) return undefined;
  const { revision } = result;
  if (
    typeof revision.pageId !== 'string' ||
    typeof revision.revisionId !== 'string' ||
    !isRecord(revision.document)
  ) {
    return undefined;
  }
  return {
    pageId: revision.pageId,
    revisionId: revision.revisionId,
    document: revision.document
  };
}

function requestedExistingPageId(messages: AgentMessage[]): string | undefined {
  const request = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && message.content.includes('通过 get_page 打开看板页面'));
  const match = request?.content.match(/看板页面\s+([a-zA-Z0-9-]+)/u);
  return match?.[1];
}

function toolResult(
  messages: AgentMessage[],
  name: string,
  required = true
): unknown {
  const message = [...messages]
    .reverse()
    .find(
      (candidate): candidate is Extract<AgentMessage, { role: 'tool' }> =>
        candidate.role === 'tool' && candidate.name === name
    );
  if (!message && required) throw new Error(`scripted model 缺少工具结果:${name}`);
  if (!message) return undefined;
  return JSON.parse(message.content);
}

function toolResultIsError(messages: AgentMessage[], name: string): boolean {
  return (
    [...messages]
      .reverse()
      .find(
        (candidate): candidate is Extract<AgentMessage, { role: 'tool' }> =>
          candidate.role === 'tool' && candidate.name === name
      )?.isError === true
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
