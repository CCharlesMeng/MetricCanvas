/** Engine-owned lower bound for DQE requests and their enclosing read budgets. */
export const MIN_DQE_TIMEOUT_MS = 180_000;

/** Short declarations remain readable; invalid deployment values use the built-in budget. */
export function dqeTimeoutMs(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MIN_DQE_TIMEOUT_MS;
  return Math.max(MIN_DQE_TIMEOUT_MS, Math.min(value, 2_147_483_647));
}
