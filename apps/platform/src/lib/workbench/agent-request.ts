import type { AgentMessage } from '../server/agent/types';

/**
 * 工作台 Agent 流式请求的客户端构造(#65)。服务端契约是
 * $lib/server/agent/workbench-request.ts 的 WorkbenchAgentRequest:
 * runId / messages / confirmations / draft;这里不复制校验逻辑,只负责
 * 把工作台的会话基线、页面 id 确认、当前工作副本与钉住状态拼成请求体。
 *
 * 钉住(ADR-0037):组件钉住属创作期状态,不进页面文档。钉住选择以
 * pinnedComponents 字段随下一轮请求传回;当前服务端契约对未知字段
 * 透传忽略,问数编排(#66)接上后由生产侧消费并保证"后续轮次不被
 * 自动改写"(recommendComponents 的钉住语义)。
 */

/** 一条钉住选择:取数单元(页面数据源)维度,一个单元对应一个组件形态。 */
export interface PinnedComponentChoice {
  dataSourceId: string;
  componentType: string;
}

/** 口径卡确认(confirm_scope_card 交互的产物);歧义候选须携带用户选择。 */
export interface ScopeCardConfirmationChoice {
  interactionId: string;
  selectedMetric?: { businessDomain: string; metricName: string };
}

export interface WorkbenchStreamRequestInput {
  runId: string;
  /** 关联的分析会话 id:提供时步骤事件按 ADR-0030 落库,可按会话 id 回放。 */
  sessionId?: string;
  /** 会话基线:上一轮 outcome.messages(如有)+ 本轮新增用户消息。 */
  messages: readonly AgentMessage[];
  /** 已确认的页面 id(confirm_page_id 交互的产物)。 */
  confirmedPageIds: readonly string[];
  /** 口径卡确认(可选):结构化记录随下一轮请求传回。 */
  scopeConfirmations?: readonly ScopeCardConfirmationChoice[];
  /** 用户改写的业务域(可选):优先于模型路由(ADR-0037 的一键改)。 */
  domainOverride?: readonly string[];
  /** 当前未保存工作副本;Agent 必须以它为基线做定向增量修改。 */
  draft: Record<string, unknown> | null;
  /** 用户钉住的组件形态,随请求传回。 */
  pinnedComponents: readonly PinnedComponentChoice[];
}

export function buildAgentStreamRequestBody(
  input: WorkbenchStreamRequestInput
): Record<string, unknown> {
  return {
    runId: input.runId,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    messages: [...input.messages],
    confirmations: [
      ...input.confirmedPageIds.map((pageId) => ({
        kind: 'page_id' as const,
        pageId
      })),
      ...(input.scopeConfirmations ?? []).map((confirmation) => ({
        kind: 'scope_card' as const,
        ...confirmation
      })),
      ...(input.domainOverride !== undefined && input.domainOverride.length > 0
        ? [{ kind: 'business_domain' as const, domains: [...input.domainOverride] }]
        : [])
    ],
    ...(input.draft ? { draft: input.draft } : {}),
    ...(input.pinnedComponents.length > 0
      ? { pinnedComponents: [...input.pinnedComponents] }
      : {})
  };
}

/** 钉住一个取数单元的组件形态;同一单元重复钉住时覆盖为最新选择。 */
export function pinComponent(
  pins: readonly PinnedComponentChoice[],
  choice: PinnedComponentChoice
): PinnedComponentChoice[] {
  return [
    ...pins.filter((pin) => pin.dataSourceId !== choice.dataSourceId),
    choice
  ];
}

/** 取消钉住。 */
export function unpinComponent(
  pins: readonly PinnedComponentChoice[],
  dataSourceId: string
): PinnedComponentChoice[] {
  return pins.filter((pin) => pin.dataSourceId !== dataSourceId);
}

/** 某取数单元当前钉住的组件形态;未钉住时为 null。 */
export function pinnedComponentType(
  pins: readonly PinnedComponentChoice[],
  dataSourceId: string
): string | null {
  return (
    pins.find((pin) => pin.dataSourceId === dataSourceId)?.componentType ?? null
  );
}
