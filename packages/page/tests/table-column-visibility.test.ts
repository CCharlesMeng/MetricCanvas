import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { columnConditionPaths } from '../src/table/columns';
import { versionPolicy } from '../src/version';
const input = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/table-column-visibility.json', import.meta.url), 'utf8'));
it('accepts the observable dashboard and leaves its input intact', () => {
    const page = input(), before = structuredClone(page), result = parsePage(page);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(page).toEqual(before);
});
it.each(['5.4', '6.35', '6.59', '6.60', '6.61'])('rejects column conditions below their own capability floor: %s', version => {
    const page = input();
    page.schemaVersion = version;
    expect(parsePage(page).errors.some(error => error.path === '/sections/0/components/0/props/columns/0/visibleWhen')).toBe(true);
});
it('rejects row context on a column and unowned search fields only for opted-in tables', () => {
    const page = input(), table = page.sections[0].components[0];
    table.props.columns[0].visibleWhen = { row: 'name', op: 'eq', value: 'A' };
    expect(parsePage(page).errors.some(error => error.path.endsWith('/columns/0/visibleWhen'))).toBe(true);
    const copy = input(), props = copy.sections[0].components[0].props;
    props.toolbar.search.fields = ['id'];
    expect(parsePage(copy).errors.some(error => error.path.endsWith('/search/fields/0') && error.message.includes('已声明列'))).toBe(true);
    props.columns = [{ field: 'name' }];
    expect(parsePage(copy).ok).toBe(true);
});
it('finds nested group and expanded-template capability positions without interpreting raw data', () => {
    const document = { schemaVersion: versionPolicy.current, sections: [{ components: [{ type: 'table', props: {
                            columns: [{ kind: 'group', children: [{ field: 'a', visibleWhen: { permission: 'a' } }] }],
                            rowExpansion: { table: { columns: [{ field: 'b', visibleWhen: { permission: 'b' } }] } }
                        } }] }], dataSources: { raw: { source: { rows: [{ visibleWhen: true }] } } } };
    expect(columnConditionPaths(document)).toEqual([
        '/sections/0/components/0/props/columns/0/children/0/visibleWhen',
        '/sections/0/components/0/props/rowExpansion/table/columns/0/visibleWhen'
    ]);
});
it('requires remote ownership only for tables with column conditions', () => {
    const page = input();
    for (const [id, field] of Object.entries<Record<string, unknown>>(page.dataSources.records.fields))
        field.queryField = id;
    page.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['id', 'name', 'project', 'owner'], output_metrics: ['amount'], filter: { dims: [], metrics: [] }, order: {} }] } } };
    for (const section of page.sections) {
        const props = section.components[0].props;
        props.pagination = { mode: 'none' };
        delete props.toolbar;
    }
    expect(parsePage(page).errors.some(error => error.message.includes('独占页面数据源'))).toBe(true);
    for (const section of page.sections)
        section.components[0].props.columns = [{ field: 'name', sortable: true }];
    expect(parsePage(page).errors).toEqual([]);
});
it('rejects cross-scope private filter reads at the exact column declaration', () => {
    const page = input();
    page.filters.push({ id: 'detail-private', type: 'dimension', dimension: 'private', visible: false });
    page.detailViews = [{ id: 'private-view', mode: 'query', filters: ['detail-private'], components: [{ id: 'private-note', type: 'text', layout: { span: 12 }, props: { body: '私有作用域' } }] }];
    page.sections[0].components[0].props.columns[0].visibleWhen = { filter: 'detail-private', part: 'values', op: 'isNotEmpty' };
    expect(parsePage(page).errors).toContainEqual({ type: 'SCHEMA_ERROR', path: '/sections/0/components/0/props/columns/0/visibleWhen', message: '列条件不能读取其他作用域的私有筛选输入' });
});

it('preserves raw array indices and skips malformed nodes in capability inspection',()=>{
 const document={sections:[{components:[{type:'table',props:{columns:[null,{kind:'group',children:[false,{field:'a',visibleWhen:{permission:'read'}}]}]}}]}]};
 expect(columnConditionPaths(document)).toEqual(['/sections/0/components/0/props/columns/1/children/1/visibleWhen']);
});
