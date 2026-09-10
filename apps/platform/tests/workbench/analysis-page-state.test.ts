import { describe, expect, it } from 'vitest';
import type { PageDocument } from '@metriccanvas/page';
import { createAnalysisPageState } from '../../src/lib/workbench/analysis-page-state';

function page(id: string): PageDocument {
  return {
    schemaVersion: '6.0', id, dataSources: {},
    sections: [{
      id: 'main', title: '分析', container: 'panel',
      components: [{ id: 'summary', type: 'text', layout: { span: 12 }, props: { title: '结论', body: id } }]
    }]
  };
}

function withPreviousPage() {
  const state = createAnalysisPageState();
  expect(state.acceptVerifiedPage(state.begin(), page('previous'))).toBe('accepted');
  return state;
}

describe('分析页面的本地接收状态', () => {
  it.each(['text', 'failed', 'cancelled', 'waiting'] as const)('%s 保留旧页，拒绝该轮迟到产物', (outcome) => {
    const state = withPreviousPage();
    const handle = state.begin();
    expect(state.snapshot()).toMatchObject({ phase: 'processing', previousPage: true, document: { id: 'previous' } });
    if (outcome === 'waiting') state.waitForConfirmation(handle);
    else if (outcome === 'cancelled') state.cancel(handle);
    else state.finishWithoutPage(handle, outcome);
    expect(state.acceptVerifiedPage(handle, page('late'))).toBe('stale');
    expect(state.snapshot()).toMatchObject({ phase: outcome, previousPage: true, document: { id: 'previous' } });
  });

  it('无旧页时文本答复不会制造页面', () => {
    const state = createAnalysisPageState();
    state.finishWithoutPage(state.begin(), 'text');
    expect(state.snapshot()).toEqual({ document: null, phase: 'text', previousPage: false });
  });

  it('新轮先完成后，旧轮的产物与失败都不能覆盖它', () => {
    const state = withPreviousPage();
    const old = state.begin();
    const current = state.begin();
    expect(state.acceptVerifiedPage(old, page('late'))).toBe('stale');
    expect(state.acceptVerifiedPage(current, page('current'))).toBe('accepted');
    expect(state.finishWithoutPage(old, 'failed')).toBe(false);
    expect(state.acceptVerifiedPage(old, page('late'))).toBe('stale');
    expect(state.snapshot()).toMatchObject({ phase: 'page', previousPage: false, document: { id: 'current' } });
  });

  it('确认后的新轮可更新页面，等待轮与重复交付不能再次更新', () => {
    const state = withPreviousPage();
    const question = state.begin();
    state.waitForConfirmation(question);
    const response = state.begin();
    expect(state.acceptVerifiedPage(question, page('unconfirmed'))).toBe('stale');
    expect(state.acceptVerifiedPage(response, page('confirmed'))).toBe('accepted');
    expect(state.acceptVerifiedPage(response, page('duplicate'))).toBe('stale');
    expect(state.snapshot().document?.id).toBe('confirmed');
  });

  it('显式清空或切换会话使旧结果失效，包括新会话已开始的情况', () => {
    const state = withPreviousPage();
    const old = state.begin();
    state.reset();
    expect(state.snapshot()).toEqual({ document: null, phase: 'idle', previousPage: false });
    const current = state.begin();
    expect(state.acceptVerifiedPage(old, page('old-session'))).toBe('stale');
    expect(state.cancel(old)).toBe(false);
    expect(state.acceptVerifiedPage(current, page('new-session'))).toBe('accepted');
  });

  it('无效页面保留旧页，不能借已有 TypeScript 类型绕过协议校验', () => {
    const state = withPreviousPage();
    const handle = state.begin();
    const invalid = page('invalid');
    invalid.sections = [];
    expect(state.acceptVerifiedPage(handle, invalid)).toBe('invalid');
    expect(state.snapshot()).toMatchObject({ previousPage: true, document: { id: 'previous' } });
    state.finishWithoutPage(handle, 'failed');
    expect(state.snapshot().phase).toBe('failed');
  });

  it('外部修改输入或读取快照不会改变已接受页面', () => {
    const state = createAnalysisPageState();
    const document = page('original');
    state.acceptVerifiedPage(state.begin(), document);
    document.id = 'mutated-input';
    const snapshot = state.snapshot();
    if (!snapshot.document) throw new Error('应有页面');
    snapshot.document.id = 'mutated-snapshot';
    expect(state.snapshot().document?.id).toBe('original');
  });

  it('不同控制器的轮次不可混用', () => {
    const first = createAnalysisPageState();
    const second = createAnalysisPageState();
    second.begin();
    expect(second.acceptVerifiedPage(first.begin(), page('foreign'))).toBe('stale');
    expect(second.snapshot().document).toBeNull();
  });
});
