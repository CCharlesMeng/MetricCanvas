export interface AuthoringBridgeStateOptions {
  timeoutMs: number;
  onTimeout: () => void;
  schedule: (callback: () => void, timeoutMs: number) => unknown;
  cancel: (handle: unknown) => void;
}

export interface AuthoringBridgeState {
  frameLoaded(): void;
  runtimeReady(): void;
  reset(): void;
  dispose(): void;
  ready(): boolean;
}

/**
 * iframe 的 load 只证明 HTML 已加载，不能证明统一运行时已经启动。
 * 只有 authoring 协议的 ready 消息可以让桥接进入就绪状态。
 */
export function createAuthoringBridgeState(
  options: AuthoringBridgeStateOptions
): AuthoringBridgeState {
  let isReady = false;
  let timeoutHandle: unknown;

  function clearTimeoutHandle() {
    if (timeoutHandle === undefined) return;
    options.cancel(timeoutHandle);
    timeoutHandle = undefined;
  }

  return {
    frameLoaded() {
      if (isReady) return;
      clearTimeoutHandle();
      timeoutHandle = options.schedule(() => {
        timeoutHandle = undefined;
        if (!isReady) options.onTimeout();
      }, options.timeoutMs);
    },

    runtimeReady() {
      isReady = true;
      clearTimeoutHandle();
    },

    reset() {
      isReady = false;
      clearTimeoutHandle();
    },

    dispose() {
      clearTimeoutHandle();
    },

    ready() {
      return isReady;
    }
  };
}
