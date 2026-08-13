import { DqeGatewayError } from '@metriccanvas/data-gateway';
import type {
  DataGateway,
  DataGatewayResult,
  QueryDiagnosticContext
} from '@metriccanvas/runtime';

/** 平台服务端取数入口的路由。浏览器只知道这个相对路径，不知道 DQE 端点。 */
export const PLATFORM_DATA_QUERY_PATH = '/api/data/query';

/**
 * 平台取数入口的请求契约:生效查询加可选的查询诊断上下文。
 * 诊断上下文只承载定位标识,由服务端诊断记录消费,不影响查询语义。
 */
export interface PlatformDataQueryRequest {
  query: unknown;
  diagnostics?: QueryDiagnosticContext;
}

/**
 * 平台取数入口的响应契约。成功分支复用数据网关端口的 DataGatewayResult，
 * 失败分支的 code 直接透传 DqeGatewayError.code，不另造一套运行期错误分类。
 */
export type PlatformDataQueryResponse =
  | ({ ok: true } & DataGatewayResult)
  | { ok: false; code: DqeGatewayError['code']; message: string };

export interface PlatformDataGatewayConfig {
  fetchImpl?: typeof fetch;
}

/**
 * 数据网关端口的浏览器适配器：生效查询原样提交给平台服务端取数入口，
 * 失败响应还原为 DqeGatewayError。浏览器不直连远程数据端点。
 */
export function createPlatformDataGateway(
  config: PlatformDataGatewayConfig = {}
): DataGateway {
  const { fetchImpl = fetch } = config;
  return {
    async fetchData(query, diagnosticContext) {
      let response: Response;
      try {
        response = await fetchImpl(PLATFORM_DATA_QUERY_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json;charset=utf-8' },
          credentials: 'same-origin',
          body: JSON.stringify({
            query,
            ...(diagnosticContext ? { diagnostics: diagnosticContext } : {})
          } satisfies PlatformDataQueryRequest)
        });
      } catch (cause) {
        throw new DqeGatewayError(
          'DQE_TRANSPORT_ERROR',
          `平台取数入口不可达:${String(cause)}`,
          cause
        );
      }
      const payload = await readDataQueryResponse(response);
      if (!payload.ok) {
        throw new DqeGatewayError(payload.code, payload.message);
      }
      return {
        rows: payload.rows,
        ...(payload.totalCount !== undefined ? { totalCount: payload.totalCount } : {})
      };
    },
    async fetchDimensionValues() {
      return [];
    }
  };
}

async function readDataQueryResponse(
  response: Response
): Promise<PlatformDataQueryResponse> {
  // detail 只保留状态码:非 JSON/非契约响应可能是任意上游错误页,
  // 解析错误消息也会内嵌正文片段,一律不进入错误对象。
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DqeGatewayError(
      'DQE_TRANSPORT_ERROR',
      `平台取数入口返回非 JSON 响应:${response.status}`,
      { status: response.status }
    );
  }
  if (isSuccessPayload(payload) || isFailurePayload(payload)) return payload;
  throw new DqeGatewayError(
    'DQE_TRANSPORT_ERROR',
    `平台取数入口返回非契约响应:${response.status}`,
    { status: response.status }
  );
}

function isSuccessPayload(
  payload: unknown
): payload is { ok: true } & DataGatewayResult {
  return (
    isRecord(payload) &&
    payload.ok === true &&
    Array.isArray(payload.rows) &&
    (payload.totalCount === undefined || typeof payload.totalCount === 'number')
  );
}

function isFailurePayload(
  payload: unknown
): payload is { ok: false; code: DqeGatewayError['code']; message: string } {
  return (
    isRecord(payload) &&
    payload.ok === false &&
    typeof payload.code === 'string' &&
    typeof payload.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
