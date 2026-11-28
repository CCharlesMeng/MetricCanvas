import { isQueryErrorCode, type QueryError } from '@metriccanvas/page/internal';

/** Web APIs can reject with a DOMException from the integrating application's realm. */
export function requestInterruptionCode(
  cause: unknown,
): 'DQE_CANCELLED' | 'DQE_TIMEOUT' | undefined {
  if (!cause || typeof cause !== 'object' || !('name' in cause)) return;
  if (cause.name === 'AbortError') return 'DQE_CANCELLED';
  if (cause.name === 'TimeoutError') return 'DQE_TIMEOUT';
}

function extractErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (
    cause &&
    typeof cause === 'object' &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return cause.message;
  }
  return cause == null ? '' : String(cause);
}

/** Keep explicit gateway classifications ahead of native request interruption names. */
export function preservedQueryError(cause: unknown, fallbackMessage?: string): QueryError {
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  const rawMessage = extractErrorMessage(cause);
  const message = rawMessage.trim()
    ? rawMessage
    : (fallbackMessage ?? (cause instanceof Error ? cause.message : String(cause)));
  return {
    code: isQueryErrorCode(code) ? code : (requestInterruptionCode(cause) ?? 'UNKNOWN'),
    message,
  };
}
