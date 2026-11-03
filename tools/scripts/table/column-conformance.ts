import type { InvariantDefinition } from '../page-conformance-vectors';
/** Contract vectors exercise the same complete page used in Playground. */
export const columnInvariants: InvariantDefinition[] = [{id:'table-header-filter-defaults',description:'select 原始值默认筛选、字段类型与版本下限',valid:['table-header-filter-defaults','table-header-filter-defaults-query'],cases:[
    {case:'table-header-defaults-old-version',base:'table-header-filter-defaults',expect:/由 6.82 引入/,mutate:d=>{d.schemaVersion='6.80';}},
    {case:'table-header-defaults-duplicate',base:'table-header-filter-defaults',expect:/默认筛选原始值不得重复/,mutate:d=>{d.sections[1].components[0].props.columns[1].filterable.defaultValues=['pending','pending'];}},
    {case:'table-header-defaults-wrong-type',base:'table-header-filter-defaults',expect:/符合字段原始类型/,mutate:d=>{d.sections[1].components[0].props.columns[2].filterable.defaultValues=['1'];}},
    {case:'table-header-defaults-unknown-enum',base:'table-header-filter-defaults',expect:/必须存在于列枚举/,mutate:d=>{d.sections[1].components[0].props.columns[1].filterable.defaultValues=['unknown'];}},
    {case:'table-header-defaults-remote-sharing',base:'table-header-filter-defaults-query',expect:/必须独占/,mutate:d=>{const table=structuredClone(d.sections[0].components.find((component:{type:string})=>component.type==='table'));table.id='other-table';d.sections[0].components.push(table);}}
  ]},{id:'table-column-enums',description:'前端列枚举值唯一及版本下限',valid:['table-column-enums'],cases:[
    {case:'table-enums-old-version',base:'table-column-enums',expect:/表格列前端枚举/,mutate:document=>{document.schemaVersion='6.77';}},
    {case:'table-enums-duplicate-value',base:'table-column-enums',expect:/列枚举的原始值不得重复/,mutate:document=>{document.sections[0].components[0].props.columns[1].enumValues.push({value:'0',label:'重复'});}}
  ]},{
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
