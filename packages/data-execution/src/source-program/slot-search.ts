import { flattenPageComponents, hasQueryFieldMapping, selectQuerySource, tableSlotSearchPlan, type Page, type TableComponent, type TableQueryView, type EffectiveQuery, type TableSlotSearchPlan, type DisplayInputsSnapshot } from '@metriccanvas/page/internal';
import type { FilterValues } from '../filter-values';
import type { QueryRunner } from '../query-runner';
import { composeEffectiveQuery } from '../effective-query';
import { restrictKeys } from '../paged-join/member-query';

type Search = TableQueryView['search'];
interface SlotSearchRead {
    page: Page; sourceId: string; search: Search; query: EffectiveQuery;
    conditions: FilterValues; runner: QueryRunner; scope: string; signal?: AbortSignal;
    now?: Date; displayInputs?: DisplayInputsSnapshot; filterRevision?: number;
}
const rejected = (message: string, code = 'DQE_QUERY_REJECTED'): never => { throw Object.assign(new Error(message), { code }); };

/** Main-only search remains an ordinary gateway predicate. */
export function mainTableSearch(search: Search): Search {
    return search?.data && search.data !== 'main' ? undefined : search;
}

/** Lookup receipts never replace the supplementary slot's current-page snapshot. */
export async function applyTableSlotSearch(input: SlotSearchRead): Promise<EffectiveQuery> {
    const search = input.search;
    if (!search?.data || search.data === 'main' || !search.query.trim()) return input.query;
    if (search.match !== 'equals' || search.fields.length !== 1) return rejected('跨槽搜索仅支持单字段精确匹配');
    const table = searchOwner(input.page, input.sourceId, search.data, search.fields[0]);
    const plan = tableSlotSearchPlan(input.page, table, { data: search.data, field: search.fields[0] });
    const keys = await lookupKeys(input, plan);
    input.signal?.throwIfAborted();
    const mainKey = input.query.fieldMappings[plan.key];
    if (!mainKey || !hasQueryFieldMapping(mainKey)) return rejected('当前查询分支缺少关联行键映射');
    if (!keys.length || !restrictKeys(input.query, mainKey.queryField, keys).length) input.query.matchNone = true;
    return input.query;
}

function searchOwner(page: Page, sourceId: string, slot: string, field: string): TableComponent {
    const owners = flattenPageComponents(page).filter((node): node is TableComponent => node.type === 'table' && node.data.main === sourceId);
    if (owners.length !== 1) return rejected('跨槽搜索要求主查询由一个表格独占');
    const search = owners[0].props.toolbar?.search;
    if (!search || !('options' in search) || !search.options.some(option => typeof option.field !== 'string' && option.field.data === slot && option.field.field === field)) return rejected('跨槽搜索字段未在当前表格声明');
    return owners[0];
}

function lookupQuery(input: SlotSearchRead, plan: TableSlotSearchPlan): EffectiveQuery {
    const source = structuredClone(selectQuerySource(plan.source, input.conditions));
    delete source.source.query.resultBindings;
    return composeEffectiveQuery({ now: input.now, displayInputs: input.displayInputs, filterRevision: input.filterRevision, page: input.page,
        filters: input.page.filters, dataSource: source }, input.conditions, 0, [{ field: plan.key, direction: 'asc' }], {}, { fields: [plan.field], query: input.search!.query, match: 'equals' });
}

async function lookupKeys(input: SlotSearchRead, plan: TableSlotSearchPlan): Promise<(string | number)[]> {
    const query = lookupQuery(input, plan), keys = new Set<string | number>();
    let offset = 0, expected: number | undefined;
    while (true) {
        input.signal?.throwIfAborted();
        const limit = Math.min(200, plan.maxValues - offset);
        const snapshot = await input.runner.run({ ...query, pagination: { offset, limit } }, { pageId: input.page.id, dataSourceIds: [plan.mainId, plan.sourceId] }, input.scope, input.signal);
        input.signal?.throwIfAborted();
        if (snapshot.status === 'error') return rejected(snapshot.error.message, snapshot.error.code);
        if (snapshot.status === 'loading') return rejected('跨槽搜索结果尚未就绪');
        const rows = snapshot.status === 'ready' ? snapshot.rows : [];
        expected = lookupTotal(snapshot.totalCount, expected, plan.maxValues);
        if (rows.length !== Math.min(limit, expected - offset)) return rejected('跨槽搜索返回的分页不完整', 'DQE_ROW_CONTRACT_ERROR');
        for (const row of rows) keys.add(lookupKey(row[plan.key]));
        offset += rows.length;
        if (offset === expected) return [...keys];
    }
}

function lookupTotal(total: number | undefined, previous: number | undefined, max: number): number {
    if (total === undefined || !Number.isSafeInteger(total) || total < 0) return rejected('跨槽搜索缺少准确的匹配总数', 'DQE_ROW_CONTRACT_ERROR');
    if (previous !== undefined && previous !== total) return rejected('跨槽搜索期间匹配总数变化，请重试', 'DQE_ROW_CONTRACT_ERROR');
    if (total > max) return rejected(`跨槽搜索匹配超过 ${max} 条，请缩小查询范围`);
    return total;
}

function lookupKey(value: unknown): string | number {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return rejected('跨槽搜索结果缺少有效的关联行键', 'DQE_ROW_CONTRACT_ERROR');
}
