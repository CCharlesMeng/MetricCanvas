import type { InvariantDefinition } from '../page-conformance-vectors';
/** Contract vectors exercise the same complete page used in Playground. */
export const columnInvariants: InvariantDefinition[] = [{
        id: 'table-column-visibility', description: '列显隐条件与版本下限', valid: ['table-column-visibility'],
        cases: [
            { case: 'table-column-old-version', base: 'table-column-visibility', expect: /表格字段列及分组列条件显隐/,
                mutate: document => { document.schemaVersion = '6.59'; } },
            { case: 'table-column-row-context', base: 'table-column-visibility', expect: /缺少行上下文/,
                mutate: document => { document.sections[0].components[0].props.columns[0].visibleWhen = { row: 'name', op: 'isNotNull' }; } }
        ]
    }, {
        id: 'table-column-search-fields', description: '列搜索须关联主、次或徽标字段', valid: ['table-column-visibility'],
        cases: [{ case: 'table-column-unowned-search', base: 'table-column-visibility', expect: /搜索字段必须属于已声明列/,
                mutate: document => { document.sections[0].components[0].props.toolbar.search.fields = ['id']; } }]
    }];
