import { env } from '$env/dynamic/private';
import {
  createDataContextSearch,
  type DataContextSnapshot,
  type DataContextSearch
} from '@metriccanvas/data-context';
import {
  createAgentRunner,
  createDeepSeekModelProvider,
  type AgentRunner
} from '@metriccanvas/agent-runner';
import {
  createMemoryPageLifecycle,
  createPostgresPageLifecycle,
  type DataContextProvider,
  type PageLifecycle
} from '@metriccanvas/page-lifecycle';
import {
  connectInProcessMetricCanvasMcp,
  createMetricCanvasMcpServer,
  createPageIdConfirmationMcpClient
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
import bundledDataContext from '../../../../../docs/examples/schema-metadata.example.json';

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
  dataContext: DataContextSearch;
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
  const snapshot = bundledDataContext as unknown as DataContextSnapshot;
  const dataContext = createDataContextSearch({
    current: async () => snapshot
  });
  const dataContextVersion: DataContextProvider = {
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
  if (offline) {
    await seedPublishedTemplates(
      templates,
      lifecycle,
      Object.values(bundledTemplateModules).map((module) => module.default)
    );
  }

  const mcpServer = createMetricCanvasMcpServer({
    dataContext,
    lifecycle,
    templates,
    context: () => ({ actorId: 'developer-1', clientId: 'workbench', roles: [] }),
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
    dataContext,
    agentModel: agentModelDescriptor(agentModelConfig),
    createRunner({ confirmedPageIds, runId, mode = 'lifecycle' }) {
      const client =
        mode === 'authoring' ? createAuthoringMcpClient(mcp.client) : mcp.client;
      return createAgentRunner({
        model: deepSeekModel ?? createComponentSelectingScriptedProvider(runId),
        mcp: createPageIdConfirmationMcpClient({ client, confirmedPageIds }),
        maxModelTurns: 12,
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
