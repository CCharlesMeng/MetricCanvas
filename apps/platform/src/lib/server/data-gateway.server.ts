import {
  DEFAULT_DQE_ENDPOINT,
  DqeGatewayError,
  createDataGateway,
  createDqeDevDetail,
  createDqeGateway,
  type DqeDevDetail,
  type DqeDevDetailRecord,
  type DqeDiagnosticRecord
} from '@metriccanvas/data-gateway';
import { isQueryLanguage, type EffectiveQuery } from '@metriccanvas/page';
import type { DataGateway, QueryDiagnosticContext } from '@metriccanvas/runtime';
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
  /** 查询诊断记录去向;缺省写结构化 console 日志。测试注入。 */
  diagnosticsSink?: (record: DqeDiagnosticRecord) => void;
  /** 开发期明细去向;缺省写结构化 console 日志。测试注入。 */
  devDetailSink?: (record: DqeDevDetailRecord) => void;
}

/**
 * 服务端数据网关:端点、凭据与请求头只出现在这一层。
 * 生效查询经数据网关的按 language 分发注册点路由到协议适配器
 * (ADR-0034/issue #79),当前协议闭集仅注册 dqe 适配器。
 * 每次生效查询执行落一条生产态查询诊断记录(封闭形状,不含业务数据行,
 * issue #47);开发期明细见 resolveDevDetail 的环境闸。
 */
export function createServerDataGateway(
  config: ServerDataGatewayConfig
): DataGateway {
  const { environment, headers, fetchImpl } = config;
  const diagnosticsSink =
    config.diagnosticsSink ??
    ((record: DqeDiagnosticRecord) =>
      console.info('[query-diagnostics]', JSON.stringify(record)));
  const devDetail = resolveDevDetail(environment, config.devDetailSink);
  return createDataGateway({
    dqe: createDqeGateway({
      endpoint: resolveDqeEndpoint(environment),
      ...(headers ? { headers } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
      diagnostics: { record: diagnosticsSink },
      ...(devDetail ? { devDetail } : {})
    })
  });
}

/**
 * 开发期明细的环境闸:必须显式配置 DQE_DEV_DETAIL=1,且 NODE_ENV 是
 * development(createDqeDevDetail 失败关闭)才存在这条通道;采样率由
 * DQE_DEV_DETAIL_SAMPLE_RATE 控制,缺省全采。生产环境下通道不存在,
 * 页面参数或请求内容都无法开启。
 */
function resolveDevDetail(
  environment: ServerEnvironment,
  sink: ((record: DqeDevDetailRecord) => void) | undefined
): DqeDevDetail | undefined {
  if (environment.DQE_DEV_DETAIL !== '1') return undefined;
  const sampleRate = Number.parseFloat(environment.DQE_DEV_DETAIL_SAMPLE_RATE ?? '1');
  return createDqeDevDetail({
    environment: environment.NODE_ENV ?? '',
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : 1,
    sink:
      sink ??
      ((record) => console.info('[query-dev-detail]', JSON.stringify(record)))
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
 * 请求形状:{ query: 生效查询, diagnostics?: 查询诊断上下文 }。
 * signal 承接浏览器侧中止(连接断开即中止),贯穿到上游 DQE 请求,
 * 使取消信号真正到达底层网络请求(issue #53)。
 */
export async function executeDataQuery(
  gateway: DataGateway,
  payload: unknown,
  signal?: AbortSignal
): Promise<PlatformDataQueryResponse> {
  try {
    if (!isRecord(payload)) {
      throw invalidQuery('取数请求必须是 JSON 对象');
    }
    const query = parseEffectiveQueryPayload(payload.query);
    const diagnostics = parseDiagnosticContext(payload.diagnostics);
    const { rows, totalCount } = await gateway.fetchData(query, diagnostics, signal);
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
  // language 按协议闭集失败关闭;通过后按判别分支校验形状(当前闭集仅 dqe)。
  if (!isQueryLanguage(payload.language)) {
    throw invalidQuery('生效查询的 language 不在受支持的查询协议闭集内');
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

const MAX_DIAGNOSTIC_ID_LENGTH = 256;
const MAX_DIAGNOSTIC_DATA_SOURCE_IDS = 50;

/**
 * 查询诊断上下文的边界收编:只接受格式正确的字符串标识,其余内容
 * 一律丢弃(失败关闭)——诊断上下文会进入服务端日志,不能成为任意
 * 内容进日志的通道。诊断上下文不合法不阻塞取数。
 */
function parseDiagnosticContext(
  value: unknown
): QueryDiagnosticContext | undefined {
  if (!isRecord(value)) return undefined;
  const pageId = diagnosticIdentifier(value.pageId);
  const pageRevisionId = diagnosticIdentifier(value.pageRevisionId);
  const dataSourceIds = Array.isArray(value.dataSourceIds)
    ? value.dataSourceIds
        .map(diagnosticIdentifier)
        .filter((id): id is string => id !== undefined)
        .slice(0, MAX_DIAGNOSTIC_DATA_SOURCE_IDS)
    : [];
  const context: QueryDiagnosticContext = {
    ...(pageId !== undefined ? { pageId } : {}),
    ...(pageRevisionId !== undefined ? { pageRevisionId } : {}),
    ...(dataSourceIds.length > 0 ? { dataSourceIds } : {})
  };
  return Object.keys(context).length > 0 ? context : undefined;
}

function diagnosticIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_DIAGNOSTIC_ID_LENGTH
    ? value
    : undefined;
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
