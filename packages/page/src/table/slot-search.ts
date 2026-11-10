import type { Page, TableComponent } from '../page';
import type { QueryDataSource } from '../data-source';
import type { FieldReference } from '../field';
import { hasQueryFieldMapping } from '../field';
import { queryLeaves } from '../query-selection';
import { MAX_QUERY_RESULT_VALUES } from '../query-result-limits';

export interface TableSlotSearchPlan {
    mainId: string;
    sourceId: string;
    source: QueryDataSource;
    field: string;
    key: string;
    maxValues: number;
}

const unavailable = (message: string): never => { throw Object.assign(new Error(message), { code: 'DQE_QUERY_REJECTED' }); };

/** A supplementary slot is searched independently; its existing key binding defines the join. */
export function tableSlotSearchPlan(page: Page, table: TableComponent, reference: Exclude<FieldReference, string>): TableSlotSearchPlan {
    const mainId = table.data.main, sourceId = table.data[reference.data];
    const main = page.dataSources[mainId], source = page.dataSources[sourceId];
    if (!sourceId || sourceId === mainId) return unavailable('跨槽搜索必须引用独立的补充数据槽');
    if (main?.source.type !== 'query' || source?.source.type !== 'query') return unavailable('跨槽精确搜索目前要求主表与补充槽均为普通查询');
    if (table.props.pagination?.mode !== 'query' || main.source.resultScope === 'complete') return unavailable('跨槽搜索要求主表使用查询分页');
    const key = table.props.rowKey;
    if (!key) return unavailable('跨槽搜索要求表格声明 rowKey');
    const mainKey = main.fields[key], sourceKey = source.fields[key], field = source.fields[reference.field];
    const mapped = mappedSlotKeys(mainKey, sourceKey);
    if (!field || field.type !== 'string' || !hasQueryFieldMapping(field)) return unavailable('跨槽搜索必须引用有 queryField 映射的文本字段');
    const bindings = queryLeaves(source.source.query).map(query => query.resultBindings);
    validateLookupWindow(source as QueryDataSource);
    if (bindings.some(items => items?.length !== 1 || items[0].source !== mainId || items[0].field !== key || items[0].target !== 'dimension' || items[0].queryField !== mapped.source || items[0].where !== undefined)) return unavailable('跨槽搜索要求补充查询仅通过主表行键声明一条无附加行条件的 resultBinding');
    return { mainId, sourceId, source: source as QueryDataSource, field: reference.field, key,
        maxValues: Math.min(...bindings.map(items => items![0].maxValues), MAX_QUERY_RESULT_VALUES) };
}

function validateLookupWindow(source: QueryDataSource): void {
    const bounded = queryLeaves(source.source.query).some(query => {
        const order = query.body.dsl_list[0].order;
        return order !== null && typeof order === 'object' && !Array.isArray(order) && order.limit !== undefined && order.offset === undefined;
    });
    if (bounded) unavailable('补充查询包含固定 TopN，不能作为跨槽全量搜索范围');
}

function mappedSlotKeys(main: QueryDataSource['fields'][string] | undefined, source: QueryDataSource['fields'][string] | undefined): { main: string; source: string } {
    if (!main || !source || !hasQueryFieldMapping(main) || !hasQueryFieldMapping(source) || main.type !== source.type || !['string', 'number'].includes(main.type)) return unavailable('跨槽搜索要求两槽具有同类型且映射到查询字段的行键');
    return { main: main.queryField, source: source.queryField };
}
