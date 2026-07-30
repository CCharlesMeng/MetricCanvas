import { env } from '$env/dynamic/private';
import { syncCatalog } from '@metriccanvas/data-gateway';
import {
  catalogVersionFor,
  createCatalogDiscovery,
  type CatalogDiscovery,
  type CatalogProvider
} from '@metriccanvas/catalog-discovery';
import {
  createAgentRunner,
  createDeepSeekModelProvider,
  type AgentRunner
} from '@metriccanvas/agent-runner';
import {
  createMemoryPageLifecycle,
  createPostgresPageLifecycle,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import {
  createHttpDpCatalog,
  createMemoryDpCatalog,
  type DpCatalog,
  type DpMetric
} from '@metriccanvas/dp-catalog';
import {
  createMemoryMetricFulfillment,
  createPostgresMetricFulfillment,
  type MetricFulfillment
} from '@metriccanvas/metric-fulfillment';
import {
  connectInProcessMetricCanvasMcp,
  createPageIdConfirmationMcpClient,
  createMetricCanvasMcpServer
} from '@metriccanvas/mcp';
import {
  createMemoryTemplateLibrary,
  createPostgresTemplateLibrary,
  type TemplateLibrary
} from '@metriccanvas/template-library';
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
import type { CatalogSnapshot } from '@metriccanvas/page';
import bundledCatalog from '../../../../../catalog/snapshot.json';

const bundledPageModules = import.meta.glob<{ default: unknown }>(
  '../../../../../pages/*.json',
  { eager: true }
);
const bundledTemplateModules = import.meta.glob<{ default: OfflineTemplateSeed }>(
  '../../../../../templates/*.json',
  { eager: true }
);

export interface PlatformServices {
  lifecycle: PageLifecycle;
  templates: TemplateLibrary;
  catalog: CatalogDiscovery;
  dpCatalog: DpCatalog;
  metricFulfillment: MetricFulfillment;
  agentModel: AgentModelDescriptor;
  createRunner(input: {
    confirmedPageIds: string[];
    runId: string;
    mode?: 'authoring' | 'lifecycle';
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
  const catalogProvider = offline
    ? createBundledCatalogProvider()
    : createDataServiceSimCatalogProvider(
        env.DATA_SERVICE_URL ?? 'http://localhost:18226'
      );
  const catalog = createCatalogDiscovery(catalogProvider);
  const dpCatalog = offline
    ? createMemoryDpCatalog(offlineDpMetrics())
    : createHttpDpCatalog({ baseUrl: env.DP_URL ?? 'http://localhost:18227' });
  const metricFulfillment = offline
    ? createMemoryMetricFulfillment({ dpCatalog, catalog })
    : await createPostgresMetricFulfillment({
        databaseUrl,
        dpCatalog,
        catalog
      });
  const lifecycleOptions = {
    catalog: catalogProvider,
    urls: {
      confirmation: (requestId: string, token: string) =>
        `${platformOrigin}/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
    }
  };
  const lifecycle = offline
    ? await createOfflinePageLifecycle(lifecycleOptions)
    : await createPostgresPageLifecycle({
        ...lifecycleOptions,
        databaseUrl
      });
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
  if (offline) {
    await seedPublishedTemplates(
      templates,
      lifecycle,
      Object.values(bundledTemplateModules).map((module) => module.default)
    );
  }
  const mcpServer = createMetricCanvasMcpServer({
    catalog,
    dpCatalog,
    metricFulfillment,
    lifecycle,
    templates,
    context: () => ({ actorId: 'developer-1', clientId: 'workbench', roles: [] }),
    metricFulfillmentContext: () => ({
      actorId: 'developer-1',
      clientId: 'workbench'
    }),
    previewUrl: ({ pageId, revisionId }) =>
      `${runtimeOrigin}/pages/${pageId}?revision=${encodeURIComponent(revisionId)}`
  });
  const mcp = await connectInProcessMetricCanvasMcp(mcpServer);

  const agentModelConfig = resolveAgentModelConfig(env);
  const deepSeekModel =
    agentModelConfig.provider === 'deepseek'
      ? createDeepSeekModelProvider({
          apiKey: agentModelConfig.apiKey,
          model: agentModelConfig.model,
          baseUrl: agentModelConfig.baseUrl
        })
      : null;

  return {
    lifecycle,
    templates,
    catalog,
    dpCatalog,
    metricFulfillment,
    agentModel: agentModelDescriptor(agentModelConfig),
    createRunner({ confirmedPageIds, runId, mode = 'lifecycle' }) {
      const client = mode === 'authoring' ? createAuthoringMcpClient(mcp.client) : mcp.client;
      return createAgentRunner({
        model: deepSeekModel ?? createComponentSelectingScriptedProvider(runId),
        mcp: createPageIdConfirmationMcpClient({
          client,
          confirmedPageIds
        }),
        maxModelTurns: 12,
        toolCallLimits:
          mode === 'authoring'
            ? {
                search_catalog: 3,
                search_metric_candidates: 3,
                get_metric_status: 4,
                search_templates: 2,
                list_pages: 2,
                get_page: 3,
                validate_page: 4
              }
            : undefined
      });
    },
    runtimeOrigin
  };
}

function offlineDpMetrics(): DpMetric[] {
  return [
    {
      id: 'dp-metric-tokens-consumption',
      code: null,
      name: 'Tokens 消耗量',
      definition: '统计模型推理产生的输入与输出 Tokens 总量。',
      dimensions: ['office', 'model'],
      aggregations: ['sum', 'day', 'month'],
      status: 'draft',
      catalog: null,
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z'
    }
  ];
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

function createBundledCatalogProvider(): CatalogProvider {
  const snapshot = bundledCatalogSnapshot();
  const version = catalogVersionFor(snapshot);
  return { current: async () => ({ version, snapshot }) };
}

function bundledCatalogSnapshot(): CatalogSnapshot {
  if (bundledCatalog.formatVersion !== '2.0') {
    throw new Error(`不支持的内置元数据快照版本:${bundledCatalog.formatVersion}`);
  }
  return {
    ...bundledCatalog,
    formatVersion: '2.0',
    metrics: bundledCatalog.metrics.map((metric) => ({
      ...metric,
      valueType: catalogValueType(metric.valueType),
      defaultFormat: catalogFormat(metric.defaultFormat)
    })),
    dimensions: bundledCatalog.dimensions.map((dimension) => ({
      ...dimension,
      valueType: catalogDimensionValueType(dimension.valueType),
      defaultFormat: catalogFormat(dimension.defaultFormat)
    }))
  };
}

function catalogDimensionValueType(
  value: string
): CatalogSnapshot['dimensions'][number]['valueType'] {
  if (
    value === 'string' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'date' ||
    value === 'datetime'
  ) {
    return value;
  }
  throw new Error(`不支持的内置维度值类型:${value}`);
}

function catalogFormat(
  value: string
): NonNullable<CatalogSnapshot['metrics'][number]['defaultFormat']> {
  const formats = [
    'number',
    'text',
    'date',
    'number-1',
    'number-2',
    'number-grouped',
    'compact-wan-0',
    'compact-wan-1',
    'compact-yi-1',
    'percent-0',
    'percent-1',
    'percent-2',
    'percent-2-signed',
    'date-month-day'
  ] as const;
  const format = formats.find((candidate) => candidate === value);
  if (format) return format;
  throw new Error(`不支持的内置展示格式:${value}`);
}

function catalogValueType(value: string): CatalogSnapshot['metrics'][number]['valueType'] {
  if (value === 'integer' || value === 'decimal' || value === 'percent') return value;
  throw new Error(`不支持的内置指标值类型:${value}`);
}

function createDataServiceSimCatalogProvider(baseUrl: string): CatalogProvider {
  let inFlight: ReturnType<CatalogProvider['current']> | undefined;
  return {
    async current() {
      if (inFlight) return inFlight;
      const pending = syncCatalog({
        baseUrl,
        headers: {
          'x-operator-id': 'developer-1',
          tenantId: 'dev',
          appId: 'metriccanvas',
          cftk: 'dev'
        }
      }).then((snapshot) => ({ version: catalogVersionFor(snapshot), snapshot }));
      inFlight = pending;
      try {
        return await pending;
      } finally {
        if (inFlight === pending) inFlight = undefined;
      }
    }
  };
}
