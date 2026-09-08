import { describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import type { FormulaTrace } from '../../src/lib/workbench/promote';
import documentFixture from './fixtures/promote.json';
import {
  buildPromotion,
  formalPageIdError,
  promotionSaveBody
} from '../../src/lib/workbench/promote-flow';

/**
 * 沉淀入口的工作台流程模型(#68):纯函数,脱离浏览器测试。
 * 改写规则本体的表驱动覆盖在 ./promote.test.ts;
 * 这里验证平台接线的决策面——方向分发、命名闸、留痕提取与保存命令翻译。
 */

const TRANSIENT_ID = 'ask-transient-8f2c3a1b';

const traces: FormulaTrace[] = [
  {
    question: '平均每单成交多少钱?',
    expression: '成交总额 / 订单数',
    referencedMetrics: ['成交总额', '订单数']
  }
];

function transientDocument(): Record<string, unknown> {
  return structuredClone(documentFixture);
}

describe('沉淀方向分发', () => {
  it('Data App 方向:换正式 id,筛选绑定原样保留,产物过 validate', () => {
    const result = buildPromotion({
      document: transientDocument(),
      direction: 'dataApp',
      pageId: 'region-gmv-overview',
      acceptAdHocDefinitions: false,
      formulaTraces: []
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validate(result.document)).toEqual([]);
    expect(result.document.id).toBe('region-gmv-overview');
    expect(JSON.stringify(result.document)).toContain('filterBindings');
    expect(result.knownLimitations.length).toBe(1);
  });

  it('报告方向:筛选绑定移除、初始行冻结,产物过 validate', () => {
    const result = buildPromotion({
      document: transientDocument(),
      direction: 'report',
      pageId: 'region-gmv-report',
      acceptAdHocDefinitions: false,
      formulaTraces: []
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validate(result.document)).toEqual([]);
    expect(JSON.stringify(result.document)).not.toContain('filterBindings');
    expect(result.frozenAt).toEqual([
      { dataSourceId: 'region-gmv', capturedAt: '2026-08-12T00:00:00+08:00' }
    ]);
  });
});

describe('正式页面 id 的平台侧命名闸', () => {
  it.each([
    { pageId: '', reason: '空输入' },
    { pageId: 'ask-transient-00000000', reason: '临时页面 id 命名规范' }
  ])('拒绝:$reason', ({ pageId }) => {
    expect(formalPageIdError(pageId)).not.toBeNull();
  });

  it('常规正式 id 放行(占位符与格式由纯函数改写裁决)', () => {
    expect(formalPageIdError('region-gmv-overview')).toBeNull();
  });
});

describe('保存命令翻译:面板显式确认 → pageIdConfirmed', () => {
  it('首个修订以 null 基线保存,确认状态随命令携带', () => {
    const document = { id: 'region-gmv-overview' };
    expect(promotionSaveBody(document, 'key-1')).toEqual({
      baseRevisionId: null,
      document,
      idempotencyKey: 'key-1',
      pageIdConfirmed: true
    });
  });
});
