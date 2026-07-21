import type {
  AgentMessage,
  ModelProvider,
  ModelResponse
} from '@metriccanvas/agent-runner';

export function createComponentSelectingScriptedProvider(runId = 'local'): ModelProvider {
  const pageId = `ai-dashboard-${runId.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 8) || 'local'}`;

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
        if (!called.has('request_publish') && publishRequested(messages)) {
          return toolCall('publish-existing-1', 'request_publish', {
            pageId: loadedPage.pageId,
            revisionId,
            idempotencyKey: `scripted-publish-${loadedPage.pageId}-${revisionId}`
          });
        }
        return {
          content: called.has('request_publish')
            ? '新页面修订已加载精确预览。发布租约已取得，请在工作台中完成人工确认。'
            : '新页面修订已保存并加载精确预览。你可以继续编辑；确认内容后再明确要求发布。',
          toolCalls: []
        };
      }

      const intent = requestedIntent(messages);
      const pageDocument = pageDocumentFor(pageId, intent);
      const searched = searchedCatalogQueries(messages);
      const pendingCatalogQuery = requiredCatalogQueries(intent).find(
        (query) => !searched.has(query)
      );
      if (pendingCatalogQuery) {
        return toolCall(
          `search-${searched.size + 1}`,
          'search_catalog',
          { query: pendingCatalogQuery, limit: 10 }
        );
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
      if (!called.has('request_publish') && publishRequested(messages)) {
        return toolCall('publish-1', 'request_publish', {
          pageId,
          revisionId,
          idempotencyKey: `scripted-publish-${pageId}-r1`
        });
      }

      return {
        content: called.has('request_publish')
          ? 'R1 已加载精确预览。发布租约已取得，请在工作台中完成人工确认。'
          : 'R1 已保存并加载精确预览。你可以继续编辑；确认内容后再明确要求发布。',
        toolCalls: []
      };
    }
  };
}

/** 向后兼容既有测试和调用方；实现已从单指标卡扩展为按诉求选择组件。 */
export const createSingleMetricCardScriptedProvider = createComponentSelectingScriptedProvider;

interface LoadedExistingPage {
  pageId: string;
  revisionId: string;
  document: Record<string, unknown>;
}

type VisualizationKind = 'metric' | 'bar' | 'line' | 'pie' | 'ranking' | 'table';

function pageDocumentFor(pageId: string, intent: string): Record<string, unknown> {
  const kinds = selectVisualizationKinds(intent);
  const dataSources: Record<string, unknown> = {};
  const components: Array<Record<string, unknown>> = [
    {
      id: 'page-header',
      type: 'reportHeader',
      layout: { span: 12 },
      props: {
        title: dashboardTitle(intent, kinds),
        subtitle: '由 Agent 根据诉求选择组件；开发期由 mock 数据网关供数'
      }
    }
  ];

  if (kinds.includes('metric')) {
    dataSources['summary-gmv'] = metricSource('gmv', '成交总额', 'number-grouped');
    components.push({
      id: 'gmv-card',
      type: 'metricCard',
      layout: { span: 3 },
      data: { main: 'summary-gmv' },
      props: {
        title: '成交总额',
        rows: [{ label: '成交总额', valueField: 'gmv' }]
      }
    });
    if (needsOrderCount(intent)) {
      dataSources['summary-orders'] = metricSource(
        'order-count',
        '订单量',
        'number-grouped'
      );
      components.push({
        id: 'order-count-card',
        type: 'metricCard',
        layout: { span: 3 },
        data: { main: 'summary-orders' },
        props: {
          title: '订单量',
          rows: [{ label: '订单量', valueField: 'order-count' }]
        }
      });
    }
  }

  if (kinds.includes('bar')) {
    const dimension = /渠道/u.test(intent) && !/区域/u.test(intent) ? 'channel' : 'region';
    const label = dimension === 'channel' ? '渠道' : '区域';
    dataSources['category-comparison'] = dimensionMetricSource(dimension, label, ['gmv']);
    components.push({
      id: 'category-comparison-chart',
      type: 'barChart',
      layout: { span: kinds.includes('pie') ? 8 : 12 },
      data: { main: 'category-comparison' },
      props: {
        title: `各${label}成交总额对比`,
        categoryField: dimension,
        series: [{ field: 'gmv', label: '成交总额' }],
        rounded: true
      }
    });
  }

  if (kinds.includes('line')) {
    dataSources.trend = dimensionMetricSource('mtime', '统计时间', ['gmv']);
    components.push({
      id: 'gmv-trend-chart',
      type: 'lineChart',
      layout: { span: kinds.includes('pie') ? 8 : 12 },
      data: { main: 'trend' },
      props: {
        title: '成交总额趋势',
        xField: 'mtime',
        series: [{ field: 'gmv', label: '成交总额' }],
        smooth: true,
        areaGradient: true
      }
    });
  }

  if (kinds.includes('pie')) {
    const dimension = /区域/u.test(intent) && !/渠道/u.test(intent) ? 'region' : 'channel';
    const label = dimension === 'region' ? '区域' : '渠道';
    dataSources.share = dimensionMetricSource(dimension, label, ['gmv']);
    components.push({
      id: 'gmv-share-chart',
      type: 'pieChart',
      layout: { span: 4 },
      data: { main: 'share' },
      props: {
        title: `成交总额${label}占比`,
        categoryField: dimension,
        valueField: 'gmv',
        ring: '55%',
        labelLine: false
      }
    });
  }

  if (kinds.includes('ranking')) {
    dataSources.ranking = dimensionMetricSource('region', '区域', ['gmv'], {
      orderBy: [{ field: 'gmv', direction: 'desc' }],
      limit: 5
    });
    components.push({
      id: 'region-ranking',
      type: 'rankingCard',
      layout: { span: 4 },
      data: { main: 'ranking' },
      props: {
        title: '区域成交总额排行',
        nameField: 'region',
        valueField: 'gmv'
      }
    });
  }

  if (kinds.includes('table')) {
    dataSources.details = dimensionMetricSource('region', '区域', ['gmv', 'order-count']);
    components.push({
      id: 'region-detail-table',
      type: 'table',
      layout: { span: 12 },
      data: { main: 'details' },
      props: {
        title: '区域经营明细',
        columns: [
          { field: 'region', title: '区域' },
          { field: 'gmv', title: '成交总额', sortable: true, align: 'right' },
          { field: 'order-count', title: '订单量', sortable: true, align: 'right' }
        ],
        pagination: { mode: 'none' }
      }
    });
  }

  return {
    schemaVersion: '1.0',
    id: pageId,
    meta: { description: `根据用户诉求生成:${intent}` },
    dataSources,
    sections: [
      {
        title: dashboardTitle(intent, kinds),
        id: 'overview',
        layout: { type: 'grid', columns: 12 },
        components
      }
    ]
  };
}

