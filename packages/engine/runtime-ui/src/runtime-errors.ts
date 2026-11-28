import { debugWarn, preservedQueryError } from '@metriccanvas/data-execution/runtime';
import type { TypedError } from '@metriccanvas/page';

function extractDqeErrorCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
  if (code?.startsWith('DQE_')) return code;
  if ('name' in cause && cause.name === 'DqeGatewayError') return code ?? 'DQE_EXECUTION_ERROR';
  return undefined;
}

/**
 * Classify a runtime initialization, async finalization, or data-context failure.
 * - DQE gateway errors (`DqeGatewayError` or `code` starting with `DQE_`) -> `DQE_EXECUTION_ERROR`
 *   with preserved diagnostic message and `debugWarn` log.
 * - All other runtime context / initialization failures -> `DATA_CONTEXT_ERROR`
 *   (distinct from static document `SCHEMA_ERROR`) with `debugWarn` log.
 */
export function classifyRuntimeError(
  cause: unknown,
  path: string,
  fallbackMessage: string,
): TypedError {
  const dqeCode = extractDqeErrorCode(cause);
  if (dqeCode) {
    const preserved = preservedQueryError(cause, fallbackMessage);
    const message =
      preserved.message && preserved.message !== fallbackMessage
        ? `${fallbackMessage}（${dqeCode}: ${preserved.message}）`
        : `${fallbackMessage}（${dqeCode}）`;
    debugWarn(`[MetricCanvas][DQE_EXECUTION_ERROR] ${path}: ${fallbackMessage}`, {
      code: dqeCode,
      cause,
    });
    return { type: 'DQE_EXECUTION_ERROR', path, message };
  }
  debugWarn(`[MetricCanvas][DATA_CONTEXT_ERROR] ${path}: ${fallbackMessage}`, { cause });
  return { type: 'DATA_CONTEXT_ERROR', path, message: fallbackMessage };
}

/** Log a caught runtime fallback error via `debugWarn` so failures are never silently swallowed. */
export function warnRuntimeFallback(scope: string, message: string, cause: unknown): void {
  debugWarn(`[MetricCanvas][${scope}] ${message}`, { cause });
}
