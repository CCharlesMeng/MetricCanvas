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
  createPostgresPageLifecycle,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import {
  connectInProcessMetricCanvasMcp,
  createPageIdConfirmationMcpClient,
  createMetricCanvasMcpServer
} from '@metriccanvas/mcp';
import { createComponentSelectingScriptedProvider } from './scripted-model.server';
import { createAuthoringMcpClient } from './authoring-mcp.server';

export interface PlatformServices {
  lifecycle: PageLifecycle;
  catalog: CatalogDiscovery;
  createRunner(input: {
    confirmedPageIds: string[];
    runId: string;
    mode?: 'authoring' | 'lifecycle';
  }): AgentRunner;
  runtimeOrigin: string;
}

let servicesPromise: Promise<PlatformServices> | undefined;

export function getPlatformServices(): Promise<PlatformServices> {
  servicesPromise ??= createServices().catch((cause) => {
    servicesPromise = undefined;
    throw cause;
  });
  return servicesPromise;
}

async function createServices(): Promise<PlatformServices> {
  const runtimeOrigin = env.RUNTIME_ORIGIN ?? 'http://localhost:5173';
  const platformOrigin = env.PLATFORM_ORIGIN ?? 'http://localhost:5174';
  const catalogProvider = createDataServiceSimCatalogProvider(
    env.DATA_SERVICE_URL ?? 'http://localhost:18226'
  );
  const catalog = createCatalogDiscovery(catalogProvider);
  const lifecycle = await createPostgresPageLifecycle({
    databaseUrl:
      env.DATABASE_URL ??
      'postgres://metriccanvas:metriccanvas@localhost:5432/metriccanvas',
    catalog: catalogProvider,
    urls: {
      confirmation: (requestId, token) =>
        `${platformOrigin}/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
    }
  });
  const mcpServer = createMetricCanvasMcpServer({
    catalog,
    lifecycle,
    context: () => ({ actorId: 'developer-1', clientId: 'workbench', roles: [] }),
    previewUrl: ({ pageId, revisionId }) =>
      `${runtimeOrigin}/pages/${pageId}?revision=${encodeURIComponent(revisionId)}`
  });
  const mcp = await connectInProcessMetricCanvasMcp(mcpServer);

  const deepSeekModel =
    env.AGENT_MODEL_PROVIDER === 'deepseek'
      ? createDeepSeekModelProvider({
          apiKey: requiredSecret('DEEPSEEK_API_KEY', env.DEEPSEEK_API_KEY),
          model: env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro',
          baseUrl: env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
        })
      : null;

  return {
    lifecycle,
    catalog,
    createRunner({ confirmedPageIds, runId, mode = 'lifecycle' }) {
      const client = mode === 'authoring' ? createAuthoringMcpClient(mcp.client) : mcp.client;
      return createAgentRunner({
        model: deepSeekModel ?? createComponentSelectingScriptedProvider(runId),
        mcp: createPageIdConfirmationMcpClient({
          client,
          confirmedPageIds
        }),
        maxModelTurns: 12
      });
    },
    runtimeOrigin
  };
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

function requiredSecret(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`${name} 未在服务端环境配置`);
}