function selectVisualizationKinds(intent: string): VisualizationKind[] {
  if (/(经营概览|经营总览|综合看板|经营看板|销售概览)/u.test(intent)) {
    return ['metric', 'bar', 'line', 'pie', 'table'];
  }
  const kinds: VisualizationKind[] = [];
  if (/(对比|比较|分类分布|按区域|按渠道)/u.test(intent)) kinds.push('bar');
  if (/(趋势|走势|按日|按月|时间变化)/u.test(intent)) kinds.push('line');
  if (/(占比|构成|份额)/u.test(intent)) kinds.push('pie');
  if (/(排行|排名|top\s*\d*)/iu.test(intent)) kinds.push('ranking');
  if (/(明细|列表|表格)/u.test(intent)) kinds.push('table');
  if (/(指标卡|核心指标|kpi)/iu.test(intent)) kinds.unshift('metric');
  return kinds.length > 0 ? [...new Set(kinds)] : ['metric'];
}

function requiredCatalogQueries(intent: string): string[] {
  return needsOrderCount(intent) || selectVisualizationKinds(intent).includes('table')
    ? ['成交总额', '订单量']
    : ['成交总额'];
}

function needsOrderCount(intent: string): boolean {
  return /(订单|经营概览|经营总览|综合看板|经营看板|销售概览)/u.test(intent);
}

function metricSource(code: string, label: string, format: string): Record<string, unknown> {
  return {
    fields: { [code]: { type: 'number', role: 'metric', label, format } },
    source: {
      type: 'query',
      query: { metrics: [code], aggregation: 'sum' }
    }
  };
}

function dimensionMetricSource(
  dimension: string,
  dimensionLabel: string,
  metrics: string[],
  additions: Record<string, unknown> = {}
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [dimension]: {
      type: dimension === 'mtime' ? 'date' : 'string',
      role: 'dimension',
      label: dimensionLabel,
      ...(dimension === 'mtime' ? { format: 'date' } : {})
    }
  };
  for (const metric of metrics) {
    fields[metric] = {
      type: 'number',
      role: 'metric',
      label: metric === 'gmv' ? '成交总额' : '订单量',
      format: 'number-grouped'
    };
  }
  return {
    fields,
    source: {
      type: 'query',
      query: {
        metrics,
        dimensions: [dimension],
        aggregation: 'sum',
        ...additions
      }
    }
  };
}

function dashboardTitle(intent: string, kinds: VisualizationKind[]): string {
  if (/(经营概览|经营总览|综合看板|经营看板|销售概览)/u.test(intent)) {
    return '销售经营概览';
  }
  if (kinds.includes('ranking')) return '区域经营排行';
  if (kinds.includes('table')) return '经营明细';
  if (kinds.includes('pie')) return '成交总额构成';
  if (kinds.includes('line')) return '成交总额趋势';
  if (kinds.includes('bar')) return '成交总额对比';
  return '成交总额';
}

function editedPageDocument(document: Record<string, unknown>): Record<string, unknown> {
  const edited = structuredClone(document);
  const section = Array.isArray(edited.sections) ? edited.sections.find(isRecord) : undefined;
  if (section && typeof section.title === 'string') section.title = `${section.title}（更新）`;
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

function requestedIntent(messages: AgentMessage[]): string {
  return (
    messages.find(
      (message) =>
        message.role === 'user' &&
        !message.content.includes('我已通过页面搭建工作台确认页面 id') &&
        !message.content.includes('通过 get_page 打开看板页面')
    )?.content ?? '创建一个展示成交总额的指标页面'
  );
}

function searchedCatalogQueries(messages: AgentMessage[]): Set<string> {
  const queries = messages.flatMap((message) => {
    if (message.role !== 'assistant') return [];
    return message.toolCalls.flatMap((call) => {
      if (call.name !== 'search_catalog' || !isRecord(call.input)) return [];
      return typeof call.input.query === 'string' ? [call.input.query] : [];
    });
  });
  return new Set(queries);
}

function publishRequested(messages: AgentMessage[]): boolean {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content.trim();
  if (!lastUserMessage || /(?:不要|暂不|先不|取消).*发布/u.test(lastUserMessage)) return false;
  return (
    lastUserMessage === '发布' ||
    /(?:确认发布|同意发布|可以发布|发起发布|申请发布|请发布|现在发布|继续发布|发布页面|发布这个)/u.test(
      lastUserMessage
    )
  );
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
