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
  type DataContextVersionProvider,
  type LifecycleContext,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import {
  createMemoryTemplateLibrary,
  type TemplateLibrary
} from '@metriccanvas/template-library';
import {
  createPostgresPageLifecycle,
  createPostgresTemplateLibrary
} from '@metriccanvas/persistence-postgres';
import type { DataGateway, DimensionValuesGateway } from '@metriccanvas/runtime';
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
import { getServerDataGateway, type ServerEnvironment } from './data-gateway.server';
import { createDeepSeekModelProvider } from './agent/deepseek.server';
import { createOpenAICompatibleModelProvider } from './agent/openai-compatible.server';
import type { AgentRunner, ModelProvider } from './agent/types';
import { createComponentSelectingScriptedProvider } from './scripted-model.server';
import { createAuthoringMcpClient } from './authoring-mcp.server';
import {
  agentModelDescriptor,
  resolveAgentModelConfig,
  type AgentModelConfig,
  type AgentModelDescriptor
} from './agent-model-config.server';
import {
  resolveMetricCanvasRole,
  type MetricCanvasRole
} from './identity.server';
import {
  seedPublishedPages,
  seedPublishedTemplates
} from './offline-services';
import { createMemoryAnalysisSessionStore } from './session/memory';
import {
  createSessionMetricGapLedger,
  type MetricGapLedger
} from './session/metric-gap';
import type { AnalysisSessionStore } from './session/store';
import {
  bundledDataContext,
  bundledPageModules,
  bundledTemplateModules
} from './bundled-assets.server';
const bundledPageSeeds = Object.values(bundledPageModules).map((module) => module.default);
const bundledTemplateSeeds = Object.values(bundledTemplateModules).map(
  (module) => module.default
);
/** 内置种子的内容指纹:dev 下种子 JSON 变更会重新执行本模块,指纹随之改变。 */
const seedSignature = JSON.stringify([bundledPageSeeds, bundledTemplateSeeds]);

/** Agent 运行可靠性上限(#32):超时与用量任一到达即安全停止。 */
const AGENT_RUN_TIMEOUT_MS = 120_000;
const AGENT_RUN_MAX_TOTAL_TOKENS = 200_000;

/** reader 部署唯一可见的页面生命周期 Interface。 */
type ReaderPageLifecycle = Pick<
  PageLifecycle,
  'listPages' | 'getPublished' | 'getPublishedRevision'
>;

interface CommonPlatformServices {
  runtimeOrigin: string;
}

export interface ReaderPlatformServices extends CommonPlatformServices {
  role: 'reader';
  lifecycle: ReaderPageLifecycle;
}

export interface AuthoringPlatformServices extends CommonPlatformServices {
  role: 'authoring';
  lifecycle: PageLifecycle;
  templates: TemplateLibrary;
  dataContext: DataContextSearch;
  sessions: AnalysisSessionStore;
  /** 指标需求条目台账(#67):从会话事件流聚合,合并排行 + 状态流转。 */
  metricGaps: MetricGapLedger;
  /** 进行中 Agent 运行的注册表:取消端点经由它中止运行。 */
  agentRuns: AgentRunRegistry;
  agentModel: AgentModelDescriptor;
}

type PlatformServices = ReaderPlatformServices | AuthoringPlatformServices;

interface BoundReaderPlatformServices extends ReaderPlatformServices {
  dataGateway: DataGateway & DimensionValuesGateway;
}

interface BoundAuthoringPlatformServices extends AuthoringPlatformServices {
  dataGateway: DataGateway & DimensionValuesGateway;
  createRunner(input: {
    confirmedPageIds: string[];
    runId: string;
    mode?: 'authoring' | 'lifecycle' | 'ask';
    /** 问数编排(mode=ask,#66)的人工确认与钉住状态;其余模式忽略。 */
    scopeConfirmations?: AskScopeConfirmation[];
    userDomains?: string[];
    pinnedComponents?: Array<{ dataSourceId: string; componentType: string }>;
    /** 上一轮工作副本与画布选中组件定位(mode=ask 消费)。 */
    draft?: Record<string, unknown>;
    target?: { sectionId: string; componentId: string };
  }): AgentRunner;
}

type BoundPlatformServices =
  | BoundReaderPlatformServices
  | BoundAuthoringPlatformServices;

interface PlatformServiceFactories {
  /** 请求级数据网关 adapter factory seam；actor 必须原样到达。 */
  createDataGateway?(input: {
    environment: ServerEnvironment;
    actor: LifecycleContext;
  }): DataGateway & DimensionValuesGateway;
  createAgentRunner: typeof createAgentRunner;
  createMcpConnector: typeof createRunScopedMcpConnector;
  createModelProvider(config: AgentModelConfig): ModelProvider | null;
  createRunRegistry: typeof createAgentRunRegistry;
}

