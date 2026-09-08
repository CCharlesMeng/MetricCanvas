import {
  DEFAULT_DQE_ENDPOINT,
  createDataGateway,
  createDqeGateway,
  type DqeDevDetail,
  type DqeDiagnosticRecord
} from '@metriccanvas/engine/dqe';
import { createDqeDevDetail, type DqeDevDetailRecord } from './dqe-dev-detail';
import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { DataGateway, DimensionValuesGateway } from '@metriccanvas/engine';

/** 未配置 DQE_ENDPOINT 时指向本机 DQE 仿真(pnpm sim:dqe)。 */
const DQE_SIM_ORIGIN = 'http://127.0.0.1:18228';

export type ServerEnvironment = Record<string, string | undefined>;

/** DQE 端点只在服务端解析,不进浏览器产物与日志。 */
export function resolveDqeEndpoint(environment: ServerEnvironment): string {
  return environment.DQE_ENDPOINT?.trim() || `${DQE_SIM_ORIGIN}${DEFAULT_DQE_ENDPOINT}`;
}

export interface ServerDataGatewayConfig {
  environment: ServerEnvironment;
  /**
   * 请求 actor 预留位。上游 header/JWT 协议尚未裁决，此处只保证身份
   * 真实到达 adapter 构造点，不提前发明传输形式。
   */
  actor: LifecycleContext;
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
): DataGateway & DimensionValuesGateway {
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

/** 请求级数据网关 factory；不缓存 actor，不在请求间共享身份化实例。 */
export function getServerDataGateway(
  environment: ServerEnvironment,
  actor: LifecycleContext
): DataGateway & DimensionValuesGateway {
  return createServerDataGateway({ environment, actor });
}
