import type { InvariantDefinition } from '../page-conformance-vectors';
/** Contract vectors exercise the same complete page used in Playground. */
export const columnInvariants: InvariantDefinition[] = [{id:'table-column-enums',description:'前端列枚举值唯一及版本下限',valid:['table-column-enums'],cases:[
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
