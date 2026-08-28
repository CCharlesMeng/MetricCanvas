import {
  connectInProcessMetricCanvasMcp,
  createMetricCanvasMcpServer,
  type DataContextSearch,
  type McpClient,
  type UnitQueryExecutionResult
} from '@metriccanvas/mcp';
import { hasQueryFieldMapping } from '@metriccanvas/page';
import type {
  DetailRecord,
  EffectiveQuery,
  QueryDataSourceFieldDefinition,
  Row
} from '@metriccanvas/page';
import type {
  LifecycleContext,
  PageLifecycle,
  RevisionReference
} from '@metriccanvas/page-lifecycle';
import type { DataGateway } from '@metriccanvas/runtime';
import type { TemplateLibrary } from '@metriccanvas/template-library';
import type { AgentRunner } from './types';

/**
 * 按 run 隔离的 MCP 接线。
 *
 * 此前平台用一个模块级可变引用(currentMcpIdentity)把身份桥接给跨请求
 * 单例 MCP server 的 context() thunk,同进程并发的多个 Agent 运行会互相
 * 覆盖。这里改为每次运行创建自己的 MCP server 与进程内连接:身份与取消
 * 信号都是该次运行的构造参数,不存在跨运行共享的可变状态。server 本身
 * 无状态(工具实现委托给注入的 lifecycle / templates / dataContext 单例,
 * 共享状态只存在于这些有明确并发语义的服务里),按 run 创建只付出一次
 * 进程内握手的成本。
 */
export interface RunScopedMcpDependencies {
  dataContext: DataContextSearch;
  lifecycle: PageLifecycle;
  templates: Pick<TemplateLibrary, 'search'>;
  previewUrl(reference: RevisionReference): string;
  /**
   * 创作期查询执行端口(ADR-0032),附当次运行的取消信号:取消运行时
   * 中止进行中的真实执行,而不是等它自然返回。
   */
  executeDataRequestUnitQuery(
    query: EffectiveQuery,
    signal: AbortSignal | undefined
  ): Promise<UnitQueryExecutionResult>;
}

/** 一次 Agent 运行的作用域:身份与取消信号按 run 传递,不经模块级变量。 */
export interface AgentRunScope {
  identity: LifecycleContext;
  signal?: AbortSignal;
}

export interface RunScopedMcpConnection {
  client: McpClient;
  close(): Promise<void>;
}

export function createRunScopedMcpConnector(
  dependencies: RunScopedMcpDependencies
): (scope: AgentRunScope) => Promise<RunScopedMcpConnection> {
  return async (scope) => {
    const server = createMetricCanvasMcpServer({
      dataContext: dependencies.dataContext,
      lifecycle: dependencies.lifecycle,
      templates: dependencies.templates,
      executeDataRequestUnitQuery: (query) =>
        dependencies.executeDataRequestUnitQuery(query, scope.signal),
      context: () => scope.identity,
      previewUrl: dependencies.previewUrl
    });
    return connectInProcessMetricCanvasMcp(server);
  };
}

/**
 * 创作期查询执行端口的运行感知实现:只接受 bindIdentity 已构造的
 * 请求级 gateway，取消信号经 DataGateway Interface 原样传递到 adapter。
 * 这条 seam 不自行重建 gateway，因而不会在 Agent signal 路径丢掉 actor。
 *
 * 行键空间(#69 修正):数据网关按查询字段映射把行归一化为稳定页面字段 id,
 * 而创作期端口的契约是 DQE 原始输出字段名——验真回传的样例行会成为
 * 内嵌初始行(ADR-0020:字段键使用 DQE 输出字段名,页面文档解析时才归一化)。
 * 这里经同一份查询字段映射把行映射回原始键,归一化校验(类型、可空性、
 * 契约匹配)仍由数据网关执行,不重写第二份。
 */
export function createRunAwareUnitQueryExecutor(options: {
  gateway: DataGateway;
}): RunScopedMcpDependencies['executeDataRequestUnitQuery'] {
  return async (query, signal) => {
    const result = await options.gateway.fetchData(query, undefined, signal);
    return {
      ...result,
      rows: result.rows.map((row) => rawRowFromNormalized(row, query.fieldMappings))
    };
  };
}

/** 归一化行(稳定页面字段 id 键)→ DQE 原始输出字段名键;明细项字段同样还原。 */
function rawRowFromNormalized(
  row: Row,
  fieldMappings: Record<string, QueryDataSourceFieldDefinition>
): Row {
  const raw: Row = {};
  for (const [fieldId, definition] of Object.entries(fieldMappings)) {
    // 计算阶段产出字段不来自外部响应，还原原始行时没有它的位置。
    if (!(fieldId in row) || !hasQueryFieldMapping(definition)) continue;
    const value = row[fieldId]!;
    if (definition.type === 'recordList' && Array.isArray(value)) {
      raw[definition.queryField] = value.map((item) => {
        const rawItem: DetailRecord = {};
        for (const [itemFieldId, itemDefinition] of Object.entries(
          definition.items.fields
        )) {
          if (itemFieldId in item) {
            rawItem[itemDefinition.queryField] = item[itemFieldId]!;
          }
        }
        return rawItem;
      });
    } else {
      raw[definition.queryField] = value;
    }
  }
  return raw;
}

/**
 * 把"按 run 建立 MCP 连接"包进 AgentRunner:运行开始时建立连接,
 * 结束(含失败、取消与消费方提前放弃)时在 finally 里关闭,不泄漏连接。
 */
export function createRunScopedAgentRunner(options: {
  connect(signal: AbortSignal | undefined): Promise<RunScopedMcpConnection>;
  createRunner(client: McpClient): AgentRunner;
}): AgentRunner {
  return {
    async *run(input) {
      const connection = await options.connect(input.signal);
      try {
        yield* options.createRunner(connection.client).run(input);
      } finally {
        await connection.close();
      }
    }
  };
}
