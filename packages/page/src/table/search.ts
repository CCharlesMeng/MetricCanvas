import type { TableComponent } from '../page';
import type { TableQueryView } from './query-view';
type Search = NonNullable<TableComponent['props']['toolbar']>['search'];
/** Static options select the field for the same contains search as a field list. */
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
    return { fields: [target.field], query, ...(target.data === 'main' ? {} : { data: target.data }) };
}
