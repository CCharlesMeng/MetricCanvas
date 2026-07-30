import { describe, expect, it, vi } from 'vitest';
import { createAuthoringBridgeState } from '../src/lib/authoring-bridge-state';

describe('页面搭建工作台统一运行时桥接状态', () => {
  it('iframe load 不代表统一运行时 ready，超时后报告连接失败', () => {
    let scheduled: (() => void) | undefined;
    const onTimeout = vi.fn();
    const bridge = createAuthoringBridgeState({
      timeoutMs: 5_000,
      onTimeout,
      schedule(callback) {
        scheduled = callback;
        return 1;
      },
      cancel: vi.fn()
    });

    bridge.frameLoaded();

    expect(bridge.ready()).toBe(false);
    expect(scheduled).toBeTypeOf('function');
    scheduled?.();
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('只有统一运行时 ready 消息才能使桥接就绪并取消超时', () => {
    let scheduled: (() => void) | undefined;
    const cancel = vi.fn();
    const onTimeout = vi.fn();
    const bridge = createAuthoringBridgeState({
      timeoutMs: 5_000,
      onTimeout,
      schedule(callback) {
        scheduled = callback;
        return 7;
      },
      cancel
    });

    bridge.frameLoaded();
    bridge.runtimeReady();
    scheduled?.();

    expect(bridge.ready()).toBe(true);
    expect(cancel).toHaveBeenCalledWith(7);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