const defaultFactories: PlatformServiceFactories = {
  createAgentRunner,
  createMcpConnector: createRunScopedMcpConnector,
  createModelProvider: createConfiguredModelProvider,
  createRunRegistry: createAgentRunRegistry
};

interface IdentityBinding {
  environment: ServerEnvironment;
  createDataGateway?: PlatformServiceFactories['createDataGateway'];
  bind(
    identity: LifecycleContext,
    gateway: DataGateway & DimensionValuesGateway
  ): BoundPlatformServices;
}

const identityBindings = new WeakMap<PlatformServices, IdentityBinding>();

const serviceCache = globalThis as typeof globalThis & {
  __metricCanvasPlatformServicesPromise?: Promise<PlatformServices>;
  __metricCanvasPlatformSeedSignature?: string;
  __metricCanvasPlatformModuleEpoch?: number;
};

/**
 * 本次模块执行的纪元号。dev 下改了任何服务端代码,Vite 会重新执行本模块与
 * 它的依赖,于是这个常量拿到一个新值——比对 globalThis 上记的值即可判出
 * 「缓存实例来自上一份代码」。生产只执行一次,恒等。
 */
const moduleEpoch = Date.now();

function getConfiguredPlatformServices(): Promise<PlatformServices> {
  discardStaleServices();
  serviceCache.__metricCanvasPlatformServicesPromise ??= createPlatformServices(env).catch((cause) => {
    serviceCache.__metricCanvasPlatformServicesPromise = undefined;
    throw cause;
  });
  return serviceCache.__metricCanvasPlatformServicesPromise;
}

/**
 * 保留既有零参 authoring 组合根形状。reader 部署上调用创作期入口
 * 失败关闭，无需把类型窄化扩散到所有既有 authoring 路由。
 */
export async function getPlatformServices(): Promise<AuthoringPlatformServices> {
  const services = await getConfiguredPlatformServices();
  if (services.role !== 'authoring') {
    throw new Error('reader 部署不提供创作期能力');
  }
  return services;
}

/** reader / authoring 共用的受控读取组合根，仅 runtime 与 data 入口使用。 */
export function getRuntimePlatformServices(): Promise<PlatformServices> {
  return getConfiguredPlatformServices();
}

export function bindIdentity(
  services: ReaderPlatformServices,
  identity: LifecycleContext
): BoundReaderPlatformServices;
export function bindIdentity(
  services: AuthoringPlatformServices,
  identity: LifecycleContext
): BoundAuthoringPlatformServices;
export function bindIdentity(
  services: PlatformServices,
  identity: LifecycleContext
): BoundPlatformServices;
/**
 * 请求级身份绑定的唯一入口。身份在这里烘焙进 gateway 与
 * authoring runner，DataGateway / DataContextProvider 的方法 Interface 保持不变。
 */
export function bindIdentity(
  services: PlatformServices,
  identity: LifecycleContext
): BoundPlatformServices {
  const binding = identityBindings.get(services);
  if (!binding) throw new Error('平台服务不是由 createPlatformServices 构造');
  const gateway = binding.createDataGateway
    ? binding.createDataGateway({ environment: binding.environment, actor: identity })
    : getServerDataGateway(binding.environment, identity);
  return binding.bind(identity, gateway);
}

/**
 * 实例缓存挂在 globalThis 上,模块被 dev 重新执行也活着——这保住了内存态,
 * 但也让缓存实例的闭包一直指着旧代码。两种情形必须丢弃重建:
 *
 * - **服务端代码改动**(dev):模块重新执行即纪元号变化。缓存实例是在上一份
 *   代码里构造的,它闭包里的编排、端口与模型全是旧的;不丢弃就会出现「改完
 *   代码、页面刷新过、行为却没变」——排查时几乎无从下手,因为源码是新的。
 * - **offline 种子变化**(dev + offline):播种只发生在实例创建那一刻,种子
 *   指纹变了不重建就只能读到进程启动那一刻的页面快照。
 *
 * 两者的代价相同:内存态(会话、草稿、进行中的 Agent 运行)随之清空。这个
 * 代价只在 dev 付,且比跑着旧代码便宜。
 */
function discardStaleServices(): void {
  if (!import.meta.env.DEV) return;
  const seedChanged =
    env.METRICCANVAS_OFFLINE === '1' &&
    serviceCache.__metricCanvasPlatformSeedSignature !== seedSignature;
  const codeChanged = serviceCache.__metricCanvasPlatformModuleEpoch !== moduleEpoch;
  if (!seedChanged && !codeChanged) return;
  serviceCache.__metricCanvasPlatformSeedSignature = seedSignature;
  serviceCache.__metricCanvasPlatformModuleEpoch = moduleEpoch;
  serviceCache.__metricCanvasPlatformServicesPromise = undefined;
}

