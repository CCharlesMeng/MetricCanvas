import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  componentCatalog,
  pageSchema,
  validate,
  versionPolicy
} from '@metriccanvas/page';
import type { DataContextSearch } from './data-context';
import type { McpClient } from './agent-protocol';
import type {
  LifecycleContext,
  PageLifecycle,
  RevisionReference
} from '@metriccanvas/page-lifecycle';
import type { TemplateLibrary } from '@metriccanvas/template-library';

export * from './agent-protocol';
export * from './data-context';
export * from './authoring/auto-visualize';
export * from './authoring/assemble-page';

export interface MetricCanvasMcpDependencies {
  dataContext: DataContextSearch;
  lifecycle: PageLifecycle;
  templates: Pick<TemplateLibrary, 'search'>;
  context(): LifecycleContext;
  previewUrl(reference: RevisionReference): string;
}

export interface PageIdConfirmationMcpClientOptions {
  client: McpClient;
  confirmedPageIds: Iterable<string>;
}

const pageDocumentSchema = z.record(z.string(), z.unknown());
const pageRevisionSelectorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('latest') }),
  z.object({ type: z.literal('published') }),
  z.object({ type: z.literal('exact'), revisionId: z.string().min(1) })
]);

export const COMPONENT_SELECTION_GUIDE = componentCatalog
  .map(
    (component) =>
      `${component.type}: ${component.purpose};适用=${component.chooseWhen.join('、')};` +
      `数据=${component.dataShape};必填=${component.requiredProps.join('、') || '无'};` +
      `标题=${component.title};建议跨度=${component.defaultSpan}`
  )
  .join('\n');

const inlineExample = {
  schemaVersion: '5.0',
  id: 'revenue-overview',
  dataSources: {
    summary: {
      fields: {
        revenue: {
          type: 'number',
          role: 'measure',
          label: '收入',
          unit: '元',
          nullable: false,
          defaultFormat: 'number-grouped'
        }
      },
      source: { type: 'inline', rows: [{ revenue: 128600 }] }
    }
  },
  sections: [
    {
      id: 'overview',
      components: [
        {
          id: 'revenue-card',
          type: 'metricCard',
          layout: { span: 4 },
          data: { main: 'summary' },
          props: { rows: [{ label: '收入', valueField: 'revenue' }] }
        }
      ]
    }
  ]
};

const dqeExample = {
  schemaVersion: '5.0',
  id: 'records-by-category',
  dataSources: {
    records: {
      fields: {
        category: {
          queryField: 'Category',
          type: 'string',
          role: 'dimension',
          nullable: false
        },
        count: {
          queryField: 'RecordCount',
          type: 'number',
          role: 'measure',
          nullable: false
        }
      },
      source: {
        type: 'query',
        initial: {
          capturedAt: '2026-08-04T00:00:00+08:00',
          rows: [{ Category: 'A', RecordCount: 15 }],
          totalCount: 1
        },
        query: {
          language: 'dqe',
          body: {
            dsl_list: [
              {
                output_dims: ['Category'],
                output_metrics: ['RecordCount'],
                filter: { dims: [], metrics: [] },
                order: {}
              }
            ]
          }
        }
      }
    }
  },
  sections: [
    {
      id: 'overview',
      components: [
        {
          id: 'records-table',
          type: 'table',
          layout: { span: 12 },
          data: { main: 'records' },
          props: {
            columns: [
              { field: 'category', title: '分类' },
              { field: 'count', title: '数量' }
            ]
          }
        }
      ]
    }
  ]
};

export const PAGE_BUILDING_PROMPT = [
  '你是 MetricCanvas 页面搭建 Agent。',
  '严格按“确认需求 → 检索数据上下文或选择 inline → 生成查询定义和结果字段契约 → 校验 → 确认页面 id → 保存 → 精确修订预览 → 人工发布”执行。',
  '静态报告使用 inline 页面数据源；需要运行时取数时调用 search_data_context，并仅使用返回的 DQE 执行环境、字段、约束和已验证查询。',
  '不得猜测字段、关系、查询协议、筛选位置或结果契约；数据上下文不足时说明 DATA_CONTEXT_ERROR，不创建指标缺口。',
  'DQE 查询必须保留原始 body；每个 query 页面数据源显式声明 fields，queryField 必须覆盖所有输出字段。',
  'query 页面数据源的 initial.rows 保留 DQE 原始输出字段名；页面模块会按 queryField 归一化，组件仍只引用稳定页面字段 id。',
  '页面字段角色只允许 dimension 或 measure；组件只引用稳定页面字段 id。',
  '组件可见标题统一使用 props.title。摘要默认使用 text，由后端在页面文档的 props.body 直接返回；需要分色时声明 bodyFormat: semanticHtml，并且只使用受控标签与 detail-title、detail-value、detail-description、detail-meta、tone-positive、tone-negative、tone-neutral 语义类。只有需求明确声明运行时 SSE 动态生成时才使用 aiSummary。aiSummary 不声明 data，只通过 promptTemplate 和 relatedData 显式引用页面数据源字段；不得写入端点、Header 或 SSE 参数。',
  '新建页面必须拟定可读且唯一的真实页面 id。validate_page 通过后，客户端会发起结构化页面 id 确认。',
  '编辑既有页面时先调用 get_page(selector=latest)，保留 revisionId 作为 baseRevisionId，再校验、保存和预览。',
  `组件能力目录:\n${COMPONENT_SELECTION_GUIDE}`,
  `inline 最小示例:${JSON.stringify(inlineExample)}`,
  `DQE 最小示例:${JSON.stringify(dqeExample)}`,
  '只有用户看过精确修订预览并明确要求发布后，才能调用 request_publish。'
].join('\n');

