import { isQueryErrorCode, type QueryError } from '@metriccanvas/page/internal';

/** Web APIs can reject with a DOMException from the integrating application's realm. */
export function requestInterruptionCode(cause: unknown): 'DQE_CANCELLED' | 'DQE_TIMEOUT' | undefined {
  if (!cause || typeof cause !== 'object' || !('name' in cause)) return;
  if (cause.name === 'AbortError') return 'DQE_CANCELLED';
  if (cause.name === 'TimeoutError') return 'DQE_TIMEOUT';
}

/** Keep explicit gateway classifications ahead of native request interruption names. */
export function preservedQueryError(cause: unknown): QueryError {
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  return {
    code: isQueryErrorCode(code) ? code : requestInterruptionCode(cause) ?? 'UNKNOWN',
    message: cause instanceof Error ? cause.message : String(cause)
  };
}
