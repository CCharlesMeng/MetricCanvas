import {
  DEFAULT_DQE_ENDPOINT,
  DqeGatewayError,
  createDqeGateway
} from '@metriccanvas/data-gateway';
import type { EffectiveQuery } from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';
import type { PlatformDataQueryResponse } from '../platform-data-gateway';

/** 未配置 DQE_ENDPOINT 时指向本机 DQE 仿真(pnpm sim:dqe)。 */
const DQE_SIM_ORIGIN = 'http://127.0.0.1:18228';

export type ServerEnvironment = Record<string, string | undefined>;

/** DQE 端点只在服务端解析,不进浏览器产物与日志。 */
export function resolveDqeEndpoint(environment: ServerEnvironment): string {
  return environment.DQE_ENDPOINT?.trim() || `${DQE_SIM_ORIGIN}${DEFAULT_DQE_ENDPOINT}`;
}

export interface ServerDataGatewayConfig {
  environment: ServerEnvironment;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

/** 服务端数据网关:端点、凭据与请求头只出现在这一层。 */
export function createServerDataGateway(
  config: ServerDataGatewayConfig
): DataGateway {
  const { environment, headers, fetchImpl } = config;
  return createDqeGateway({
    endpoint: resolveDqeEndpoint(environment),
    ...(headers ? { headers } : {}),
    ...(fetchImpl ? { fetchImpl } : {})
  });
}

let serverDataGateway: DataGateway | undefined;

/** 平台进程内的数据网关单例;首次调用按当时环境构造。 */
export function getServerDataGateway(environment: ServerEnvironment): DataGateway {
  serverDataGateway ??= createServerDataGateway({ environment });
  return serverDataGateway;
}

/**
 * 执行一次来自浏览器的生效查询。请求体是系统边界上的不可信输入,
 * 先做结构校验再交给数据网关;失败统一收敛为响应契约,
 * code 直接透传 DqeGatewayError.code。
 */
export async function executeDataQuery(
  gateway: DataGateway,
  payload: unknown
): Promise<PlatformDataQueryResponse> {
  try {
    const query = parseEffectiveQueryPayload(payload);
    const { rows, totalCount } = await gateway.fetchData(query);
    return { ok: true, rows, ...(totalCount !== undefined ? { totalCount } : {}) };
  } catch (cause) {
    if (cause instanceof DqeGatewayError) {
      return { ok: false, code: cause.code, message: cause.message };
    }
    throw cause;
  }
}

/** 请求方可修正的错误回 400,上游执行失败回 502。 */
export function dataQueryHttpStatus(response: PlatformDataQueryResponse): number {
  if (response.ok) return 200;
  return response.code === 'DQE_CONFIG_ERROR' ||
    response.code === 'DQE_FILTER_BINDING_ERROR'
    ? 400
    : 502;
}

/**
 * 生效查询的边界结构校验:只校验形状(查询定义、查询字段映射、
 * 筛选值与分页),字段级与行级契约仍由数据网关及行归一化裁决。
 */
function parseEffectiveQueryPayload(payload: unknown): EffectiveQuery {
  if (!isRecord(payload)) {
    throw invalidQuery('生效查询必须是 JSON 对象');
  }
  if (payload.language !== 'dqe') {
    throw invalidQuery('生效查询的 language 必须是 dqe');
  }
  const body = payload.body;
  if (
    !isRecord(body) ||
    !Array.isArray(body.dsl_list) ||
    body.dsl_list.length !== 1 ||
    !isRecord(body.dsl_list[0])
  ) {
    throw invalidQuery('查询定义必须包含恰好一个 DQE 查询项');
  }
  if (!isRecord(payload.fieldMappings)) {
    throw invalidQuery('生效查询必须声明查询字段映射');
  }
  if (!Array.isArray(payload.filterValues)) {
    throw invalidQuery('生效查询的 filterValues 必须是数组');
  }
  const pagination = payload.pagination;
  if (
    pagination !== undefined &&
    (!isRecord(pagination) ||
      !isNonNegativeInteger(pagination.offset) ||
      !isNonNegativeInteger(pagination.limit))
  ) {
    throw invalidQuery('查询分页必须声明非负整数 offset 与 limit');
  }
  return payload as unknown as EffectiveQuery;
}

function invalidQuery(message: string): DqeGatewayError {
  return new DqeGatewayError('DQE_CONFIG_ERROR', message);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
