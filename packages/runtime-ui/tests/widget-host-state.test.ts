import { describe, expect, it } from 'vitest';
import { renderableDataSnapshot } from '../src/widget-host-state';

describe('renderableDataSnapshot', () => {
  it('把查询错误投影为空行就绪快照，供组件保留完整样式', () => {
    expect(
      renderableDataSnapshot({
        status: 'error',
        error: new Error('DQE HTTP 请求失败:404')
      })
    ).toEqual({ status: 'ready', rows: [] });
  });

  it('把空快照投影为空行就绪快照并保留总数', () => {
    expect(renderableDataSnapshot({ status: 'empty', totalCount: 0 })).toEqual({
      status: 'ready',
      rows: [],
      totalCount: 0
    });
  });

  it('保留就绪快照，加载态不进入组件内容', () => {
    const ready = { status: 'ready' as const, rows: [{ amount: 12 }], totalCount: 1 };

    expect(renderableDataSnapshot(ready)).toBe(ready);
    expect(renderableDataSnapshot({ status: 'loading' })).toBeUndefined();
  });
});
