import type { InvariantDefinition } from '../page-conformance-vectors';
/** Contract vectors exercise the same complete page used in Playground. */
export const columnInvariants: InvariantDefinition[] = [{id:'table-trend-arrows',description:'表格箭头',valid:['table-trend-arrows'],cases:[
    {case:'table-arrow-old',base:'table-trend-arrows',expect:/由 6.99 引入/,mutate:d=>{d.schemaVersion='6.98';}},
    {case:'table-arrow-text',base:'table-trend-arrows',expect:/只支持 number 或 money/,mutate:d=>{d.sections[0].components[0].props.columns[0].arrowRule={mode:'sign',positive:'down',negative:'up'};}},
    {case:'table-arrow-type',base:'table-trend-arrows',expect:/object/,mutate:d=>{d.sections[0].components[0].props.columns[1].children[0].arrowRule='yes';}},
    {case:'table-arrow-position',base:'table-trend-arrows',expect:/允许范围/,mutate:d=>{d.sections[0].components[0].props.columns[1].children[0].arrowRule.position='left';}}
  ]},{id:'table-show-select-all',description:'全选入口显式开关及静态动态候选不限意图',valid:['table-header-select-all','table-header-select-all-query'],cases:[
    {case:'table-select-all-old-version',base:'table-header-select-all',expect:/由 6.98 引入/,mutate:d=>{d.schemaVersion='6.97';}},
    {case:'table-select-all-wrong-type',base:'table-header-select-all',expect:/boolean/,mutate:d=>{d.sections[0].components[0].props.columns[1].filterable.showSelectAll='yes';}},
    {case:'table-select-all-range-mode',base:'table-header-select-all',expect:/showSelectAll/,mutate:d=>{d.sections[0].components[0].props.columns[1].filterable={mode:'numberRange',showSelectAll:true};}}
  ]},{id:'table-header-param-initialization',description:'字符串维度参数一次初始化及显式全选语义',valid:['table-header-filter-defaults','table-header-filter-defaults-query','table-header-filter-param-source'],cases:[
    {case:'table-header-param-old-version',base:'table-header-filter-defaults-query',expect:/由 6.85 引入/,mutate:d=>{d.schemaVersion='6.84';}},
    {case:'table-header-param-unknown',base:'table-header-filter-defaults-query',expect:/引用 params.query.dimensions/,mutate:d=>{d.sections[1].components[0].props.columns[2].filterable.initialParam='missing';}},
    {case:'table-header-param-conflicting-default',base:'table-header-filter-defaults-query',expect:/互斥/,mutate:d=>{d.sections[1].components[0].props.columns[2].filterable.defaultValues=['东区'];}},
    {case:'table-header-param-no-enum',base:'table-header-filter-defaults-query',expect:/全选不限必须声明/,mutate:d=>{delete d.sections[1].components[0].props.columns[2].enumValues;}},
    {case:'table-header-param-wrong-target',base:'table-header-filter-defaults-query',expect:/dim_name 必须与查询目标一致/,mutate:d=>{d.params.query.dimensions[0].dim_name='wrong';}},
    {case:'table-header-param-wrong-type',base:'table-header-filter-defaults-query',expect:/只支持字符串维度列/,mutate:d=>{d.sections[1].components[0].props.columns[2].field='amount';}},
    {case:'table-header-param-unknown-value',base:'table-header-filter-defaults-query',expect:/必须存在于列枚举/,mutate:d=>{d.params.query.dimensions[0].dim_value_list=['unknown'];}},
    {case:'table-header-param-fixed-control',base:'table-header-filter-defaults-query',expect:/不得永久约束/,mutate:d=>{d.dataSources['param-records'].source.query.paramBindings={'region-input':{target:'dimension',queryField:'区域'}};}}
  ]},{id:'table-header-filter-defaults',description:'select 原始值默认筛选、字段类型与版本下限',valid:['table-header-filter-defaults','table-header-filter-defaults-query'],cases:[
    {case:'table-header-defaults-old-version',base:'table-header-filter-defaults',expect:/由 6.82 引入/,mutate:d=>{d.schemaVersion='6.80';}},
    {case:'table-header-defaults-duplicate',base:'table-header-filter-defaults',expect:/默认筛选原始值不得重复/,mutate:d=>{d.sections[2].components[0].props.columns[1].filterable.defaultValues=['pending','pending'];}},
    {case:'table-header-defaults-wrong-type',base:'table-header-filter-defaults',expect:/符合字段原始类型/,mutate:d=>{d.sections[2].components[0].props.columns[2].filterable.defaultValues=['1'];}},
    {case:'table-header-defaults-unknown-enum',base:'table-header-filter-defaults',expect:/必须存在于列枚举/,mutate:d=>{d.sections[2].components[0].props.columns[1].filterable.defaultValues=['unknown'];}},
    {case:'table-header-defaults-remote-sharing',base:'table-header-filter-defaults-query',expect:/必须独占/,mutate:d=>{const table=structuredClone(d.sections[2].components.find((component:{type:string})=>component.type==='table'));table.id='other-table';d.sections[2].components.push(table);}}
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
