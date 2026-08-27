import { PAGE_BUILDING_PROMPT } from '@metriccanvas/mcp';
import { isAskStateMessage } from '../../ask/conversation';
import type { AskScopeConfirmation } from '../ask/orchestrator';
import type { AgentMessage } from './types';

/**
 * 页面搭建工作台 Agent 请求的唯一契约:非流式端点(/api/agent)与
 * 服务端推送端点(/api/agent/stream)共用同一份请求校验、提示词拼装
 * 与回传消息过滤,不得各写一份。
 */

export const WORKBENCH_PROMPT = `METRICCANVAS_AUTHORING_MODE

${PAGE_BUILDING_PROMPT}

当前客户端是单页页面搭建工作台。你只负责检索、生成、修改和调用 validate_page 校验未保存工作副本；不得保存页面修订、创建精确预览或申请发布租约，这些动作只能由用户点击明确的界面按钮触发。若提供了当前未保存工作副本，必须以它为基线修改，保留用户未要求改变的内容。若提供了组件定位，只把它视为默认修改目标，不得未经用户描述自动修改。生成或修改后必须调用 validate_page；校验通过后停止工具调用并简要说明调整结果。新建页面首次校验通过时，工作台会展示结构化页面 id 确认，不要用普通文本重复索取确认。`;

export const AUTHORING_CONTEXT_PREFIX = 'METRICCANVAS_AUTHORING_CONTEXT:';

/** runId / sessionId 共用的标识符约束。 */
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9-]{1,100}$/u;

/**
 * 人工确认的结构化记录(#65 接线点):页面 id 确认之外,取数核对确认与
 * 业务域改写同样以 confirmations 随下一轮请求传回,不以自由文本表达。
 */
export type WorkbenchConfirmation =
  | { kind: 'page_id'; pageId: string }
  | ({ kind: 'scope_card' } & AskScopeConfirmation)
  | { kind: 'business_domain'; domains: string[] };

export interface WorkbenchAgentRequest {
  runId: string;
  /** 关联的分析会话(可选):提供时推送通道的步骤事件按 ADR-0030 落库。 */
  sessionId?: string;
  messages: AgentMessage[];
  confirmations?: WorkbenchConfirmation[];
  draft?: Record<string, unknown>;
  target?: { sectionId: string; componentId: string };
  /** 钉住的组件形态(ADR-0037):问数编排消费,后续轮次不被自动改写。 */
  pinnedComponents?: Array<{ dataSourceId: string; componentType: string }>;
}

export function isWorkbenchAgentRequest(value: unknown): value is WorkbenchAgentRequest {
  if (typeof value !== 'object' || value === null || !('messages' in value)) return false;
  const request = value as {
    runId?: unknown;
    sessionId?: unknown;
    messages?: unknown;
    confirmations?: unknown;
    draft?: unknown;
    target?: unknown;
    pinnedComponents?: unknown;
  };
  if (typeof request.runId !== 'string' || !IDENTIFIER_PATTERN.test(request.runId)) {
    return false;
  }
  if (
    request.sessionId !== undefined &&
    (typeof request.sessionId !== 'string' || !IDENTIFIER_PATTERN.test(request.sessionId))
  ) {
    return false;
  }
  const messages = request.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) return false;
  if (
    request.confirmations !== undefined &&
    (!Array.isArray(request.confirmations) ||
      request.confirmations.length > 20 ||
      !request.confirmations.every(isConfirmation))
  ) {
    return false;
  }
  if (request.draft !== undefined && !isRecord(request.draft)) return false;
  if (
    request.target !== undefined &&
    (!isRecord(request.target) ||
      typeof request.target.sectionId !== 'string' ||
      request.target.sectionId.length === 0 ||
      typeof request.target.componentId !== 'string' ||
      request.target.componentId.length === 0)
  ) {
    return false;
  }
  if (
    request.pinnedComponents !== undefined &&
    (!Array.isArray(request.pinnedComponents) ||
      request.pinnedComponents.length > 20 ||
      !request.pinnedComponents.every(
        (pin) =>
          isRecord(pin) &&
          typeof pin.dataSourceId === 'string' &&
          pin.dataSourceId.length > 0 &&
          pin.dataSourceId.length <= 100 &&
          typeof pin.componentType === 'string' &&
          pin.componentType.length > 0 &&
          pin.componentType.length <= 100
      ))
  ) {
    return false;
  }
  return messages.every((message) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('role' in message) ||
      !('content' in message) ||
      typeof message.content !== 'string'
    ) {
      return false;
    }
    if (message.role === 'system' || message.role === 'user') return true;
    if (message.role === 'assistant') return Array.isArray((message as { toolCalls?: unknown }).toolCalls);
    return (
      message.role === 'tool' &&
      typeof (message as { toolCallId?: unknown }).toolCallId === 'string' &&
      typeof (message as { name?: unknown }).name === 'string' &&
      typeof (message as { isError?: unknown }).isError === 'boolean'
    );
  });
}

