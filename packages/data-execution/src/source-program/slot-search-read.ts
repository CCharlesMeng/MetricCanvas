import { flattenPageComponents, hasQueryFieldMapping, selectQuerySource, tableSlotSearchPlan, type Page, type TableComponent, type TableQueryView, type EffectiveQuery, type TableSlotSearchPlan, type Row, type DisplayInputsSnapshot, type QueryDataSource } from '@metriccanvas/page/internal';
import type { FilterValues } from '../filter-values';
import type { QueryRunner } from '../query-runner';
import { composeEffectiveQuery } from '../effective-query';
import { restrictKeys } from '../paged-join/member-query';
import { isBusinessSelection } from './range-policy';
import { readSearchBatches, searchFailure, searchKey, type SearchBudget } from './slot-search-batches';

export interface SlotSearchRead {
  page: Page; sourceId: string; view: TableQueryView; query: EffectiveQuery;
  conditions: FilterValues; runner: QueryRunner; scope: string; signal?: AbortSignal;
  now?: Date; displayInputs?: DisplayInputsSnapshot; filterRevision?: number;
}
export type BoundSearchRead = Omit<SlotSearchRead, 'query' | 'view'>;
export interface SearchPlan { table: TableComponent; binding: TableSlotSearchPlan; lookup: EffectiveQuery }
export interface SearchRows { rows: Row[]; slots: Map<string, Row[]>; plan: SearchPlan }

export function searchPlan(input: SlotSearchRead): SearchPlan | undefined {
  const search = input.view.search;
  if (!search?.data || search.data === 'main' || !search.query.trim()) return undefined;
  if (search.match !== 'equals' || search.fields.length !== 1) return searchFailure('跨槽搜索仅支持单字段精确匹配');
  const owners = flattenPageComponents(input.page).filter((node): node is TableComponent => node.type === 'table' && node.data.main === input.sourceId);
  if (owners.length !== 1) return searchFailure('跨槽搜索要求主查询由一个表格独占');
  const table = owners[0], declared = table.props.toolbar?.search;
  if (!declared || !('options' in declared) || !declared.options.some(option => typeof option.field !== 'string' && option.field.data === search.data && option.field.field === search.fields[0])) return searchFailure('跨槽搜索字段未在当前表格声明');
  const binding = tableSlotSearchPlan(input.page, table, { data: search.data, field: search.fields[0] });
  const source = structuredClone(selectQuerySource(binding.source, input.conditions));
  delete source.source.query.resultBindings;
  // The supplementary query retains its own business conditions, never the main page's result binding.
  const lookup = composeEffectiveQuery({ ...input, filters: input.page.filters, dataSource: source }, input.conditions, 0,
    [{ field: binding.key, direction: 'asc' }], {}, { fields: [binding.field], query: search.query, match: 'equals' });
  return { table, binding, lookup };
}

async function rowsForKeys(input: BoundSearchRead, query: EffectiveQuery, keys: (string | number)[], key: string, size: number, budget: SearchBudget): Promise<Row[]> {
  const mapping = query.fieldMappings[key];
  if (!mapping || !hasQueryFieldMapping(mapping)) return searchFailure('当前查询分支缺少关联行键映射');
  const rows: Row[] = [];
  for (let offset = 0; offset < keys.length; offset += size) {
    const batch = structuredClone(query), allowed = restrictKeys(batch, mapping.queryField, keys.slice(offset, offset + size));
    if (!allowed.length) continue;
    batch.sort = [{ queryField: mapping.queryField, direction: 'asc' }];
    const found = await readSearchBatches(batch, input.runner, input.scope, budget, input.page.id, [input.sourceId]);
    const scope = new Set(allowed);
    if (found.some(row => !scope.has(searchKey(row[key])))) return searchFailure('跨槽搜索关联编号超出本批查询范围', 'DQE_ROW_CONTRACT_ERROR');
    rows.push(...found);
  }
  return rows;
}

/** Supplementary slots with the same single key binding can be filled without a >1000-value query. */
function boundSlot(input: BoundSearchRead, id: string, key: string) {
  const definition = input.page.dataSources[id];
  if (definition?.source.type !== 'query') return undefined;
  const source = selectQuerySource(definition as QueryDataSource, input.conditions), bindings = source.source.query.resultBindings;
  if (isBusinessSelection(source, false)) return undefined;
  if (bindings?.length !== 1) return undefined;
  const binding = bindings[0], field = source.fields[key];
  if (binding.source !== input.sourceId || binding.field !== key || binding.where || !field || !hasQueryFieldMapping(field) || binding.queryField !== field.queryField) return undefined;
  const query = composeEffectiveQuery({ ...input, filters: input.page.filters, dataSource: source }, input.conditions, 0, [], {});
  return { query, size: binding.maxValues };
}

export async function collectSearchRows(input: SlotSearchRead, plan: SearchPlan, budget: SearchBudget): Promise<SearchRows> {
  const lookup = await readSearchBatches(plan.lookup, input.runner, input.scope, budget, input.page.id, [input.sourceId, plan.binding.sourceId]);
  const keys = [...new Set(lookup.map(row => searchKey(row[plan.binding.key])))];
  const rows = await rowsForKeys(input, input.query, keys, plan.binding.key, plan.binding.maxValues, budget);
  const slots = new Map<string, Row[]>([[plan.binding.sourceId, lookup]]);
  const selectedKeys = [...new Set(rows.map(row => searchKey(row[plan.binding.key])))];
  for (const id of new Set(Object.values(plan.table.data))) {
    if (id === input.sourceId || slots.has(id)) continue;
    const bound = boundSlot(input, id, plan.binding.key);
    if (bound) slots.set(id, await rowsForKeys(input, bound.query, selectedKeys, plan.binding.key, bound.size, budget));
  }
  return { rows, slots, plan };
}

function exportBinding(input: BoundSearchRead, sourceId: string) {
  const owners = flattenPageComponents(input.page).filter((node): node is TableComponent => node.type === 'table' && node.data.main === input.sourceId);
  if (owners.length !== 1) return undefined;
  const table = owners[0], search = table.props.toolbar?.search;
  if (!Object.values(table.data).includes(sourceId)) return undefined;
  if (!search || !('options' in search)) return undefined;
  const option = search.options.find(option => typeof option.field !== 'string' && option.field.data !== 'main');
  if (!option || typeof option.field === 'string') return undefined;
  return tableSlotSearchPlan(input.page, table, option.field);
}

/** Complete table exports partition this supplementary binding, including when the search was cleared. */
export async function readSearchExportSlot(input: BoundSearchRead, sourceId: string, mainRows: Row[]): Promise<Row[] | undefined> {
  const plan = exportBinding(input, sourceId);
  if (!plan) return undefined;
  const bound = boundSlot(input, sourceId, plan.key);
  if (!bound) return undefined;
  const keys = [...new Set(mainRows.map(row => searchKey(row[plan.key])))];
  if (keys.length <= bound.size) return undefined;
  const signal = input.signal ?? new AbortController().signal;
  try { return await rowsForKeys(input, bound.query, keys, plan.key, bound.size, { rows: 0, bytes: 0, signal }); }
  finally { input.runner.forgetScope(input.scope); }
}
