import { env } from '$env/dynamic/private';
import {
  assembleTransientPage,
  createDataContextSearch,
  createDataRequestUnitVerification,
  createPageIdConfirmationMcpClient,
  parseDataContextSnapshot,
  semanticSurfaceOf,
  type DataContextSearch
} from '@metriccanvas/mcp';
import {
  createMemoryPageLifecycle,
  createPostgresPageLifecycle,
  type DataContextVersionProvider,
  type LifecycleContext,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import {
  createMemoryTemplateLibrary,
  createPostgresTemplateLibrary,
  type TemplateLibrary
} from '@metriccanvas/template-library';
import type { DataGateway } from '@metriccanvas/runtime';
import { createAgentRunner } from './agent/runner';
import {
  createRunAwareUnitQueryExecutor,
  createRunScopedAgentRunner,
  createRunScopedMcpConnector
} from './agent/run-mcp';
import { createAgentRunRegistry, type AgentRunRegistry } from './agent/run-registry';
import { createAskOrchestrationRunner, type AskScopeConfirmation } from './ask/orchestrator';
import { createSnapshotAskRetrieval } from './ask/retrieval';
import { createModelBackedAskModel } from './ask/model-port';
import { createLexicalAskModel } from './ask/lexical-model';
import { getServerDataGateway } from './data-gateway.server';
import { createDeepSeekModelProvider } from './agent/deepseek.server';
import type { AgentRunner } from './agent/types';
import { createComponentSelectingScriptedProvider } from './scripted-model.server';
import { createAuthoringMcpClient } from './authoring-mcp.server';
import {
  agentModelDescriptor,
  resolveAgentModelConfig,
  type AgentModelDescriptor
} from './agent-model-config.server';
import {
  seedPublishedPages,
  seedPublishedTemplates,
  type OfflineTemplateSeed
} from './offline-services';
import { createMemoryAnalysisSessionStore } from './session/memory';
import {
  createSessionMetricGapLedger,
  type MetricGapLedger
} from './session/metric-gap';
import type { AnalysisSessionStore } from './session/store';
import bundledDataContext from '$fixtures/schema-metadata.example.json';

const bundledPageModules = import.meta.glob<{ default: unknown }>('$pages/*.json', {
  eager: true
});
const bundledTemplateModules = import.meta.glob<{ default: OfflineTemplateSeed }>(
  '$templates/*.json',
  { eager: true }
);

/** Agent 运行可靠性上限(#32):超时与用量任一到达即安全停止。 */
const AGENT_RUN_TIMEOUT_MS = 120_000;
const AGENT_RUN_MAX_TOTAL_TOKENS = 200_000;

export interface PlatformServices {
  lifecycle: PageLifecycle;
  templates: TemplateLibrary;
  dataContext: DataContextSearch;
  dataGateway: DataGateway;
  sessions: AnalysisSessionStore;
  /** 指标需求条目台账(#67):从会话事件流聚合,合并排行 + 状态流转。 */
  metricGaps: MetricGapLedger;
  /** 进行中 Agent 运行的注册表:取消端点经由它中止运行。 */
  agentRuns: AgentRunRegistry;
  agentModel: AgentModelDescriptor;
  createRunner(input: {
    confirmedPageIds: string[];
    runId: string;
    mode?: 'authoring' | 'lifecycle' | 'ask';
    identity: LifecycleContext;
    /** 问数编排(mode=ask,#66)的人工确认与钉住状态;其余模式忽略。 */
    scopeConfirmations?: AskScopeConfirmation[];
    userDomains?: string[];
    pinnedComponents?: Array<{ dataSourceId: string; componentType: string }>;
  }): AgentRunner;
  runtimeOrigin: string;
}

const serviceCache = globalThis as typeof globalThis & {
  __metricCanvasPlatformServicesPromise?: Promise<PlatformServices>;
};

export function getPlatformServices(): Promise<PlatformServices> {
  serviceCache.__metricCanvasPlatformServicesPromise ??= createServices().catch((cause) => {
    serviceCache.__metricCanvasPlatformServicesPromise = undefined;
    throw cause;
  });
  return serviceCache.__metricCanvasPlatformServicesPromise;
}

async function createServices(): Promise<PlatformServices> {
  const runtimeOrigin = env.RUNTIME_ORIGIN ?? 'http://localhost:5173';
  const platformOrigin = env.PLATFORM_ORIGIN ?? 'http://localhost:5174';
  const offline = env.METRICCANVAS_OFFLINE === '1';
  const databaseUrl =
    env.DATABASE_URL ??
    'postgres://metriccanvas:metriccanvas@localhost:5432/metriccanvas';
  // 内置快照经唯一校验入口进入类型世界(#80),不以双重 cast 硬闯。
  const parsedSnapshot = parseDataContextSnapshot(bundledDataContext);
  if (!parsedSnapshot.ok) {
    throw new Error(
      '内置数据上下文快照未通过结构校验:' +
        parsedSnapshot.errors.map((error) => `${error.path} ${error.message}`).join(';')
    );
  }
  const snapshot = parsedSnapshot.snapshot;
  const dataContext = createDataContextSearch({
    current: async () => snapshot
  });
  const dataContextVersion: DataContextVersionProvider = {
    current: async () => ({ version: snapshot.version })
  };
  const lifecycleOptions = {
    dataContext: dataContextVersion,
    urls: {
      confirmation: (requestId: string, token: string) =>
        `${platformOrigin}/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
    }
  };
  const lifecycle = offline
    ? await createOfflinePageLifecycle(lifecycleOptions)
    : await createPostgresPageLifecycle({ ...lifecycleOptions, databaseUrl });
  const templateOptions = {
    pageLifecycle: lifecycle,
    urls: {
      confirmation: (requestId: string, token: string) =>
        `${platformOrigin}/templates/publish/${requestId}?token=${encodeURIComponent(token)}`
    }
  };
  const templates = offline
    ? createMemoryTemplateLibrary(templateOptions)
    : await createPostgresTemplateLibrary({ ...templateOptions, databaseUrl });
  // 分析会话轻量落库(ADR-0030)。本轮只有内存实现,offline 与 postgres 两种
  // 模式都用它;PostgreSQL 实现等 #52 的版本化迁移接入(不引入启动期建表),
  // 届时按 databaseUrl 分支并复用同一份契约测试。
  const sessions = createMemoryAnalysisSessionStore();
  // 指标需求条目台账(#67,ADR-0036):缺口出现随会话事件流落库,这里只做
  // 聚合与状态流转,不另建采集通道;fulfilled 关联校验以快照语义面为准。
  const semanticSurfaces = semanticSurfaceOf(snapshot);
  const metricGaps = createSessionMetricGapLedger({
    sessions,
    metricExists: async ({ businessDomain, metricName }) =>
      semanticSurfaces.some(
        (surface) =>
          surface.businessDomain === businessDomain &&
          surface.metrics.some((metric) => metric.name === metricName)
      )
  });
  if (offline) {
    await seedPublishedTemplates(
      templates,
      lifecycle,
      Object.values(bundledTemplateModules).map((module) => module.default)
    );
  }

  const dataGateway = getServerDataGateway(env);

  // 创作期查询执行端口(#64):复用服务端数据网关的归一化能力(ADR-0032);
  // 携带运行取消信号时以并入信号的 fetch 执行,取消即中止进行中的真实查询。
  // 页面搭建工具循环与问数编排共用同一端口,查询正确性标准只有一份。
  const executeUnitQuery = createRunAwareUnitQueryExecutor({
    environment: env,
    fallbackGateway: dataGateway
  });

  // 按 run 隔离的 MCP 接线(#32):每次 Agent 运行创建自己的 MCP server 与
  // 进程内连接,身份与取消信号是该次运行的构造参数。此前的模块级可变引用
  // currentMcpIdentity(同进程并发运行互相覆盖)随之删除;取数单元验真的
  // 单次运行执行上限(#64)也因此真正按 run 计数,不再跨运行累计。
  const connectRunScopedMcp = createRunScopedMcpConnector({
    dataContext,
    lifecycle,
    templates,
    previewUrl: ({ pageId, revisionId }) =>
      `${runtimeOrigin}/pages/${pageId}?revision=${encodeURIComponent(revisionId)}`,
    executeDataRequestUnitQuery: executeUnitQuery
  });
  const agentRuns = createAgentRunRegistry();
  const agentModelConfig = resolveAgentModelConfig(env);
  const deepSeekModel =
    agentModelConfig.provider === 'deepseek'
      ? createDeepSeekModelProvider({
          apiKey: agentModelConfig.apiKey,
          model: agentModelConfig.model,
          baseUrl: agentModelConfig.baseUrl
        })
      : null;

  // 问数编排(#66)的注入端口:结构化决策走非流式模型,无 Key 时用字面
  // 命中的确定性回退;检索与语义面投影来自同一份内置快照(#80)。
  const askModel = deepSeekModel
    ? createModelBackedAskModel(deepSeekModel)
    : createLexicalAskModel();
  const askRetrieval = createSnapshotAskRetrieval({ current: async () => snapshot });

  return {
    lifecycle,
    templates,
    dataContext,
    dataGateway,
    sessions,
    metricGaps,
    agentRuns,
    agentModel: agentModelDescriptor(agentModelConfig),
    createRunner({
      confirmedPageIds,
      runId,
      mode = 'lifecycle',
      identity,
      scopeConfirmations,
      userDomains,
      pinnedComponents
    }) {
      if (mode === 'ask') {
        // 问数编排(#66):确定性阶段状态机,不走工具循环。验真能力按 run
        // 构造,执行上限(#64)按 run 计数;运行取消信号并入真实执行。
        return {
          run: (input) =>
            createAskOrchestrationRunner(
              {
                model: askModel,
                retrieval: askRetrieval,
                verifyUnit: createDataRequestUnitVerification({
                  dataContext: { current: async () => snapshot },
                  executeDataRequestUnitQuery: (query) =>
                    executeUnitQuery(query, input.signal)
                }),
                assemblePage: assembleTransientPage
              },
              {
                runId,
                timeoutMs: AGENT_RUN_TIMEOUT_MS,
                ...(scopeConfirmations === undefined ? {} : { scopeConfirmations }),
                ...(userDomains === undefined ? {} : { userDomains }),
                ...(pinnedComponents === undefined ? {} : { pinnedComponents })
              }
            ).run(input)
        };
      }
      return createRunScopedAgentRunner({
        connect: (signal) => connectRunScopedMcp({ identity, signal }),
        createRunner: (runClient) => {
          const client =
            mode === 'authoring' ? createAuthoringMcpClient(runClient) : runClient;
          return createAgentRunner({
            model: deepSeekModel ?? createComponentSelectingScriptedProvider(runId),
            mcp: createPageIdConfirmationMcpClient({ client, confirmedPageIds }),
            maxModelTurns: 12,
            timeoutMs: AGENT_RUN_TIMEOUT_MS,
            maxTotalTokens: AGENT_RUN_MAX_TOTAL_TOKENS,
            toolCallLimits:
              mode === 'authoring'
                ? {
                    search_data_context: 4,
                    search_templates: 2,
                    list_pages: 2,
                    get_page: 3,
                    validate_page: 4
                  }
                : undefined
          });
        }
      });
    },
    runtimeOrigin
  };
}

async function createOfflinePageLifecycle(
  options: Parameters<typeof createMemoryPageLifecycle>[0]
): Promise<PageLifecycle> {
  const lifecycle = createMemoryPageLifecycle(options);
  await seedPublishedPages(
    lifecycle,
    Object.values(bundledPageModules).map((module) => module.default)
  );
  return lifecycle;
}
