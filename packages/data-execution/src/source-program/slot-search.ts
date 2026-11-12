import { canonicalizeJson, dqeDefaultSort, flattenPageComponents, hasQueryFieldMapping, type DataSnapshot, type Row, type TableQueryView } from '@metriccanvas/page/internal';
import { evaluateTableView } from '../table-view';
import { rawSnapshot } from '../snapshots';
import { EXPORT_MAX_ROWS, SourceRangeError } from './range-policy';
import { collectSearchRows, searchPlan, type SlotSearchRead, type SearchRows } from './slot-search-read';
import { searchFailure, searchKey, SLOT_SEARCH_TIMEOUT_MS } from './slot-search-batches';
export type { SlotSearchRead } from './slot-search-read';

export function mainTableSearch(search: TableQueryView['search']): TableQueryView['search'] {
  return search?.data && search.data !== 'main' ? undefined : search;
}

function defaultSort(input: SlotSearchRead) {
  const rules = dqeDefaultSort(input.query.body.dsl_list[0]);
  return rules.map(rule => {
    const field = Object.entries(input.query.fieldMappings).find(([, field]) => hasQueryFieldMapping(field) && field.queryField === rule.queryField)?.[0];
    if (!field) return searchFailure('跨槽搜索默认排序缺少字段映射');
    return { field, direction: rule.direction };
  });
}

/** Only a complete successful materialization is cached. No pending or failed read can seed another view. */
export function createTableSlotSearchReader() {
  const cache = new Map<string, { key: string; value: SearchRows }>();
  const scopes = new Map<string, { value: string; users: number }>();
  let generation = 0, serial = 0;
  return {
    clear() { generation++; cache.clear(); },
    owns(input: Pick<SlotSearchRead, 'page'>, id: string, views?: ReadonlyMap<string, TableQueryView>): boolean {
      return flattenPageComponents(input.page).some(node => node.type === 'table' && Object.values(node.data).includes(id) &&
        !!views?.get(node.data.main)?.search?.data && !!views.get(node.data.main)?.search?.query.trim());
    },
    async read(input: SlotSearchRead): Promise<SearchRows | undefined> {
      const plan = searchPlan(input);
      if (!plan) return undefined;
      const key = canonicalizeJson([input.query, plan.lookup, input.displayInputs ?? null, input.filterRevision ?? null]);
      input.signal?.throwIfAborted();
      const hit = cache.get(input.sourceId);
      if (hit?.key === key) return hit.value;
      const revision = generation, timeout = AbortSignal.timeout(SLOT_SEARCH_TIMEOUT_MS);
      const signal = AbortSignal.any([timeout, ...(input.signal ? [input.signal] : [])]);
      const operationKey = `${generation}:${key}`;
      const operation = scopes.get(operationKey) ?? { value: `${input.scope}:slot-search:${++serial}`, users: 0 };
      scopes.set(operationKey, operation); operation.users++;
      const scope = operation.value;
      try {
        const value = await collectSearchRows({ ...input, signal, scope }, plan, { rows: 0, bytes: 0, signal });
        signal.throwIfAborted();
        if (generation === revision) cache.set(input.sourceId, { key, value });
        return value;
      } catch (cause) {
        input.signal?.throwIfAborted();
        if (timeout.aborted) return searchFailure('跨槽搜索超过 180 秒，请缩小范围或重试', 'DQE_TIMEOUT');
        throw cause;
      } finally {
        if (--operation.users === 0) { scopes.delete(operationKey); input.runner.forgetScope(scope); }
      }
    }
  };
}
export type TableSlotSearchReader = ReturnType<typeof createTableSlotSearchReader>;

export function selectSearchRows(input: SlotSearchRead, data: SearchRows, complete: boolean) {
  const sort = input.view.sort.length ? input.view.sort : defaultSort(input);
  const result = evaluateTableView(data.rows, { ...input.view, sort, search: undefined }, complete);
  if (complete && result.totalCount > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
  const keys = new Set(result.rows.map(row => searchKey(row[data.plan.binding.key])));
  const snapshots = new Map<string, DataSnapshot>([[input.sourceId, rawSnapshot(result.rows, result.totalCount)]]);
  for (const [id, rows] of data.slots) {
    const selected = rows.filter(row => keys.has(searchKey(row[data.plan.binding.key])));
    snapshots.set(id, rawSnapshot(selected, selected.length));
  }
  return { snapshots, pageIndex: result.pageIndex };
}
