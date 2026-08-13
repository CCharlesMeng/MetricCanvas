import { DqeGatewayError, isAbortError } from '@metriccanvas/data-gateway';
import { isQueryErrorCode } from '@metriccanvas/page';
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
    async fetchData(query, diagnosticContext, signal) {
      let response: Response;
      try {
        // 取消信号传递到底层网络请求:中止即断开与平台取数入口的连接。
        response = await fetchImpl(PLATFORM_DATA_QUERY_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json;charset=utf-8' },
          credentials: 'same-origin',
          body: JSON.stringify({
            query,
            ...(diagnosticContext ? { diagnostics: diagnosticContext } : {})
          } satisfies PlatformDataQueryRequest),
          ...(signal ? { signal } : {})
        });
      } catch (cause) {
        if (isAbortError(cause)) {
          throw new DqeGatewayError('DQE_CANCELLED', '取数请求已被取消');
        }
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
  } catch (cause) {
    // 读取响应正文期间被中止同属取消,不误归类为传输失败。
    if (isAbortError(cause)) {
      throw new DqeGatewayError('DQE_CANCELLED', '取数请求已被取消');
    }
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
  // code 必须落在查询错误分类封闭集内(失败关闭):集外字符串视为
  // 非契约响应,收敛为 DQE_TRANSPORT_ERROR,不让任意分类进入运行时。
  return (
    isRecord(payload) &&
    payload.ok === false &&
    isQueryErrorCode(payload.code) &&
    typeof payload.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
