import {
  adHocDefinitionsOf,
  promoteToDataApp,
  promoteToReport,
  type PromoteResult
} from './promote';
import type { FormulaTrace } from './promote';
import { isTransientPageId } from './transient-page';

/**
 * 沉淀的纯规则与保存命令：保留方向分发、正式页面 id 确认和临时指标留痕。
 * 公共 Chat 产物接通前没有临时页面态入口；调用方须显式提供文档与留痕，
 * 不再解析旧会话消息。后续产物接线复用这些规则。
 */

export type PromoteDirection = 'dataApp' | 'report';

export interface PromotionRequest {
  /** 完整临时页面态(outcome 帧带回的已校验文档)。 */
  document: Record<string, unknown>;
  direction: PromoteDirection;
  /** 用户拟定的正式页面 id(经面板显式确认后保存)。 */
  pageId: string;
  /** Data App 方向:用户已显式接受临时指标无人负责(ADR-0036)。 */
  acceptAdHocDefinitions: boolean;
  /** 临时指标留痕:来自 ask 会话状态消息(#66),充实沉淀警告。 */
  formulaTraces: readonly FormulaTrace[];
}

/** 按方向分发纯函数改写;产物已整体通过 validate()。 */
export function buildPromotion(request: PromotionRequest): PromoteResult {
  if (request.direction === 'dataApp') {
    return promoteToDataApp({
      document: request.document,
      pageId: request.pageId,
      acceptAdHocDefinitions: request.acceptAdHocDefinitions,
      formulaTraces: request.formulaTraces
    });
  }
  return promoteToReport({
    document: request.document,
    pageId: request.pageId,
    formulaTraces: request.formulaTraces
  });
}

/**
 * 正式页面 id 的平台侧命名闸:临时页面 id 命名规范(ask-transient-*)是
 * 平台约定,不得被用作正式 id;占位符与格式合法性由纯函数改写统一裁决。
 */
export function formalPageIdError(pageId: string): string | null {
  if (pageId === '') return '请输入正式页面 id(小写字母、数字与连字符)';
  if (isTransientPageId(pageId)) {
    return '正式页面 id 不得使用临时页面 id 命名规范(ask-transient-*)';
  }
  return null;
}

/** 文档中的临时指标清单(沉淀警告内容),留痕补充问题原文。 */
export { adHocDefinitionsOf };

/** 沉淀成功的回报:工作台据此把工作副本切换到正式页面 id 与首个修订。 */
export interface PromotedOutcome {
  direction: PromoteDirection;
  pageId: string;
  document: Record<string, unknown>;
  revisionId: string;
  revisionNumber: number;
  dataContextVersion: string | null;
}

export interface PromotionSaveBody {
  baseRevisionId: null;
  document: Record<string, unknown>;
  idempotencyKey: string;
  pageIdConfirmed: true;
}

/**
 * 沉淀保存命令:首个修订(baseRevisionId 为 null),面板的显式确认翻译为
 * pageIdConfirmed。是否真为首次保存由外部 Java 页面资产服务裁决,这里不判断。
 */
export function promotionSaveBody(
  document: Record<string, unknown>,
  idempotencyKey: string
): PromotionSaveBody {
  return { baseRevisionId: null, document, idempotencyKey, pageIdConfirmed: true };
}