function isConfirmation(value: unknown): value is WorkbenchConfirmation {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'page_id':
      return typeof value.pageId === 'string' && value.pageId.length <= 100;
    case 'scope_card': {
      if (typeof value.interactionId !== 'string' || value.interactionId.length > 200) {
        return false;
      }
      if (value.selectedMetric === undefined) return true;
      return (
        isRecord(value.selectedMetric) &&
        typeof value.selectedMetric.businessDomain === 'string' &&
        value.selectedMetric.businessDomain.length <= 100 &&
        typeof value.selectedMetric.metricName === 'string' &&
        value.selectedMetric.metricName.length <= 200
      );
    }
    case 'business_domain':
      return (
        Array.isArray(value.domains) &&
        value.domains.length > 0 &&
        value.domains.length <= 2 &&
        value.domains.every(
          (domain) => typeof domain === 'string' && domain.length > 0 && domain.length <= 100
        )
      );
    default:
      return false;
  }
}

/** 已确认的页面 id(confirm_page_id 交互的产物)。 */
export function confirmedPageIdsOf(request: WorkbenchAgentRequest): string[] {
  return (request.confirmations ?? []).flatMap((confirmation) =>
    confirmation.kind === 'page_id' ? [confirmation.pageId] : []
  );
}

/** 取数核对确认(问数编排消费,#66)。 */
export function scopeConfirmationsOf(request: WorkbenchAgentRequest): AskScopeConfirmation[] {
  return (request.confirmations ?? []).flatMap((confirmation) =>
    confirmation.kind === 'scope_card'
      ? [
          {
            interactionId: confirmation.interactionId,
            ...(confirmation.selectedMetric === undefined
              ? {}
              : { selectedMetric: confirmation.selectedMetric })
          }
        ]
      : []
  );
}

/** 用户改写的业务域(优先于模型路由,ADR-0037);未改写时为 undefined。 */
export function userDomainsOf(request: WorkbenchAgentRequest): string[] | undefined {
  const confirmation = (request.confirmations ?? []).find(
    (entry): entry is Extract<WorkbenchConfirmation, { kind: 'business_domain' }> =>
      entry.kind === 'business_domain'
  );
  return confirmation?.domains;
}

/**
 * 拼装本次运行的完整消息序列:工作台提示词 + 创作上下文 + 用户会话。
 * 问数会话状态消息(ask/conversation.ts)是编排的会话上下文,原样保留。
 */
export function workbenchMessages(request: WorkbenchAgentRequest): AgentMessage[] {
  const conversation = request.messages.filter(
    (message) => message.role !== 'system' || isAskStateMessage(message)
  );
  return [
    { role: 'system', content: WORKBENCH_PROMPT },
    ...(request.draft
      ? [
          {
            role: 'system' as const,
            content:
              AUTHORING_CONTEXT_PREFIX +
              JSON.stringify({ document: request.draft, target: request.target ?? null })
          }
        ]
      : []),
    ...conversation
  ];
}

/** 回传客户端前滤掉创作上下文系统消息(含完整工作副本,体积大且无展示价值)。 */
export function clientMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.filter(
    (message) =>
      message.role !== 'system' || !message.content.startsWith(AUTHORING_CONTEXT_PREFIX)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