export function createMetricCanvasMcpServer(
  dependencies: MetricCanvasMcpDependencies
): McpServer {
  const server = new McpServer({ name: 'metriccanvas', version: '0.2.0' });

  server.registerPrompt(
    'build_dashboard_page',
    { description: 'MetricCanvas v4 受治理的看板页面生成流程' },
    async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: PAGE_BUILDING_PROMPT } }]
    })
  );

  registerJsonResource(server, 'page-schema', 'metriccanvas://page/schema', '当前页面 JSON Schema', pageSchema);
  registerJsonResource(server, 'component-catalog', 'metriccanvas://page/components', '组件能力目录', componentCatalog);
  registerJsonResource(server, 'inline-example', 'metriccanvas://page/examples/inline', 'v4 inline 最小示例', inlineExample);
  registerJsonResource(server, 'dqe-example', 'metriccanvas://page/examples/dqe', 'v4 DQE 最小示例', dqeExample);
  server.registerResource(
    'page-rules',
    'metriccanvas://page/rules',
    { title: 'v4 页面生成规则', mimeType: 'text/plain' },
    async (uri) => ({
      contents: [{ uri: uri.toString(), mimeType: 'text/plain', text: PAGE_BUILDING_PROMPT }]
    })
  );
  server.registerResource(
    'data-context',
    'metriccanvas://data-context/current',
    { title: '当前数据上下文快照', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(await dependencies.dataContext.current())
      }]
    })
  );

  server.registerTool(
    'search_data_context',
    {
      description: '按名称、说明或别名检索当前身份可用的执行环境、Schema、对象、字段与已验证查询。',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10)
      }),
      annotations: { readOnlyHint: true }
    },
    async (input) => toolResult({ ok: true, ...(await dependencies.dataContext.search(input)) })
  );

  server.registerTool(
    'search_templates',
    {
      description: '检索当前用户可使用的已发布页面模板。',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(5)
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ query, limit }) => {
      const context = dependencies.context();
      const result = await dependencies.templates.search(
        { query, limit },
        {
          actorId: context.actorId,
          clientId: context.clientId,
          ...(context.roles?.includes('admin') ? { roles: ['admin'] as const } : {})
        }
      );
      return toolResult({ ok: true, ...result });
    }
  );

  server.registerTool(
    'validate_page',
    {
      description: '使用当前 v4 页面 Schema 校验页面文档。',
      inputSchema: z.object({ document: pageDocumentSchema }),
      annotations: { readOnlyHint: true }
    },
    async ({ document }) => {
      const errors = validate(document);
      return toolResult({
        ok: true,
        valid: errors.length === 0,
        currentSchemaVersion: versionPolicy.current,
        errors
      });
    }
  );

  server.registerTool(
    'save_page',
    {
      description: '校验并保存看板页面修订。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        baseRevisionId: z.string().nullable(),
        document: pageDocumentSchema,
        idempotencyKey: z.string().min(1),
        pageIdConfirmed: z.boolean().optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (command) => {
      const result = await dependencies.lifecycle.saveRevision(command, dependencies.context());
      return toolResult(result, !result.ok);
    }
  );

  server.registerTool(
    'list_pages',
    {
      description: '按 pageId 升序分页列出看板页面摘要。',
      inputSchema: z.object({
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(50)
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ cursor, limit }) => {
      const result = await dependencies.lifecycle.listPages({
        ...(cursor ? { afterPageId: cursor } : {}),
        limit
      });
      return toolResult({ ok: true, pages: result.pages, nextCursor: result.nextPageId });
    }
  );

  server.registerTool(
    'get_page',
    {
      description: '读取 latest、published 或精确指定的页面修订。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        selector: pageRevisionSelectorSchema
      }),
      annotations: { readOnlyHint: true }
    },
    async (reference) => {
      const result = await dependencies.lifecycle.getPage(reference);
      return toolResult(result, !result.ok);
    }
  );

  server.registerTool(
    'preview_page',
    {
      description: '返回精确页面修订的统一运行时预览 URL。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        revisionId: z.string().min(1)
      }),
      annotations: { readOnlyHint: true }
    },
    async (reference) => {
      const result = await dependencies.lifecycle.getRevision(reference);
      if (!result.ok) return toolResult(result, true);
      return toolResult({ ok: true, ...reference, previewUrl: dependencies.previewUrl(reference) });
    }
  );

  server.registerTool(
    'request_publish',
    {
      description: '为当前最新页面修订取得发布租约并返回人工确认 URL。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        revisionId: z.string().min(1),
        idempotencyKey: z.string().min(1)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (command) => {
      const result = await dependencies.lifecycle.requestPublish(command, dependencies.context());
      return toolResult(result, !result.ok);
    }
  );

  return server;
}

