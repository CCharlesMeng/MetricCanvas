import type { FailureStage } from '../session/step-event';
import { DeepSeekProviderError } from './deepseek.server';
import { AgentRunnerError } from './runner';

/**
 * Agent 运行错误归一化的唯一声明:模型限流、超时、协议错误、非法工具调用、
 * 运行预算与取消全部收敛为下面的稳定分类。推送通道(step_failed 落库与
 * run_failed 下发)和非流式端点的错误响应都从这里取值,不得另写一份。
 *
 * 红线:归一化后的 message 一律使用本模块内的固定文案,只拼接结构化安全字段
 * (HTTP 状态码、工具名、上限数值),不透传底层错误文本——底层文本可能携带
 * 响应正文或凭据片段。
 */
export const AGENT_ERROR_CATEGORIES = [
  /** 模型提供方限流(HTTP 429):稍后重试即可。 */
  'MODEL_RATE_LIMITED',
  /** 模型提供方协议错误:非 429 的 HTTP 失败、响应形状非法或网络不可达。 */
  'MODEL_PROTOCOL_ERROR',
  /** 模型产出非法工具调用(参数不是合法 JSON 等)。 */
  'INVALID_TOOL_CALL',
  /** 运行超时:超过 Runner 配置的运行时限,进行中的执行已被中止。 */
  'RUN_TIMEOUT',
  /** 运行预算耗尽:最大模型轮次或 token 用量上限,重复同样输入通常再次耗尽。 */
  'RUN_BUDGET_EXCEEDED',
  /** 用户取消:不是失败,可携带既有会话状态重试。 */
  'RUN_CANCELLED',
  /** 未识别的内部错误:兜底分类,同样不透传底层文本。 */
  'AGENT_INTERNAL_ERROR'
] as const;
export type AgentErrorCategory = (typeof AGENT_ERROR_CATEGORIES)[number];

/** 归一化后的稳定错误:分类、四段失败分类、固定文案与是否值得重试。 */
export interface NormalizedAgentError {
  category: AgentErrorCategory;
  /** 失败四段分类(step-event.ts):循环层失败都发生在查询/页面生成段。 */
  stage: FailureStage;
  message: string;
  retryable: boolean;
}

const CATEGORY_TABLE: Record<
  AgentErrorCategory,
  { stage: FailureStage; retryable: boolean }
> = {
  MODEL_RATE_LIMITED: { stage: 'generation', retryable: true },
  MODEL_PROTOCOL_ERROR: { stage: 'generation', retryable: true },
  INVALID_TOOL_CALL: { stage: 'generation', retryable: true },
  RUN_TIMEOUT: { stage: 'generation', retryable: true },
  RUN_BUDGET_EXCEEDED: { stage: 'generation', retryable: false },
  RUN_CANCELLED: { stage: 'generation', retryable: true },
  AGENT_INTERNAL_ERROR: { stage: 'generation', retryable: false }
};

/** 归一化一次 Agent 运行的停机原因。任何输入都产出稳定分类,不抛出。 */
export function normalizeAgentRunError(cause: unknown): NormalizedAgentError {
  if (cause instanceof AgentRunnerError) {
    switch (cause.code) {
      case 'CANCELLED':
        return normalized('RUN_CANCELLED', '运行已被取消');
      case 'RUN_TIMEOUT':
        return normalized('RUN_TIMEOUT', '运行超时,进行中的执行已被中止');
      case 'MAX_MODEL_TURNS':
        return normalized('RUN_BUDGET_EXCEEDED', '运行达到最大模型轮次上限');
      case 'USAGE_LIMIT_EXCEEDED':
        return normalized('RUN_BUDGET_EXCEEDED', '运行达到 token 用量上限');
      case 'MODEL_FAILED':
        return normalizeModelFailure(cause.cause);
    }
  }
  return normalized('AGENT_INTERNAL_ERROR', 'Agent 运行发生未识别错误');
}

function normalizeModelFailure(cause: unknown): NormalizedAgentError {
  if (cause instanceof DeepSeekProviderError) {
    switch (cause.code) {
      case 'HTTP_ERROR':
        return cause.status === 429
          ? normalized('MODEL_RATE_LIMITED', '模型提供方限流(HTTP 429)')
          : normalized(
              'MODEL_PROTOCOL_ERROR',
              `模型提供方请求失败${cause.status !== undefined ? `(HTTP ${cause.status})` : ''}`
            );
      case 'NETWORK_ERROR':
        return normalized('MODEL_PROTOCOL_ERROR', '模型提供方不可达');
      case 'INVALID_RESPONSE':
        return normalized('MODEL_PROTOCOL_ERROR', '模型提供方响应形状非法');
      case 'INVALID_TOOL_ARGUMENTS':
        return normalized(
          'INVALID_TOOL_CALL',
          `模型产出非法工具调用${cause.toolName ? `:${cause.toolName}` : ''}`
        );
      case 'MISSING_API_KEY':
        return normalized('MODEL_PROTOCOL_ERROR', '模型提供方凭据未配置');
    }
  }
  return normalized('AGENT_INTERNAL_ERROR', '模型调用发生未识别错误');
}

function normalized(category: AgentErrorCategory, message: string): NormalizedAgentError {
  return { category, message, ...CATEGORY_TABLE[category] };
}
