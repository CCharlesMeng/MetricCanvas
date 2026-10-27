type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

/** Sim accepts the service's single-field order, never the invented by array. */
export function sortDqeRows<T extends Row>(rows: readonly T[], order: unknown, fields: readonly string[], compareStrings?: (a: string, b: string) => number): T[] | undefined {
  if (order === undefined) return [...rows];
  if (!record(order) || order.by !== undefined || order.orderByField !== undefined) return;
  if (order.order_by_field === undefined && order.type === undefined) return [...rows];
  if (typeof order.order_by_field !== 'string' || !fields.includes(order.order_by_field) ||
      (order.type !== 'asc' && order.type !== 'desc')) return;
  const field = order.order_by_field, direction = order.type === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => compare(left[field], right[field], direction, compareStrings));
}
function compare(a: unknown, b: unknown, direction: number, compareStrings?: (a: string, b: string) => number): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  if (!scalar(a) || !scalar(b)) return 0;
  if (typeof a === 'string' && typeof b === 'string' && compareStrings) return direction * compareStrings(a, b);
  return direction * (a < b ? -1 : a > b ? 1 : 0);
}

function scalar(value: unknown): value is string | number | boolean {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}
