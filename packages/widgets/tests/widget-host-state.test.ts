import { describe, expect, it } from 'vitest';
import { isWidgetHostEmptyState } from '../src/widget-host-state';

describe('isWidgetHostEmptyState', () => {
  it('把查询错误和空快照统一呈现为组件空数据状态', () => {
    expect(
      isWidgetHostEmptyState({ status: 'error', error: new Error('DQE HTTP 请求失败:404') })
    ).toBe(true);
    expect(isWidgetHostEmptyState({ status: 'empty' })).toBe(true);
  });

  it('保留加载态和就绪态的原有呈现', () => {
    expect(isWidgetHostEmptyState({ status: 'loading' })).toBe(false);
    expect(isWidgetHostEmptyState({ status: 'ready', rows: [] })).toBe(false);
  });
});
