import type { TableComponent } from '../page';
import type { TableQueryView } from './query-view';
type Search = NonNullable<TableComponent['props']['toolbar']>['search'];
/** Static options belong to the page; committed matching semantics travel with the query. */
export function tableSearchOption(search: Search, value?: string) {
    if (!search || !('options' in search))
        return undefined;
    return search.options.find(option => option.value === (value ?? search.defaultValue)) ?? search.options[0];
}
export function tableSearchValue(search: Search, query: string, value?: string): TableQueryView['search'] {
    if (!search)
        return undefined;
    if ('fields' in search)
        return { fields: [...search.fields], query };
    const option = tableSearchOption(search, value)!;
    const target = typeof option.field === 'string' ? { data: 'main', field: option.field } : option.field;
    return { fields: [target.field], query, match: 'equals', ...(target.data === 'main' ? {} : { data: target.data }) };
}
