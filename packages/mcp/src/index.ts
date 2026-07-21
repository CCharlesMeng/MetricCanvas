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
import type { CatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { McpClient } from '@metriccanvas/agent-runner';
import type {
  LifecycleContext,
  PageLifecycle,
  RevisionReference
} from '@metriccanvas/page-lifecycle';

export interface MetricCanvasMcpDependencies {
  catalog: CatalogDiscovery;
  lifecycle: PageLifecycle;
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
      `建议跨度=${component.defaultSpan}`
  )
  .join('\n');

export const PAGE_BUILDING_PROMPT = [
  '你是 MetricCanvas 页面搭建 Agent。',
  '新建看板页面时严格按“检索元数据 → 澄清 → 生成 → 校验 → 确认页面 id → 保存 → 精确修订预览 → 用户确认 → 申请发布”执行。',
  '不得猜测指标 code、口径、维度、时间范围或粒度;有歧义必须提问。',
  '首次 save_page 前必须展示可读且唯一的页面 id,并等待用户明确确认。',
  '编辑既有看板页面时,先调用 get_page(selector=latest)取得当前页面修订和页面文档,保留返回的精确 revisionId 作为 baseRevisionId;修改后调用 validate_page、save_page、preview_page。编辑会追加页面修订,不得再次请求页面 id 确认。',
  '只保存 validate_page 返回 valid=true 的当前 schemaVersion 页面。',
  '结构化查询只允许放在 query 页面数据源中;组件必须经 data 数据槽引用页面数据源,不得携带 query 或数据行。',
  '先把用户诉求拆成分析任务,再按组件能力选择一个或多个组件:当前值用 metricCard,类别比较用 barChart,时间变化用 lineChart,少量类别占比用 pieChart,Top N 用 rankingCard,逐行核对用 table;完整页面通常先放 reportHeader。',
  '同一诉求包含多个分析任务时组合多个组件,每个组件绑定形状匹配的命名页面数据源;不得为了“看起来丰富”添加与诉求无关的图表。',
  '开发期可由 mock 数据网关执行 query 页面数据源;mock 只替代数据服务供数,页面仍必须声明合法指标、维度、字段契约和结构化查询,不得把假数据塞进组件 props。',
  `组件能力目录:\n${COMPONENT_SELECTION_GUIDE}`,
  '用户要求单指标卡时必须使用 type=metricCard,不得降级为 barChart、text 或其他组件;props.rows 只声明该指标行。',
  '没有筛选器时省略 query 页面数据源中的 query.filters,不要发送空对象;JSON Schema 的 oneOf 错误不代表 metricCard 不存在。',
  `单指标卡最小合法示例:{"schemaVersion":"${versionPolicy.current}","id":"<confirmed-id>","dataSources":{"main":{"fields":{"<metric-code>":{"type":"number","role":"metric"}},"source":{"type":"query","query":{"metrics":["<metric-code>"],"aggregation":"sum"}}}},"sections":[{"id":"overview","title":"<title>","layout":{"type":"grid","columns":12},"components":[{"id":"w-metric","type":"metricCard","layout":{"span":3},"data":{"main":"main"},"props":{"title":"<title>","rows":[{"label":"<metric-name>","valueField":"<metric-code>"}]}}]}]}`,
  '校验失败时按 JSON Pointer 修正字段,同时保持用户指定的组件语义不变。',
  '保存后先调用 preview_page。只有用户看过精确修订预览并明确要求发布后,才能调用 request_publish;预览完成不等于同意发布,MCP 不负责确认发布。',
  '页面搭建工作台不是 JSON 编辑器,不要要求用户手写页面文档。'
].join('\n');

export function createMetricCanvasMcpServer(
  dependencies: MetricCanvasMcpDependencies
): McpServer {
  const server = new McpServer({
    name: 'metriccanvas',
    version: '0.1.0'
  });

  server.registerPrompt(
    'build_dashboard_page',
    {
      description: 'MetricCanvas 受治理的看板页面生成流程'
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: PAGE_BUILDING_PROMPT }
        }
      ]
    })
  );

  server.registerResource(
    'page-schema',
    'metriccanvas://page/schema',
    {
      title: '当前页面 JSON Schema',
      mimeType: 'application/schema+json'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/schema+json',
          text: JSON.stringify(pageSchema)
        }
      ]
    })
  );

  server.registerResource(
    'component-catalog',
    'metriccanvas://page/components',
    {
      title: '组件能力目录',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(componentCatalog)
        }
      ]
    })
  );

  server.registerResource(
    'generation-guide',
    'metriccanvas://page/generation-guide',
    {
      title: '页面生成流程',
      mimeType: 'text/plain'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: `${PAGE_BUILDING_PROMPT}\n当前 schemaVersion:${versionPolicy.current}`
        }
      ]
    })
  );

  server.registerTool(
    'search_catalog',
    {
      description: '按指标或维度的 code、名称检索数据服务目录。',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10)
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ query, limit }) => {
      const result = await dependencies.catalog.search({ query, limit });
      return toolResult({ ok: true, ...result });
    }
  );

  server.registerTool(
    'validate_page',
    {
      description: '使用当前页面 Schema 与当前数据服务元数据校验页面文档。',
      inputSchema: z.object({ document: pageDocumentSchema }),
      annotations: { readOnlyHint: true }
    },
    async ({ document }) => {
      const catalog = await dependencies.catalog.current();
      const errors = validate(document, catalog.snapshot);
      return toolResult({
        ok: true,
        valid: errors.length === 0,
        currentSchemaVersion: versionPolicy.current,
        metadataVersion: catalog.version,
        errors
      });
    }
  );

  server.registerTool(
    'save_page',
    {
      description:
        '校验并保存看板页面: baseRevisionId 为 null 时产生不可变 R1;传入当前最新 revisionId 时追加不可变页面修订。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        baseRevisionId: z.string().nullable(),
        document: pageDocumentSchema,
        idempotencyKey: z.string().min(1)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (command) => {
      const result = await dependencies.lifecycle.saveRevision(
        command,
        dependencies.context()
      );
      return toolResult(result, !result.ok);
    }
  );

  server.registerTool(
    'list_pages',
    {
      description: '按 pageId 升序分页列出看板页面摘要;cursor 是上一页最后一个 pageId。',
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
      return toolResult({
        ok: true,
        pages: result.pages,
        nextCursor: result.nextPageId
      });
    }
  );

  server.registerTool(
    'get_page',
    {
      description: '读取看板页面的 latest、published 或精确指定的页面修订。',
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
      description: '为精确的已保存页面修订返回统一运行时预览 URL。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        revisionId: z.string().min(1)
      }),
      annotations: { readOnlyHint: true }
    },
    async (reference) => {
      const result = await dependencies.lifecycle.getRevision(reference);
      if (!result.ok) return toolResult(result, true);
      return toolResult({
        ok: true,
        pageId: reference.pageId,
        revisionId: reference.revisionId,
        previewUrl: dependencies.previewUrl(reference)
      });
    }
  );

  server.registerTool(
    'request_publish',
    {
      description: '为当前最新页面修订取得 15 分钟发布租约并返回人工确认 URL。',
      inputSchema: z.object({
        pageId: z.string().min(1),
        revisionId: z.string().min(1),
        idempotencyKey: z.string().min(1)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (command) => {
      const result = await dependencies.lifecycle.requestPublish(
        command,
        dependencies.context()
      );
      return toolResult(result, !result.ok);
    }
  );

  return server;
}

export async function connectInProcessMetricCanvasMcp(
  server: McpServer
): Promise<{ client: McpClient; close(): Promise<void> }> {
  const protocolClient = new Client({
    name: 'metriccanvas-agent-runner',
    version: '0.1.0'
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
        typeof request.arguments.pageId === 'string' &&
        request.arguments.baseRevisionId === null &&
        !confirmedPageIds.has(request.arguments.pageId)
      ) {
        return {
          isError: true,
          structuredContent: {
            ok: false,
            error: {
              code: 'PAGE_ID_CONFIRMATION_REQUIRED',
              message: `首次保存前必须确认页面 id ${request.arguments.pageId}`
            }
          }
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
              : {}),
            ...(typeof result.structuredContent.metadataVersion === 'string'
              ? { metadataVersion: result.structuredContent.metadataVersion }
              : {})
          }
        }
      };
    }
  };
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
    if (typeof item !== 'object' || item === null || !('type' in item)) return [];
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
