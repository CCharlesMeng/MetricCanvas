/**
 * AbortSignal 组合与判别的唯一声明。Agent Runner(取消 + 运行超时)与
 * 按 run 隔离的 MCP 接线(把运行信号并入查询执行的 fetch)都从这里导入,
 * 不得各写一份组合逻辑。
 */

/** 组合多个可选信号:任一中止则整体中止;全部缺省时返回 undefined。 */
export function anySignal(
  signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const present = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return AbortSignal.any(present);
}

/**
 * 中止原因判别。AbortSignal.timeout 以 TimeoutError 命名中止原因
 * (fetch 也原样抛出),与手动 abort 的 AbortError 同属中止,一并判别。
 */
const ABORT_ERROR_NAMES = new Set(['AbortError', 'TimeoutError']);

export function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof DOMException || cause instanceof Error) &&
    ABORT_ERROR_NAMES.has(cause.name)
  );
}

/**
 * 让一个进行中的 Promise 可被信号打断:信号中止时立刻以中止原因拒绝,
 * 不再等待底层执行返回。底层执行自身是否响应中止由其实现决定
 * (模型调用与查询执行的 fetch 都携带同一信号,会被真正中断);
 * 这里保证的是调用方不被一个不响应中止的执行拖住。
 */
export function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (cause) => {
        signal.removeEventListener('abort', onAbort);
        reject(cause);
      }
    );
  });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason instanceof Error || signal.reason instanceof DOMException
    ? signal.reason
    : new DOMException('运行已中止', 'AbortError');
}
