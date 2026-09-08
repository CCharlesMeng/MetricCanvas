import {
  DEFAULT_DQE_ENDPOINT,
  DqeGatewayError,
  createDqeGateway
} from '@metriccanvas/engine/dqe';
import type { DataGateway, DimensionValuesGateway } from '@metriccanvas/engine';

export const RUNTIME_CONFIG_SOURCE_KEY = '__METRICCANVAS__';

export const MISSING_RUNTIME_CONFIG_MESSAGE = '集成应用未注入运行配置';

export interface InjectedRuntimeConfig {
  dqeEndpoint: string;
  pageAssetsBaseUrl: string;
  authToken: string;
  operatorId: string;
  workspaceId: string;
}

const DQE_REQUIRED_FIELDS = [
  'dqeEndpoint',
  'authToken',
  'operatorId',
  'workspaceId'
] as const;

type SourceHolder = typeof globalThis & {
  [RUNTIME_CONFIG_SOURCE_KEY]?: InjectedRuntimeConfig | null;
};

function holder(): SourceHolder {
  return globalThis as SourceHolder;
}

function trimmedField(
  source: Partial<InjectedRuntimeConfig>,
  field: keyof InjectedRuntimeConfig
): string | undefined {
  const value = source[field];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * 每次调用现读注入源，不缓存。缺字段或未注入时返回 null。
 * 只有本模块读写注入源（ADR-0073）。
 */
export function readRuntimeConfig(): InjectedRuntimeConfig | null {
  const raw = holder()[RUNTIME_CONFIG_SOURCE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const dqeEndpoint = trimmedField(raw, 'dqeEndpoint');
  const pageAssetsBaseUrl = trimmedField(raw, 'pageAssetsBaseUrl');
  const authToken = trimmedField(raw, 'authToken');
  const operatorId = trimmedField(raw, 'operatorId');
  const workspaceId = trimmedField(raw, 'workspaceId');
  if (!dqeEndpoint || !pageAssetsBaseUrl || !authToken || !operatorId || !workspaceId) {
    return null;
  }
  return { dqeEndpoint, pageAssetsBaseUrl, authToken, operatorId, workspaceId };
}

/** 测试与本地开发入口写入注入源；生产由集成门户在加载前设置。 */
export function installRuntimeConfig(config: InjectedRuntimeConfig | null): void {
  if (config === null) {
    delete holder()[RUNTIME_CONFIG_SOURCE_KEY];
    return;
  }
  holder()[RUNTIME_CONFIG_SOURCE_KEY] = { ...config };
}

/** 仅应由本地开发入口在 DEV 下调用；已有注入时不覆盖。 */
export function installLocalDevRuntimeConfig(): void {
  if (readRuntimeConfig()) return;
  installRuntimeConfig({
    dqeEndpoint: `http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`,
    pageAssetsBaseUrl: 'http://127.0.0.1:8080/rest/cdi/pageassets/v1',
    authToken: 'local-dev',
    operatorId: 'developer-1',
    workspaceId: 'local'
  });
}

function requireDqeRuntimeConfig(): Pick<
  InjectedRuntimeConfig,
  (typeof DQE_REQUIRED_FIELDS)[number]
> {
  const config = readRuntimeConfig();
  if (!config) {
    throw new DqeGatewayError('DQE_CONFIG_ERROR', MISSING_RUNTIME_CONFIG_MESSAGE);
  }
  return config;
}

/**
 * 用注入面构造 DQE 网关。每次请求现读端点与三个身份头，
 * 不把它们快照进 createDqeGateway 的构造参数。
 */
export function createInjectedDqeGateway(
  fetchImpl: typeof fetch = fetch
): DataGateway & DimensionValuesGateway {
  return createDqeGateway({
    fetchImpl: (async (_input, init) => {
      const config = requireDqeRuntimeConfig();
      const headers = new Headers(init?.headers);
      headers.set('X-Auth-Token', config.authToken);
      headers.set('X-Operator-Id', config.operatorId);
      headers.set('X-Workspace-Id', config.workspaceId);
      return fetchImpl(config.dqeEndpoint, { ...init, headers });
    }) as typeof fetch
  });
}
