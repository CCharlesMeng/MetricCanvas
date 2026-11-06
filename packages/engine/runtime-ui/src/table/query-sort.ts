import { dqeDefaultSort, selectQuerySource, type DataSource, type QueryDataSource, type TableSortRule } from '@metriccanvas/page/internal';
import type { FilterValues } from '../../../runtime/src';

/** Initial direction reflects the selected query, without changing execution or snapshot reuse. */
export function declaredQuerySort(source: DataSource, conditions: FilterValues): TableSortRule[] {
  if (source.source.type !== 'query') return [];
  try {
    const selected = selectQuerySource(source as QueryDataSource, conditions);
    return dqeDefaultSort(selected.source.query.body!.dsl_list[0]).flatMap(rule => {
      const matches = Object.entries(selected.fields).filter(([, field]) =>
        'queryField' in field && field.queryField === rule.queryField);
      return matches.length === 1 ? [{ field: matches[0]![0], direction: rule.direction }] : [];
    });
  } catch {
    // Query validation/execution owns diagnostics; the header must not invent a direction.
    return [];
  }
}