function registerJsonResource(
  server: McpServer,
  name: string,
  uri: string,
  title: string,
  value: unknown
): void {
  server.registerResource(
    name,
    uri,
    { title, mimeType: 'application/json' },
    async (resourceUri) => ({
      contents: [{
        uri: resourceUri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(value)
      }]
    })
  );
}

export async function connectInProcessMetricCanvasMcp(
  server: McpServer
): Promise<{ client: McpClient; close(): Promise<void> }> {
  const protocolClient = new Client({
    name: 'metriccanvas-agent',
    version: '0.2.0'
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    protocolClient.connect(clientTransport)
  ]);
  return {
    client: {
      async listTools() {
        const result = await protocolClient.listTools();
        return result.tools.map((tool) => ({
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema as Record<string, unknown>
        }));
      },
      async callTool(request) {
        const result = await protocolClient.callTool(
          {
            name: request.name,
            arguments: request.arguments as Record<string, unknown>
          },
          CallToolResultSchema
        );
        return {
          ...(result.structuredContent !== undefined
            ? { structuredContent: result.structuredContent }
            : {}),
          content: normalizeMcpContent(result.content),
          isError: result.isError === true
        };
      }
    },
    async close() {
      await protocolClient.close();
      await server.close();
    }
  };
}

export function createPageIdConfirmationMcpClient(
  options: PageIdConfirmationMcpClientOptions
): McpClient {
  const confirmedPageIds = new Set(options.confirmedPageIds);
  return {
    listTools: () => options.client.listTools(),
    async callTool(request) {
      if (
        request.name === 'save_page' &&
        isRecord(request.arguments) &&
        typeof request.arguments.pageId === 'string'
      ) {
        // 首次保存必须确认 pageId 的规则由 page-lifecycle 的
        // SaveRevisionCommand 统一强制;这里只把 Agent 侧已收集的确认
        // 状态翻译成命令字段,不再自行拦截或判断"是否首次保存"。
        return options.client.callTool({
          ...request,
          arguments: {
            ...request.arguments,
            pageIdConfirmed: confirmedPageIds.has(request.arguments.pageId)
          }
        });
      }
      if (
        request.name === 'validate_page' &&
        isRecord(request.arguments) &&
        isRecord(request.arguments.document) &&
        typeof request.arguments.document.id === 'string' &&
        isPlaceholderPageId(request.arguments.document.id)
      ) {
        return {
          structuredContent: {
            ok: true,
            valid: false,
            errors: [{
              code: 'PAGE_ID_PLACEHOLDER',
              path: '/id',
              message: '页面 id 必须是可读且唯一的真实候选值'
            }]
          },
          isError: false
        };
      }
      const result = await options.client.callTool(request);
      if (
        request.name !== 'validate_page' ||
        result.isError === true ||
        !isRecord(result.structuredContent) ||
        result.structuredContent.valid !== true ||
        !isRecord(request.arguments) ||
        !isRecord(request.arguments.document)
      ) {
        return result;
      }
      const document = request.arguments.document;
      const pageId = document.id;
      if (typeof pageId !== 'string' || confirmedPageIds.has(pageId)) return result;
      return {
        ...result,
        interaction: {
          id: `confirm-page-id:${pageId}`,
          kind: 'confirm_page_id',
          payload: {
            pageId,
            ...(documentTitle(document) ? { title: documentTitle(document) } : {}),
            stablePath: `/pages/${pageId}`,
            immutableAfterSave: true,
            ...(typeof document.schemaVersion === 'string'
              ? { schemaVersion: document.schemaVersion }
              : {})
          }
        }
      };
    }
  };
}

function isPlaceholderPageId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    /^__.*__$/u.test(normalized) ||
    /^<.*>$/u.test(normalized) ||
    ['pending', 'todo', 'tbd', 'placeholder', '待确认', '待定'].includes(normalized)
  );
}

function toolResult(value: object, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
    ...(isError ? { isError: true } : {})
  };
}

function normalizeMcpContent(
  content: unknown
): Array<{ type: string; text?: string }> {
  if (!Array.isArray(content)) return [];
  return content.flatMap((item) => {
    if (!isRecord(item) || !('type' in item)) return [];
    const type = String(item.type);
    return type === 'text' && 'text' in item
      ? [{ type, text: String(item.text) }]
      : [{ type }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function documentTitle(document: Record<string, unknown>): string | undefined {
  if (!Array.isArray(document.sections)) return undefined;
  for (const section of document.sections) {
    if (!isRecord(section)) continue;
    if (typeof section.title === 'string') return section.title;
    if (!Array.isArray(section.components)) continue;
    for (const component of section.components) {
      if (!isRecord(component) || !isRecord(component.props)) continue;
      if (typeof component.props.title === 'string') return component.props.title;
    }
  }
  return undefined;
}