export function resolvePlatformDatabaseUrl(
  environment: ServerEnvironment,
  role: MetricCanvasRole
): string {
  const authoring =
    environment.DATABASE_URL?.trim() ||
    'postgres://metriccanvas:metriccanvas@localhost:5432/metriccanvas';
  if (role === 'authoring') return authoring;
  const reader = environment.METRICCANVAS_READER_DATABASE_URL?.trim();
  if (!reader) {
    throw new Error('reader 部署必须配置 METRICCANVAS_READER_DATABASE_URL 只读账号');
  }
  return reader;
}

export async function createPlatformServices(
  environment: ServerEnvironment,
  overrides: Partial<PlatformServiceFactories> = {}
): Promise<PlatformServices> {
  const factories: PlatformServiceFactories = { ...defaultFactories, ...overrides };
  const role = resolveMetricCanvasRole(environment);
  const runtimeOrigin = environment.RUNTIME_ORIGIN ?? 'http://localhost:5173';
  const platformOrigin = environment.PLATFORM_ORIGIN ?? 'http://localhost:5174';
  const offline = environment.METRICCANVAS_OFFLINE === '1';
  const databaseUrl = resolvePlatformDatabaseUrl(environment, role);
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

  if (role === 'reader') {
    const services: ReaderPlatformServices = {
      role,
      lifecycle,
      runtimeOrigin
    };
    identityBindings.set(services, {
      environment,
      createDataGateway: factories.createDataGateway,
      bind: (_identity, dataGateway) => ({ ...services, dataGateway })
    });
    return services;
  }

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
  // 分析会话事件 + 最新检查点(ADR-0030/0058)。本轮只有内存实现,
  // offline 与 postgres 两种
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

  const agentRuns = factories.createRunRegistry();
  const agentModelConfig = resolveAgentModelConfig(environment);
  const configuredModel = factories.createModelProvider(agentModelConfig);

  // 问数编排(#66)的注入端口:结构化决策走非流式模型,无 Key 时用字面
  // 命中的确定性回退;检索与语义面投影来自同一份内置快照(#80)。
  const askModel = configuredModel
    ? createModelBackedAskModel(configuredModel)
    : createLexicalAskModel();
  const askRetrieval = createSnapshotAskRetrieval({ current: async () => snapshot });

  const services: AuthoringPlatformServices = {
    role,
    lifecycle,
    templates,
    dataContext,
    sessions,
    metricGaps,
    agentRuns,
    agentModel: agentModelDescriptor(agentModelConfig),
    runtimeOrigin
  };

  identityBindings.set(services, {
    environment,
    createDataGateway: factories.createDataGateway,
    bind(identity, dataGateway) {
      // 创作期查询执行使用已绑定 actor 的同一请求级 gateway。
      // signal 继续经 DataGateway Interface 传递，不再旁路重建丢身份的 adapter。
      const executeUnitQuery = createRunAwareUnitQueryExecutor({ gateway: dataGateway });
      const connectRunScopedMcp = factories.createMcpConnector({
        dataContext,
        lifecycle,
        templates,
        previewUrl: ({ pageId, revisionId }) =>
          `${runtimeOrigin}/pages/${pageId}?revision=${encodeURIComponent(revisionId)}`,
        executeDataRequestUnitQuery: executeUnitQuery
      });

      const bound: BoundAuthoringPlatformServices = {
        ...services,
        dataGateway,
        createRunner({
          confirmedPageIds,
          runId,
          mode = 'lifecycle',
          scopeConfirmations,
          userDomains,
          pinnedComponents,
          draft,
          target
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
                    ...(pinnedComponents === undefined ? {} : { pinnedComponents }),
                    ...(draft === undefined ? {} : { draft }),
                    ...(target === undefined ? {} : { target })
                  }
                ).run(input)
            };
          }
          return createRunScopedAgentRunner({
            connect: (signal) => connectRunScopedMcp({ identity, signal }),
            createRunner: (runClient) => {
              const client =
                mode === 'authoring' ? createAuthoringMcpClient(runClient) : runClient;
              return factories.createAgentRunner({
                model: configuredModel ?? createComponentSelectingScriptedProvider(runId),
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
        }
      };
      return bound;
    }
  });
  return services;
}

function createConfiguredModelProvider(config: AgentModelConfig): ModelProvider | null {
  return config.provider === 'deepseek'
    ? createDeepSeekModelProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl
      })
    : config.provider === 'openai-compatible'
      ? createOpenAICompatibleModelProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl
        })
      : null;
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
