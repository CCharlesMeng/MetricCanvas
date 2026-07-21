import { env } from '$env/dynamic/private';
import { syncCatalog } from '@metriccanvas/data-gateway';
import {
  catalogVersionFor,
  createCatalogDiscovery,
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
import { createSingleMetricCardScriptedProvider } from './scripted-model.server';

export interface PlatformServices {
  lifecycle: PageLifecycle;
  createRunner(input: { confirmedPageIds: string[]; runId: string }): AgentRunner;
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
    context: () => ({ actorId: 'developer-1', clientId: 'workbench' }),
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
    createRunner({ confirmedPageIds, runId }) {
      return createAgentRunner({
        model: deepSeekModel ?? createSingleMetricCardScriptedProvider(runId),
        mcp: createPageIdConfirmationMcpClient({
          client: mcp.client,
          confirmedPageIds
        }),
        maxModelTurns: 12
      });
    },
    runtimeOrigin
  };
}

function createDataServiceSimCatalogProvider(baseUrl: string): CatalogProvider {
  let current: ReturnType<CatalogProvider['current']> | undefined;
  return {
    current() {
      current ??= syncCatalog({
        baseUrl,
        headers: {
          'x-operator-id': 'developer-1',
          tenantId: 'dev',
          appId: 'metriccanvas',
          cftk: 'dev'
        }
      })
        .then((snapshot) => ({ version: catalogVersionFor(snapshot), snapshot }))
        .catch((cause) => {
          current = undefined;
          throw cause;
        });
      return current;
    }
  };
}

function requiredSecret(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`${name} 未在服务端环境配置`);
}
