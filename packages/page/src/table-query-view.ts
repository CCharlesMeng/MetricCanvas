import { z } from 'zod';
import { fieldNameZ } from './schema/primitives';

export const tableSortZ = z.object({ field: fieldNameZ, direction: z.enum(['asc', 'desc']) }).strict();
export const tablePredicateZ = z.union([
  z.object({ field: fieldNameZ, op: z.literal('in'), values: z.array(z.union([z.string(), z.number()])).min(1) }).strict(),
  z.object({ field: fieldNameZ, op: z.enum(['gte', 'lte']), value: z.number() }).strict(),
  z.object({ field: fieldNameZ, op: z.literal('dateRange'), from: z.string().optional(), to: z.string().optional() }).strict()
]);
export const tableQueryViewZ = z.object({
  pageIndex: z.int().min(0), pageSize: z.int().min(1),
  sort: z.array(tableSortZ), predicates: z.array(tablePredicateZ),
  search: z.object({ fields: z.array(fieldNameZ).min(1), query: z.string(), match: z.literal('equals').optional() }).strict()
    .refine(search => search.match !== 'equals' || search.fields.length === 1, '等值搜索只允许一个字段').optional()
}).strict();
export type TableSortRule = z.infer<typeof tableSortZ>;
export type TablePredicate = z.infer<typeof tablePredicateZ>;
export type TableQueryView = z.infer<typeof tableQueryViewZ>;
export type TableHeaderFilters = Readonly<Record<string,
  { mode: 'select'; values: readonly (string | number)[] } |
  { mode: 'dateRange'; from: string; to: string } |
  { mode: 'numberRange'; from?: number; to?: number }>>;

export function tablePredicates(filters: TableHeaderFilters): TablePredicate[] {
  return Object.entries(filters).flatMap(([field, filter]): TablePredicate[] => {
    if (filter.mode === 'select') return filter.values.length ? [{ field, op: 'in', values: [...filter.values] }] : [];
    if (filter.mode === 'dateRange') return filter.from || filter.to ? [{ field, op: 'dateRange', ...(filter.from ? { from: filter.from } : {}), ...(filter.to ? { to: filter.to } : {}) }] : [];
    return [...(filter.from === undefined ? [] : [{ field, op: 'gte' as const, value: filter.from }]),
      ...(filter.to === undefined ? [] : [{ field, op: 'lte' as const, value: filter.to }])];
  });
}
export function tableHeaders(predicates: readonly TablePredicate[]): TableHeaderFilters {
  const result: Record<string, TableHeaderFilters[string]> = {};
  for (const p of predicates) {
    if (p.op === 'in') result[p.field] = { mode: 'select', values: [...p.values] };
    else if (p.op === 'dateRange') result[p.field] = { mode: 'dateRange', from: p.from ?? '', to: p.to ?? '' };
    else {
      const old = result[p.field];
      result[p.field] = { ...(old?.mode === 'numberRange' ? old : { mode: 'numberRange' as const }), [p.op === 'gte' ? 'from' : 'to']: p.value };
    }
  }
  return result;
}
