/**
 * 页面校验 conformance 向量的定义（ADR-0062）。
 *
 * 每条不变式登记：它在哪些合法样例里被实际行使（正例），以及若干从合法样例出发的
 * 单点破坏（反例）。反例的 `expected` 由 TypeScript 校验器产出，Java 校验器必须在同一
 * 输入上给出逐条相同的 `type/path/message`。`expect` 是每个反例的自检：破坏后至少有
 * 一条错误命中它，防止反例因为别的原因失败而被误记为覆盖。
 *
 * 结构错误由 ajv 产出，这里也登记少量结构反例，用来钉住 Java 侧对 ajv 文案与顺序的复现。
 */

import { versionPolicy } from '../../packages/page/src/version.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

/** 恰好领先当前次版本一位；写死的版本号会在每次次版本递增时失效。 */
const minorAheadOfCurrent = `${versionPolicy.major}.${versionPolicy.minor + 1}`;

export interface ConformanceCase {
  case: string;
  base: string;
  expect: RegExp;
  mutate(document: Doc): void;
}

export interface InvariantDefinition {
  id: string;
  description: string;
  valid: string[];
  cases: ConformanceCase[];
}

const ALL_VALID = [
  'inline-report',
  'mixed-page',
  'query-dashboard',
  'filters-page',
  'compute-page',
  'grouped-fields-page',
  'params-page',
  'composite-page',
  'map-page',
  'forecast-page',
  'url-navigation-page'
];

function firstComponent(document: Doc, section = 0, index = 0): Doc {
  return document.sections[section].components[index];
}

function longString(length: number): string {
  return 'x'.repeat(length);
}

export const invariants: InvariantDefinition[] = [
  {id:'currency-range-presets',description:'6.46单位case内的币种预设保持单一金额状态',valid:['ioc-header-currency'],cases:[
    {case:'currency-presets-version',base:'ioc-header-currency',expect:/由 6.46 引入/,mutate:d=>{d.schemaVersion='6.45';}},
    {case:'currency-presets-missing',base:'ioc-header-currency',expect:/覆盖全部/,mutate:d=>{delete d.filters[1].units.cases.USD.presets;}},
    {case:'currency-presets-shared',base:'ioc-header-currency',expect:/不能与公共/,mutate:d=>{d.filters[1].presets=[{id:'all',label:'全部',range:{}}];}},
    {case:'currency-presets-invalid',base:'ioc-header-currency',expect:/不符合约束/,mutate:d=>{d.filters[1].units.cases.USD.presets[1].range={from:10,to:10};}}
  ]},
  {id:'independent-filter-candidates',description:'6.46显式无依赖候选使用V2及局部门禁',valid:['ioc-header-business','ioc-header-unconfigured'],cases:[
    {case:'independent-candidates-version',base:'ioc-header-business',expect:/由 6.46 引入/,mutate:d=>{d.schemaVersion='6.45';}}
  ]},
  {id:'required-multiple-selection',description:'6.46必选多选保持非空离散集合',valid:['ioc-header-months'],cases:[
    {case:'required-multiple-version',base:'ioc-header-months',expect:/由 6.46 引入/,mutate:d=>{d.schemaVersion='6.45';}},
    {case:'required-multiple-empty',base:'ioc-header-months',expect:/至少选择一个/,mutate:d=>{d.filters[0].default=[];}}
  ]},
  {id:'unified-page-header',description:'6.41 唯一页头及自然年选择',valid:['unified-year-header','unified-overflow-header'],cases:[
    {case:'unified-header-version',base:'unified-year-header',expect:/由 6.41 引入/,mutate:d=>{d.schemaVersion='6.40';}},
    {case:'unified-header-conflict',base:'unified-year-header',expect:/显式关闭/,mutate:d=>{d.dashboardToolbar='visible';}},
    {case:'period-modes-empty',base:'unified-year-header',expect:/./,mutate:d=>{d.filters[0].periodModes=[];}},
    {case:'period-modes-duplicate',base:'unified-year-header',expect:/不能重复/,mutate:d=>{d.filters[0].periodModes=['year','year'];}},
    {case:'period-modes-default',base:'unified-year-header',expect:/默认期间模式必须/,mutate:d=>{d.filters[0].default={mode:'month'};}},
    {case:'period-modes-plain-range',base:'unified-year-header',expect:/display=period/,mutate:d=>{delete d.filters[0].display;d.filters[0].default={from:'2025-01-01',to:'2025-12-31'};}}
  ]},
  {id:'conditional-presentation',description:'6.35共用展示条件、稳定目标和本地行边界',valid:['page-visibility-region-linkage','page-visibility-inputs','page-visibility-report','reference-conditions-page'],cases:[
    {case:'condition-before-6.35',base:'page-visibility-region-linkage',expect:/由 6.35 引入/,mutate:d=>{d.schemaVersion='6.34';}},
    {case:'condition-row-outside-table',base:'page-visibility-region-linkage',expect:/缺少行上下文/,mutate:d=>{d.sections[1].visibleWhen={row:'kind',op:'eq',value:'department'};}},
    {case:'condition-level-set-unknown',base:'page-visibility-region-linkage',expect:/未声明的层级/,mutate:d=>{d.sections[1].visibleWhen={filter:'organization',part:'level',op:'in',values:['department','unknown']};}},
    {case:'condition-filter-unknown',base:'page-visibility-region-linkage',expect:/不存在的来源/,mutate:d=>{d.sections[1].visibleWhen={filter:'unknown',part:'value',op:'eq',value:true};}},
    {case:'condition-mixed-literals',base:'page-visibility-region-linkage',expect:/类型不匹配/,mutate:d=>{d.sections[1].visibleWhen={filter:'organization',part:'values',op:'containsAny',values:['department',1]};}},
    {case:'condition-depth-limit',base:'page-visibility-region-linkage',expect:/超过4层/,mutate:d=>{let rule=d.sections[1].visibleWhen;for(let i=0;i<5;i++)rule={not:rule};d.sections[1].visibleWhen=rule;}},
    {case:'condition-part-duplicate',base:'page-visibility-region-linkage',expect:/片段id必须唯一/,mutate:d=>{const c=d.sections.flatMap((s:Doc)=>s.components).find((c:Doc)=>c.type==='text'&&c.props.parts);c.props.parts.push(structuredClone(c.props.parts[0]));}},
    {case:'condition-row-key-required',base:'page-visibility-region-linkage',expect:/稳定rowKey/,mutate:d=>{const c=d.sections.flatMap((s:Doc)=>s.components).find((c:Doc)=>c.id==='projected-table');delete c.props.rowKey;}}
  ]},
  {id:'metric-card-before',description:'6.34 Dashboard 顶层指标卡前置文字、受控间距与整组跨度',valid:['metric-card-equation'],cases:[
    {case:'metric-before-version',base:'metric-card-equation',expect:/由 6.34 引入/,mutate:d=>{d.schemaVersion='6.33';}},
    {case:'metric-before-report',base:'metric-card-equation',expect:/before 仅支持 Dashboard/,mutate:d=>{d.layout='report';}},
    {case:'metric-before-tracks',base:'metric-card-equation',expect:/默认 12 列/,mutate:d=>{d.sections[1].columnTracks=[1,1,1,1];}},
    {case:'metric-before-span',base:'metric-card-equation',expect:/span 之和不能超过 12/,mutate:d=>{d.sections[1].components[0].layout.span=4;}},
    {case:'metric-before-empty',base:'metric-card-equation',expect:/非空连接文字/,mutate:d=>{d.sections[1].components[1].layout.before.text=' ';}},
    {case:'metric-before-gap',base:'metric-card-equation',expect:/允许范围/,mutate:d=>{d.sections[1].components[1].layout.before.gap=7;}},
    {case:'metric-before-nested',base:'metric-card-equation',expect:/顶层指标卡/,mutate:d=>{d.sections[1].components=[{id:'nested',type:'compositeCard',layout:{span:12},props:{components:d.sections[1].components}}];}}
  ]},
  {id:'tab-url-initialization',description:'6.33 Tab 显式 URL 初值与页面输入名称互斥',valid:['tab-url-initialization','tab-url-source'],cases:[
    {case:'tab-url-before-6.33',base:'tab-url-initialization',expect:/由 6.33 引入/,mutate:d=>{d.schemaVersion='6.32';}},
    {case:'tab-url-empty-key',base:'tab-url-initialization',expect:/initialTabUrlParam/,mutate:d=>{firstComponent(d).props.initialTabUrlParam='';}},
    {case:'tab-url-duplicate-key',base:'tab-url-initialization',expect:/URL 参数名重复:sales-tab/,mutate:d=>{firstComponent(d,0,1).props.initialTabUrlParam='sales-tab';}},
    {case:'tab-url-filter-conflict',base:'tab-url-initialization',expect:/URL 参数名重复:sales-tab/,mutate:d=>{d.filters=[{id:'sales-tab',type:'search'}];}},
    {case:'tab-url-param-conflict',base:'tab-url-initialization',expect:/URL 参数名重复:sales-tab/,mutate:d=>{d.params={display:[{id:'sales-tab',type:'string',value:'detail'}]};firstComponent(d).props.title={param:'sales-tab'};}}
  ]},
  {id:'chart-echarts-option',description:'6.32 三图高级呈现 JSON、保护数据结构、系列和轴补丁边界',valid:['chart-echarts-option-page'],cases:[
    {case:'chart-option-before-6.32',base:'chart-echarts-option-page',expect:/由 6.32 引入/,mutate:d=>{d.schemaVersion='6.31';}},
    {case:'chart-option-legacy-version',base:'chart-echarts-option-page',expect:/5.x 只读文档不能声明/,mutate:d=>{d.schemaVersion='5.4';}},
    {case:'chart-option-html-template',base:'chart-echarts-option-page',expect:/不接受 HTML 标记/,mutate:d=>{d.sections[0].components[1].props.echartsOption.tooltip={formatter:'<b>{c}</b>'};}},
    {case:'chart-option-css-fragment',base:'chart-echarts-option-page',expect:/CSS 声明片段/,mutate:d=>{d.sections[0].components[1].props.echartsOption.textStyle={fontFamily:'Arial;position:fixed'};}},
    {case:'chart-option-data-protected',base:'chart-echarts-option-page',expect:/禁止覆盖/,mutate:d=>{d.sections[0].components[1].props.echartsOption.series[0].data=[99];}},
    {case:'chart-option-series-overflow',base:'chart-echarts-option-page',expect:/补丁越界/,mutate:d=>{d.sections[0].components[1].props.echartsOption.series.push({});}},
    {case:'chart-option-wrapper-forbidden',base:'chart-echarts-option-page',expect:/不支持的 ECharts 根入口/,mutate:d=>{d.sections[0].components[1].props.echartsOption.media=[];}},
    {case:'chart-option-other-component',base:'chart-echarts-option-page',expect:/只支持/,mutate:d=>{d.sections[0].components[0].props.echartsOption={};}}
  ]},
 {id:'navigation-target-inputs',description:'6.40 显式跨页传值意图与受控来源',valid:['navigation-source-page','navigation-list-page','navigation-detail-page'],cases:[
 {case:'navigation-inputs-before-6.40',base:'navigation-source-page',expect:/由 6.40 引入/,mutate:d=>{d.schemaVersion='6.39';}},
 {case:'navigation-policy-fixed-input',base:'navigation-source-page',expect:/旧数组固定参数/,mutate:d=>{d.params=[{id:'source-label',type:'string',required:true,value:'固定'}];}},
 {case:'navigation-policy-false',base:'navigation-source-page',expect:/must be equal to constant/,mutate:d=>{d.strictURLInputs=false;}},
 {case:'navigation-inputs-false',base:'navigation-source-page',expect:/must be equal to constant/,mutate:d=>{d.sections[0].components[0].props.links[0].validateTargetInputs=false;}},
 {case:'navigation-inputs-unknown-filter',base:'navigation-list-page',expect:/未声明的筛选器/,mutate:d=>{d.sections[0].components[1].props.actions[0].navigate.query.month.id='unknown';}}]},
  {id:'time-extensions',description:'6.39 显式时间模式、可信期间事实、快捷范围及V2月份窗口',valid:['time-modes-page','time-presets-page','availability-page','calendar-window-page','time-binding-branches-page'],cases:[
    {case:'time-before-6.39',base:'time-modes-page',expect:/由 6.39 引入/,mutate:d=>{d.schemaVersion='6.38';}},
    {case:'time-case-missing',base:'time-modes-page',expect:/穷尽/,mutate:d=>{delete d.dataSources.bound.source.query.timeModes.cases.month;}},
    {case:'time-query-xor',base:'time-modes-page',expect:/互斥/,mutate:d=>{const q=d.dataSources.bound.source.query;q.body=q.timeModes.cases.day.body;}},
    {case:'time-period-mismatch',base:'time-modes-page',expect:/匹配显式模式/,mutate:d=>{d.dataSources.bound.source.query.timeModes.cases.isoWeek.body.dsl_list[0].filter.time.period='month';}},
    {case:'time-output-mismatch',base:'time-modes-page',expect:/相同字段/,mutate:d=>{d.dataSources.bound.source.query.timeModes.cases.isoWeek.body.dsl_list[0].output_metrics=['other'];}},
    {case:'time-default-week',base:'time-modes-page',expect:/默认范围/,mutate:d=>{d.filters[0].modes[2].default.from='2026-10-06';}},
    {case:'time-availability-default',base:'availability-page',expect:/互斥/,mutate:d=>{d.filters[0].default='2026-09';}},
    {case:'time-fact-kind',base:'availability-page',expect:/part与kind/,mutate:d=>{d.iocHeader.identity.facts[3].value.part='latest';}},
    {case:'time-window-static-options',base:'calendar-window-page',expect:/动态平面/,mutate:d=>{d.filters[1].options=[{value:'2026-01',label:'一月'}];}}
  ]},

  {id:'currency-selection',description:'6.38金额范围和静态货币字段选择',valid:['currency-selection-page'],cases:[
    {case:'currency-before-6.38',base:'currency-selection-page',expect:/由 6.38 引入/,mutate:d=>{d.schemaVersion='6.37';}},
    {case:'currency-case-missing',base:'currency-selection-page',expect:/穷尽/,mutate:d=>{delete d.sections[0].components[2].props.columns[1].field.byFilter.cases.USD;}},
    {case:'currency-metric-mismatch',base:'currency-selection-page',expect:/匹配币种/,mutate:d=>{d.dataSources.main.source.query.filterBindings.amount.metricByFilter.cases.USD='ioc_amount_base_cny';}},
    {case:'currency-negative-default',base:'currency-selection-page',expect:/默认范围/,mutate:d=>{d.filters[2].default={from:-1};}},
    {case:'currency-equal-default',base:'currency-selection-page',expect:/默认范围/,mutate:d=>{d.filters[2].default={from:1,to:1};}},
    {case:'currency-compute-mixed',base:'currency-selection-page',expect:/混合静态货币/,mutate:d=>{d.dataSources.main.compute[0].fields[1]='fee-usd';}}
  ]},
  {id:'business-filters',description:'6.37 封闭枚举与业务选择语义',valid:['business-filter-page'],cases:[
    {case:'business-filter-before-6.37',base:'business-filter-page',expect:/由 6.37 引入/,mutate:d=>{d.schemaVersion='6.36';}},
    {case:'business-filter-single-many',base:'business-filter-page',expect:/单选/,mutate:d=>{d.filters[1].default=['A','B'];}},
    {case:'business-filter-disabled-default',base:'business-filter-page',expect:/封闭枚举/,mutate:d=>{d.filters[1].default=['X'];}},
    {case:'business-filter-options-dependent',base:'business-filter-page',expect:/动态候选/,mutate:d=>{d.filters[1].candidateContext={filterIds:['period'],reconcile:'clear'};}},
    {case:'business-filter-unrestricted-without-options',base:'business-filter-page',expect:/全选不限/,mutate:d=>{delete d.filters[2].options;}},
    {case:'business-filter-cycle',base:'business-filter-page',expect:/循环/,mutate:d=>{d.filters[0].clearOnChangeOf=['focus'];d.filters[3].clearOnChangeOf=['period'];}}
  ]},
  {id:'ioc-header',description:'6.36 页级IOC身份与唯一筛选归属',valid:['ioc-header-page'],cases:[
    {case:'ioc-header-before-6.36',base:'ioc-header-page',expect:/由 6.36 引入/,mutate:d=>{d.schemaVersion='6.31';}},
    {case:'ioc-header-empty',base:'ioc-header-page',expect:/需要身份/,mutate:d=>{d.iocHeader={};}},
    {case:'ioc-header-toolbar-conflict',base:'ioc-header-page',expect:/由 6.41 引入/,mutate:d=>{delete d.dashboardToolbar;}},
    {case:'ioc-header-hidden-filter',base:'ioc-header-page',expect:/静态可见/,mutate:d=>{d.filters[1].visible=false;}},
    {case:'ioc-header-missing-filter',base:'ioc-header-page',expect:/静态可见/,mutate:d=>{d.iocHeader.filterIds.push('missing');}},
    {case:'ioc-header-duplicate-identity',base:'ioc-header-page',expect:/重复承担/,mutate:d=>{d.sections[0].components.unshift({id:'old-header',type:'reportHeader',layout:{span:12},props:{title:'旧标题'}});}}
  ]},
  { id:'table-row-number', description:'6.48表格序号列不绑定数据字段且受版本约束', valid:['table-row-number-page'], cases:[
    {case:'row-number-before-6.48',base:'table-row-number-page',expect:/由 6.48 引入/,mutate:d=>{d.schemaVersion='6.47';}},
    {case:'row-number-invalid-width',base:'table-row-number-page',expect:/./,mutate:d=>{d.sections[0].components[0].props.rowNumber.width=0;}},
    {case:'row-number-no-data-field',base:'table-row-number-page',expect:/./,mutate:d=>{d.sections[0].components[0].props.rowNumber.field='name';}}
  ]},
  { id:'table-row-expansion', description:'6.44单层子表格的作用域、只读及查询分页约束', valid:['table-row-expansion-inline','table-row-expansion-query'], cases:[
    {case:'row-expansion-before-6.44',base:'table-row-expansion-inline',expect:/由 6.44 引入/,mutate:d=>{d.schemaVersion='6.43';}},
    {case:'row-expansion-missing-parent-key',base:'table-row-expansion-inline',expect:/稳定的.*维度行键/,mutate:d=>{delete d.sections[0].components[0].props.rowKey;}},
    {case:'row-expansion-query-local-page',base:'table-row-expansion-query',expect:/mode:query/,mutate:d=>{d.sections[0].components[0].props.rowExpansion.table.pagination={mode:'local',pageSize:10};}},
    {case:'row-expansion-unbound-parent',base:'table-row-expansion-query',expect:/绑定.*全部输入/,mutate:d=>{d.sections[0].components[0].props.rowExpansion.data.bindings={unknown:{source:'row',field:'customer-id'}};}}
  ]},
  {id:'report-header-export-buttons',description:'6.31 同一种导出按钮按格式配置名称、文件名和清晰度，直接下载',valid:['report-export-buttons','report-export-scale-fallback'],cases:[
    {case:'report-export-before-6.31',base:'report-export-buttons',expect:/由 6.31 引入/,mutate:d=>{d.schemaVersion='6.30';}},
    {case:'report-export-dashboard',base:'report-export-buttons',expect:/导出按钮只允许/,mutate:d=>{d.layout='dashboard';}},
    {case:'report-export-other-format',base:'report-export-buttons',expect:/./,mutate:d=>{d.sections[0].components[0].props.exportButtons[1].format='jpeg';}},
    {case:'report-export-duplicate-format',base:'report-export-buttons',expect:/每种格式只能/,mutate:d=>{d.sections[0].components[0].props.exportButtons[1].format='pdf';}},
    {case:'report-export-mixed-legacy',base:'report-export-buttons',expect:/不能与旧/,mutate:d=>{d.sections[0].components[0].props.pdfExport={};}}
  ]},
  {id:'report-header-png-export',description:'6.30 Report导出图片，只输出一张PNG，固定名称与3/4倍倍率',valid:['report-png-export','report-export-scale-fallback'],cases:[
    {case:'report-png-before-6.30',base:'report-png-export',expect:/由 6.30 引入/,mutate:d=>{d.schemaVersion='6.29';}},
    {case:'report-png-dashboard',base:'report-png-export',expect:/导出图片只允许/,mutate:d=>{d.layout='dashboard';delete d.sections[0].components[0].props.filterIds;delete d.sections[0].components[0].props.pdfExport;}},
    {case:'report-png-empty-filename',base:'report-png-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pngExport.filename='';}},
    {case:'report-png-fixed-label',base:'report-png-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pngExport.label='PNG';}},
    {case:'report-png-other-format',base:'report-png-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pngExport.format='jpeg';}}
  ]},
  {id:'period-filter',description:'6.27 Dashboard 年季月与近一年期间筛选',valid:['dashboard-period-filter','dashboard-period-filter-month','dashboard-period-filter-more','dashboard-period-filter-readonly','period-filter-year-page','period-filter-quarter-page','period-filter-last12-months-page','period-filter-parameter-page'],cases:[
    {case:'period-filter-before-6.27',base:'dashboard-period-filter',expect:/由 6.27 引入/,mutate:d=>{d.schemaVersion='6.26';}},
    {case:'period-filter-quarter-invalid',base:'dashboard-period-filter',expect:/期间默认选择不合法/,mutate:d=>{d.filters[0].default={mode:'quarter',value:'2026-Q5'};}},
    {case:'period-filter-report',base:'dashboard-period-filter',expect:/Dashboard/,mutate:d=>{d.layout='report';}},
    {case:'period-filter-datetime',base:'dashboard-period-filter',expect:/datetime/,mutate:d=>{d.filters[0].precision='datetime';}},
    {case:'period-filter-no-default',base:'dashboard-period-filter',expect:/期间默认选择/,mutate:d=>{delete d.filters[0].default;}},
    {case:'period-filter-static-time',base:'dashboard-period-filter',expect:/固定时间来源/,mutate:d=>{d.dataSources.sales.source.query.body.dsl_list[0].filter.time.start='2026-01-01';}}
  ]},
  {id:'filter-group-presentation',description:'6.47固定单选下拉和左右对齐',valid:['filter-group-page'],cases:[
    {case:'filter-select-version',base:'filter-group-page',expect:/由 6.47 引入/,mutate:d=>{d.schemaVersion='6.46';}},
    {case:'filter-select-default',base:'filter-group-page',expect:/default/,mutate:d=>{d.filters[1].default=['unknown'];}}
  ]},
  {
    id: 'filter-group', description: '6.45 Dashboard 独立固定单选筛选按钮组、多查询与统一显隐', valid: ['chart-local-filter-page','filter-group-state-page'], cases: [
      {case:'filter-group-version',base:'filter-group-state-page',expect:/由 6.45 引入/,mutate:d=>{d.schemaVersion='6.44';}},
      {case:'filter-group-report',base:'filter-group-state-page',expect:/Dashboard/,mutate:d=>{d.layout='report';}},
      {case:'filter-group-detail',base:'filter-group-state-page',expect:/Dashboard/,mutate:d=>{d.detailViews=[{id:'detail-filter',mode:'snapshot',components:[{...structuredClone(firstComponent(d)),id:'detail-control'}]}];}},
      {case:'filter-group-invalid-default',base:'filter-group-state-page',expect:/default/,mutate:d=>{d.filters[1].default=['unknown'];}},
      {case:'filter-group-duplicate-options',base:'filter-group-state-page',expect:/不得重复/,mutate:d=>{firstComponent(d).props.options[1].value='CN';}},
      {case:'filter-group-duplicate-control',base:'filter-group-state-page',expect:/只能声明一个/,mutate:d=>{d.sections[0].components.push({...structuredClone(firstComponent(d)),id:'duplicate'});}},
      {case:'filter-group-no-binding',base:'filter-group-state-page',expect:/filterBindings/,mutate:d=>{delete d.dataSources['orders-data'].source.query.filterBindings;delete d.dataSources['revenue-data'].source.query.filterBindings;}},
      {case:'filter-group-removed-chart-filter',base:'filter-group-state-page',expect:/迁移为独立 filterGroup/,mutate:d=>{d.sections[2].components[0].props.filter={filterId:'channel',options:[{label:'直营',value:'CN'}]};}}
    ]
  },
  {
    id: 'report-header-pdf-export', description: 'Report PDF下载由6.28引入，仅允许Report顶层页头，按钮文字和文件名为非空文本取值',
    valid: ['report-pdf-export'], cases: [
      {case:'report-pdf-before-6.28',base:'report-pdf-export',expect:/由 6.28 引入/,mutate:d=>{d.schemaVersion='6.27';}},
      {case:'report-pdf-on-dashboard',base:'report-pdf-export',expect:/PDF 下载工具带只允许/,mutate:d=>{d.layout='dashboard';delete d.sections[0].components[0].props.filterIds;}},
      {case:'report-pdf-empty-label',base:'report-pdf-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pdfExport.label='';}},
      {case:'report-pdf-empty-filename',base:'report-pdf-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pdfExport.filename='';}},
      {case:'report-pdf-unknown-option',base:'report-pdf-export',expect:/./,mutate:d=>{d.sections[0].components[0].props.pdfExport.encoder='external';}}
    ]
  },
  {
    id: 'time-point-disable-future', description: '6.25 时间点禁止未来月份与日期',
    valid: ['time-point-no-future'], cases: [
      { case: 'time-point-disable-future-before-6.25', base: 'time-point-no-future', expect: /由 6.25 引入/, mutate: d => { d.schemaVersion = '6.24'; } },
      { case: 'time-point-disable-future-default-month', base: 'time-point-no-future', expect: /不得晚于/, mutate: d => { d.filters[0].default = '9999-12'; } },
      { case: 'time-point-disable-future-default-date', base: 'time-point-no-future', expect: /不得晚于/, mutate: d => { d.filters[1].default = '9999-12-31'; } }
    ]
  },
  {
    id: 'time-point-min', description: '6.24 时间点下限与默认值日历语义',
    valid: ['time-point-min-page'], cases: [
      { case: 'time-point-min-before-6.24', base: 'time-point-min-page', expect: /由 6.24 引入/, mutate: d => { d.schemaVersion = '6.23'; } },
      { case: 'time-point-min-invalid-month', base: 'time-point-min-page', expect: /有效月份/, mutate: d => { d.filters[0].min = '2020-13'; } },
      { case: 'time-point-min-wrong-precision', base: 'time-point-min-page', expect: /YYYY-MM 格式/, mutate: d => { d.filters[0].min = '2020-06-01'; } },
      { case: 'time-point-min-default-before', base: 'time-point-min-page', expect: /不得早于/, mutate: d => { d.filters[0].default = '2020-05'; } },
      { case: 'time-point-min-invalid-date', base: 'time-point-min-page', expect: /公历日期/, mutate: d => { d.filters[1].min = '2020-02-30'; } }
    ]
  },
  {
    id: 'text-value-composition', description: '6.23 文本片段组合；引用先校验，物化后只传递字符串',
    valid: ['text-composition-page'], cases: [
      { case: 'text-composition-before-6.23', base: 'text-composition-page', expect: /由 6.23 引入/, mutate: d => { d.schemaVersion = '6.22'; } },
      { case: 'text-composition-unknown-filter', base: 'text-composition-page', expect: /未声明的筛选器/, mutate: d => { firstComponent(d).props.title.parts[0].filter = 'missing'; } },
      { case: 'text-composition-unknown-param', base: 'text-composition-page', expect: /未声明的页面参数/, mutate: d => { firstComponent(d).props.title.parts[2].param = 'missing'; } },
      { case: 'text-composition-incompatible-format', base: 'text-composition-page', expect: /不相容/, mutate: d => { firstComponent(d).props.title.parts[0].format = 'number-2'; } },
      { case: 'text-composition-empty-result', base: 'text-composition-page', expect: /must NOT have fewer than 1 characters/, mutate: d => { firstComponent(d).props.title = { parts: [''] }; } },
      { case: 'text-composition-optional-required-title', base: 'text-composition-page', expect: /必填|required/, mutate: d => { d.params.display[0].required = false; } },
      { case: 'text-composition-empty', base: 'text-composition-page', expect: /minItems|至少|fewer|items|match|type/, mutate: d => { firstComponent(d).props.title = { parts: [] }; } },
      { case: 'text-composition-nested', base: 'text-composition-page', expect: /type|match|additional|must/, mutate: d => { firstComponent(d).props.title = { parts: [{ parts: ['nested'] }] }; } }
    ]
  },
  { id:'paged-join',description:'6.22 组合表全局视图与普通查询定义引用', valid:['paged-join-page','table-number-range-page'],cases:[
    {case:'table-number-range-before-6.22',base:'table-number-range-page',expect:/由 6.22 引入/,mutate:d=>{d.schemaVersion='6.21';}},
    {case:'paged-join-initial-predicate-in',base:'paged-join-page',expect:/默认视图/,mutate:d=>{d.dataSources['office-overview'].source.initial={capturedAt:'2026-10-14T00:00:00Z',rows:[],totalCount:0,view:{pageIndex:0,pageSize:3,sort:[{field:'bidding-amount',direction:'desc'}],predicates:[{field:'rep-office-name',op:'in',values:['上海',1]}]}};}},
    {case:'paged-join-initial-predicate-numeric',base:'paged-join-page',expect:/默认视图/,mutate:d=>{d.dataSources['office-overview'].source.initial={capturedAt:'2026-10-14T00:00:00Z',rows:[],totalCount:0,view:{pageIndex:0,pageSize:3,sort:[{field:'bidding-amount',direction:'desc'}],predicates:[{field:'bidding-amount',op:'gte',value:1},{field:'bidding-amount',op:'lte',value:2}]}};}},
    {case:'paged-join-initial-predicate-date',base:'paged-join-page',expect:/默认视图/,mutate:d=>{d.dataSources['office-overview'].source.initial={capturedAt:'2026-10-14T00:00:00Z',rows:[],totalCount:0,view:{pageIndex:0,pageSize:3,sort:[{field:'bidding-amount',direction:'desc'}],predicates:[{field:'rep-office-name',op:'dateRange',from:'2026-01-01',to:'2026-02-01'}]}};}},
    {case:'paged-join-before-6.22',base:'paged-join-page',expect:/由 6.22 引入/,mutate:d=>{d.schemaVersion='6.21';}},
    {case:'paged-join-unknown-member',base:'paged-join-page',expect:/普通查询源/,mutate:d=>{d.dataSources['office-overview'].source.members.meeting.source='missing';}},
    {case:'paged-join-invalid-key',base:'paged-join-page',expect:/成员键/,mutate:d=>{d.dataSources['office-overview'].source.members.meeting.key.field='analysis-meeting-rate';}},
    {case:'paged-join-invalid-projection',base:'paged-join-page',expect:/原始字段/,mutate:d=>{d.dataSources['office-overview'].source.projection['bidding-amount'].field='missing';}},
    {case:'paged-join-member-topn',base:'paged-join-page',expect:/无业务窗口/,mutate:d=>{d.dataSources['office-meeting'].source.query.body.dsl_list[0].order.limit=3;}},
    {case:'paged-join-shared-root',base:'paged-join-page',expect:/独占/,mutate:d=>{const c=structuredClone(d.sections[0].components[1]);c.id='second-table';d.sections[0].components.push(c);}},
    {case:'paged-join-invalid-initial',base:'paged-join-page',expect:/默认视图|完整第一页/,mutate:d=>{d.dataSources['office-overview'].source.initial={capturedAt:'2026-10-14T00:00:00Z',rows:[],totalCount:8,view:{pageIndex:1,pageSize:3,sort:[],predicates:[]}};}},
    {case:'table-number-range-non-numeric',base:'paged-join-page',expect:/数值范围|度量/,mutate:d=>{d.sections[0].components[1].props.columns[1].filterable={mode:'numberRange'};}}
  ] },
  {
    id: 'table-toolbar-search', description: '表格工具区由6.21引入，搜索显式引用文本标量字段',
    valid: ['table-toolbar-page'], cases: [
      { case: 'table-toolbar-before-6.21', base: 'table-toolbar-page', expect: /由 6.21 引入/,
        mutate: d => { d.schemaVersion = '6.20'; } },
      { case: 'table-search-nontext-field', base: 'table-toolbar-page', expect: /文本标量字段/,
        mutate: d => { firstComponent(d).props.toolbar.search.fields = ['value']; } },
      { case: 'table-search-duplicate-field', base: 'table-toolbar-page', expect: /不得重复|duplicate/,
        mutate: d => { firstComponent(d).props.toolbar.search.fields = ['name', 'name']; } }
    ]
  },
  {
    id: 'table-search-options', description: '6.42 静态搜索选项唯一、默认项有效且每项引用文本字段',
    valid: ['table-search-options-page'], cases: [
      { case: 'table-search-options-before-6.42', base: 'table-search-options-page', expect: /由 6.42 引入/,
        mutate: d => { d.schemaVersion = '6.41'; } },
      { case: 'table-search-options-duplicate', base: 'table-search-options-page', expect: /搜索选项值不得重复/,
        mutate: d => { const options = firstComponent(d).props.toolbar.search.options; options[1].value = options[0].value; } },
      { case: 'table-search-options-default-missing', base: 'table-search-options-page', expect: /默认搜索选项必须存在/,
        mutate: d => { firstComponent(d).props.toolbar.search.defaultValue = 'missing'; } },
      { case: 'table-search-options-nontext', base: 'table-search-options-page', expect: /文本标量字段/,
        mutate: d => { firstComponent(d).props.toolbar.search.options[1].field = 'amount'; } },
      { case: 'table-search-options-unmapped', base: 'table-search-options-page', expect: /queryField 映射/,
        mutate: d => { delete d.dataSources.queried.fields.owner.queryField; } }
    ]
  },
  {
    id: 'signed-number-family-capability', description: '两位小数与千分位带符号数值格式由6.18引入',
    valid: ['signed-number-family-page'], cases: [
      { case: 'signed-number-two-decimal-before-6.18', base: 'inline-report', expect: /由 6.18 引入/,
        mutate: d => { d.schemaVersion = '6.17'; firstComponent(d,0,1).props.rows[0].valueField.format = 'number-2-signed'; } },
      { case: 'signed-number-grouped-before-6.18', base: 'inline-report', expect: /由 6.18 引入/,
        mutate: d => { d.schemaVersion = '6.17'; d.dataSources.overview.fields.gmv.defaultFormat = 'number-grouped-signed'; } },
      { case: 'signed-number-family-param-before-6.18', base: 'inline-report', expect: /由 6.18 引入/,
        mutate: d => { d.schemaVersion = '6.17'; d.params = [{ id:'target',type:'number',required:true,default:3 }]; d.meta = {title:{param:'target',format:'number-2-signed'}}; } }
    ]
  },
  {
    id: 'signed-number-format-capability', description: '带符号普通数值格式由6.17引入',
    valid: ['signed-number-page'], cases: [
      { case: 'signed-number-binding-before-6.17', base: 'inline-report', expect: /由 6.17 引入/,
        mutate: d => { d.schemaVersion = '6.16'; firstComponent(d,0,1).props.rows[0].valueField.format = 'number-1-signed'; } },
      { case: 'signed-number-default-before-6.17', base: 'inline-report', expect: /由 6.17 引入/,
        mutate: d => { d.schemaVersion = '6.16'; d.dataSources.overview.fields.gmv.defaultFormat = 'number-signed'; } },
      { case: 'signed-number-param-before-6.17', base: 'inline-report', expect: /由 6.17 引入/,
        mutate: d => { d.schemaVersion = '6.16'; d.params = [{ id:'target',type:'number',required:true,default:3 }]; d.meta = {title:{param:'target',format:'number-signed'}}; } }
    ]
  },
  {
    id: 'explicit-color-local', description: '显式颜色只绑定数字且不与旧染色声明冲突',
    valid: ['explicit-presentation-page'], cases: [
      { case: 'color-rule-legacy-conflict', base: 'explicit-presentation-page', expect: /colorRule 不得/,
        mutate: d => { firstComponent(d).props.columns[1].visual = 'signed'; } },
      { case: 'color-rule-nonnumeric', base: 'explicit-presentation-page', expect: /colorRule 只支持/,
        mutate: d => { firstComponent(d).props.columns[0].colorRule = {mode:'fixed',color:'red'}; } },
      { case: 'color-rule-tone-conflict', base: 'explicit-presentation-page', expect: /colorRule 不得/,
        mutate: d => { firstComponent(d,0,1).props.rows[0].changes[0].tone = 'auto'; } }
    ]
  },
  {
    id: 'chart-value-label-exclusive', description: '常驻数值标签不与旧标签重复启用',
    valid: ['explicit-presentation-page'], cases: [
      { case: 'value-label-bar-conflict', base: 'explicit-presentation-page', expect: /showValueLabels 不得/,
        mutate: d => { firstComponent(d,0,2).props.showSegmentLabels = true; } },
      { case: 'value-label-line-conflict', base: 'explicit-presentation-page', expect: /showValueLabels 不得/,
        mutate: d => { firstComponent(d,0,3).props.showPointLabels = true; } }
    ]
  },
  {
    id: 'presentation-capability', description: '颜色与图表标签声明由6.16引入',
    valid: ['explicit-presentation-page'], cases: [
      { case: 'presentation-before-6.16', base: 'explicit-presentation-page', expect: /由 6.16 引入/,
        mutate: d => { d.schemaVersion = '6.15'; } }
    ]
  },
  {
    id: 'filter-text-declared', description: '筛选文本必须引用已声明筛选器',
    valid: ['report-filter-text-page'], cases: [
      { case: 'filter-text-unknown', base: 'report-filter-text-page', expect: /文本取值引用了未声明的筛选器/,
        mutate: d => { firstComponent(d).props.asOf.value.filter = 'missing'; } }
    ]
  },
  {
    id: 'filter-text-format-compatible', description: 'period 只接受时间输入，禁止数值日期格式混用',
    valid: ['report-filter-text-page'], cases: [
      { case: 'filter-text-format-mismatch', base: 'report-filter-text-page', expect: /格式 number-2 与筛选器/,
        mutate: d => { firstComponent(d).props.asOf.value.format = 'number-2'; } }
    ]
  },
  {
    id: 'filter-text-capability', description: '筛选文本引用与 period 格式需要 6.15',
    valid: ['report-filter-text-page'], cases: [
      { case: 'filter-text-before-6.15', base: 'report-filter-text-page', expect: /由 6.15 引入/,
        mutate: d => { d.schemaVersion = '6.14'; } }
    ]
  },
  {
    id: 'page-layout-compatibility',
    description: '6.1 layout 能力下限与单布局真源；6.0 layoutForm 仍可读取',
    valid: ['legacy-layout-report', 'legacy-layout-dashboard', 'layout-6-1-report', 'layout-6-1-dashboard'],
    cases: [
      { case: 'layout-before-6.1', base: 'layout-6-1-dashboard', expect: /不支持的文档格式版本/, mutate: d => { d.schemaVersion = '6.0'; } },
      { case: 'layout-dual-equal', base: 'layout-6-1-dashboard', expect: /不得同时声明/, mutate: d => { d.layoutForm = 'dashboard'; } },
      { case: 'layout-dual-conflict', base: 'layout-6-1-dashboard', expect: /不得同时声明/, mutate: d => { d.layoutForm = 'report'; } },
      { case: 'layout-invalid-value', base: 'layout-6-1-dashboard', expect: /取值不在允许范围/, mutate: d => { d.layout = 'kiosk'; } }
    ]
  },
  {
    id: 'url-navigation-source-contract',
    description: 'URL 与来源绑定可校验，目标存在性与必填项由目标负责',
    valid: ['url-navigation-page'],
    cases: [
      {case:'navigation-invalid-authority',base:'url-navigation-page',expect:/导航只允许 HTTP/,mutate:d=>{firstComponent(d).props.actions[0].navigate.href='https://bad host/path';}},
      {case:'navigation-invalid-port',base:'url-navigation-page',expect:/导航只允许 HTTP/,mutate:d=>{firstComponent(d).props.actions[0].navigate.href='https://example.com:70000/path';}},
      {case:'navigation-scheme-without-authority',base:'url-navigation-page',expect:/导航只允许 HTTP/,mutate:d=>{firstComponent(d).props.actions[0].navigate.href='https:example.com/path';}},
      {case:'navigation-unsafe-url',base:'url-navigation-page',expect:/导航只允许 HTTP/,mutate:d=>{firstComponent(d).props.actions[0].navigate.href='javascript:alert(1)';}},
      {case:'navigation-missing-row-field',base:'url-navigation-page',expect:/当前行缺少可传参的标量字段/,mutate:d=>{firstComponent(d).props.actions[0].navigate.query.code.field='missing';}},
      {case:'navigation-unknown-param',base:'url-navigation-page',expect:/未声明的页面参数:missing/,mutate:d=>{firstComponent(d).props.actions[0].navigate.query.project.id='missing';}},
      {case:'navigation-wrong-filter-part',base:'url-navigation-page',expect:/不支持分量 value/,mutate:d=>{delete firstComponent(d).props.actions[0].navigate.query.from.part;}},
      {case:'navigation-text-row-source',base:'url-navigation-page',expect:/当前行缺少可传参的标量字段/,mutate:d=>{firstComponent(d,0,1).props.links[0].query.project={source:'row',field:'code'};}},
      {case:'navigation-text-unsafe-url',base:'url-navigation-page',expect:/导航只允许 HTTP/,mutate:d=>{firstComponent(d,0,1).props.links[0].href='data:text/html,hello';}},
      {case:'navigation-url-input-collision',base:'url-navigation-page',expect:/URL 参数名重复:project/,mutate:d=>{d.filters[0].urlParams.value='project';}},
      {case:'navigation-url-input-wrong-part',base:'url-navigation-page',expect:/该筛选器不支持此 URL 分量/,mutate:d=>{d.filters[1].urlParams.level='level';}},
      {case:'navigation-clicked-slot-missing-field',base:'url-navigation-page',expect:/当前行缺少可传参的标量字段/,mutate:d=>{firstComponent(d,0,2).props.rows[0].valueField='total';}},
      {case:'navigation-legacy-target-rejected',base:'url-navigation-page',expect:/缺少必填字段 href/,mutate:d=>{firstComponent(d).props.actions[0].navigate={page:'old'};}}
    ]
  },

  // ---------------------------------------------------------------- 结构与版本
  {
    id: 'schema-structure',
    description: 'Page Schema 结构校验（ajv allErrors 文案与顺序）',
    valid: ALL_VALID,
    cases: [
      {
        case: 'missing-schema-version',
        base: '__missing-schema-version__',
        expect: /缺少必填字段 schemaVersion/,
        mutate: () => undefined
      },
      {
        case: 'unknown-top-level-field',
        base: 'inline-report',
        expect: /存在未定义字段 widgets/,
        mutate: (document) => {
          document.widgets = [];
        }
      },
      {
        case: 'layout-span-out-of-range',
        base: 'inline-report',
        expect: /must be <= 12/,
        mutate: (document) => {
          firstComponent(document, 0, 1).layout.span = 13;
        }
      },
      {
        case: 'field-id-pattern',
        base: 'inline-report',
        expect: /property name must be valid/,
        mutate: (document) => {
          document.dataSources.overview.fields['1-bad'] = { type: 'number', role: 'measure' };
          document.dataSources.overview.source.rows[0]['1-bad'] = 1;
        }
      },
      {
        case: 'sections-empty',
        base: 'inline-report',
        expect: /must NOT have fewer than 1 items/,
        mutate: (document) => {
          document.sections = [];
        }
      }
    ]
  },
  {
    id: 'schema-version-supported',
    description: 'schemaVersion 必须是当前主版本内的受支持次版本',
    valid: ALL_VALID,
    cases: [
      {
        case: 'version-major-unsupported',
        base: 'query-dashboard',
        expect: /不支持的文档格式版本 4\.0/,
        mutate: (document) => {
          document.schemaVersion = '4.0';
        }
      },
      {
        case: 'version-minor-ahead',
        base: 'query-dashboard',
        expect: /高于运行时当前次版本/,
        mutate: (document) => {
          document.schemaVersion = minorAheadOfCurrent;
        }
      }
    ]
  },
  {
    id: 'composite-card-pure-container',
    description: '组合卡是纯容器：不声明 data / actions、至少一个子组件、不嵌套容器、子组件在白名单内',
    valid: ['composite-page'],
    cases: [
      {
        case: 'composite-card-with-data',
        base: 'composite-page',
        expect: /不得声明 data/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data = { main: 'summary' };
        }
      },
      {
        case: 'composite-card-with-actions',
        base: 'composite-page',
        expect: /不得声明 actions/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.actions = [
            { on: 'click', navigate: { page: 'x' } }
          ];
        }
      },
      {
        case: 'composite-card-empty',
        base: 'composite-page',
        expect: /至少要有一个子组件/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components = [];
        }
      },
      {
        case: 'composite-card-nested-container',
        base: 'composite-page',
        expect: /不得再嵌套容器组件:tabContainer/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.push(
            structuredClone(firstComponent(document, 1, 0))
          );
        }
      },
      {
        case: 'composite-card-child-not-whitelisted',
        base: 'composite-page',
        expect: /子组件不在白名单内:table/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.push(
            structuredClone(firstComponent(document, 1, 0).props.tabs[1].components[0])
          );
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 页面参数
  {
    id: 'page-param-id-unique',
    description: '页面参数 id 唯一',
    valid: ['params-page'],
    cases: [
      {
        case: 'duplicate-page-param-id',
        base: 'params-page',
        expect: /页面参数 id 重复:customer/,
        mutate: (document) => {
          document.params.push({ id: 'customer', type: 'string', required: true });
        }
      }
    ]
  },
  {
    id: 'page-param-not-filter-name',
    description: '页面参数不得与筛选器同名',
    valid: ['params-page', 'filters-page'],
    cases: [
      {
        case: 'page-param-named-like-filter',
        base: 'params-page',
        expect: /页面参数与筛选器同名:customer/,
        mutate: (document) => {
          document.filters = [{ id: 'customer', type: 'search' }];
        }
      }
    ]
  },
  {
    id: 'page-param-default-type',
    description: '页面参数默认值符合声明类型',
    valid: ['params-page'],
    cases: [
      {
        case: 'page-param-default-type-mismatch',
        base: 'params-page',
        expect: /默认值不符合参数类型 number/,
        mutate: (document) => {
          document.params[1].default = '2026';
        }
      }
    ]
  },
  {
    id: 'text-value-param-declared',
    description: '文本取值只能引用已声明的页面参数',
    valid: ['params-page'],
    cases: [
      {
        case: 'text-value-unknown-param',
        base: 'params-page',
        expect: /引用了未声明的页面参数:missing/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.badge = { param: 'missing' };
        }
      }
    ]
  },
  {
    id: 'text-value-format-compatible',
    description: '文本取值引用的展示格式与参数类型相容',
    valid: ['params-page'],
    cases: [
      {
        case: 'text-value-format-mismatch',
        base: 'params-page',
        expect: /格式 date 与页面参数 year 的类型 number 不相容/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.tags[0].format = 'date';
        }
      }
    ]
  },
  {
    id: 'page-param-consumed',
    description: '每个页面参数至少被一处文本取值消费',
    valid: ['params-page'],
    cases: [
      {
        case: 'page-param-unconsumed',
        base: 'params-page',
        expect: /页面参数 unused 没有任何消费者/,
        mutate: (document) => {
          document.params.push({ id: 'unused', type: 'string', required: false });
        }
      }
    ]
  },
  {
    id: 'optional-param-not-in-required-text',
    description: '必填文本属性只能引用必需参数',
    valid: ['params-page'],
    cases: [
      {
        case: 'required-title-references-optional-param',
        base: 'params-page',
        expect: /可选页面参数缺失时引用处整体消失/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.title = { param: 'note' };
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 解析接缝
  {
    id: 'grouped-query-fields-unique',
    description: '按角色分组的查询字段在维度组与度量组之间不得重名',
    valid: ['grouped-fields-page'],
    cases: [
      {
        case: 'grouped-field-duplicate',
        base: 'grouped-fields-page',
        expect: /页面字段重复声明:customer/,
        mutate: (document) => {
          document.dataSources.grouped.fields.measures.customer = {
            queryField: 'customer_dup',
            type: 'number'
          };
        }
      }
    ]
  },
  {
    id: 'grouped-query-field-label-not-id',
    description: '分组查询字段的 label 与字段 id 相同时应省略',
    valid: ['grouped-fields-page'],
    cases: [
      {
        case: 'grouped-field-label-equals-id',
        base: 'grouped-fields-page',
        expect: /label 与字段 id 相同，应省略:customer/,
        mutate: (document) => {
          document.dataSources.grouped.fields.dimensions.customer.label = 'customer';
        }
      }
    ]
  },
  {
    id: 'query-initial-rows-normalize',
    description: 'DQE 内嵌初始行按 queryField 归一化，数值度量容错，维度和结构严格校验',
    valid: ['filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page', 'query-numeric-tolerance'],
    cases: [
      {
        case: 'initial-row-missing-query-field',
        base: 'grouped-fields-page',
        expect: /DQE 内嵌初始行缺少映射字段:customer_name/,
        mutate: (document) => {
          delete document.dataSources.grouped.source.initial.rows[0].customer_name;
        }
      },
      {
        case: 'initial-row-null-not-allowed',
        base: 'filters-page',
        expect: /DQE 字段 region 为 null，页面字段 region 声明 nullable=false/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].region = null;
        }
      },
      {
        case: 'initial-row-type-mismatch',
        base: 'filters-page',
        expect: /DQE 字段 region 不符合页面字段 region 的类型 string/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].region = 120;
        }
      },
      {
        case: 'initial-row-date-invalid',
        base: 'filters-page',
        expect: /DQE 字段 stat_date 不符合页面字段 stat-date 的类型 date/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].stat_date = '2026-02-30';
        }
      },
      {
        case: 'initial-row-semantic-html-too-large',
        base: 'compute-page',
        expect: /DQE 语义 HTML 字段 reason 最多允许 64000 字符/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].reason = longString(64001);
        }
      },
      {
        case: 'initial-row-detail-missing-query-field',
        base: 'compute-page',
        expect: /DQE 嵌套明细项缺少映射字段:event_title/,
        mutate: (document) => {
          delete document.dataSources.customers.source.initial.rows[0].events[0].event_title;
        }
      },
      {
        case: 'initial-row-detail-null-not-allowed',
        base: 'compute-page',
        expect: /DQE 嵌套明细字段 event_title 为 null，页面字段 title 声明 nullable=false/,
        mutate: (document) => {
          document.dataSources.customers.fields.events.items.fields.title.nullable = false;
          document.dataSources.customers.source.initial.rows[0].events[0].event_title = null;
        }
      },
      {
        case: 'initial-row-detail-type-mismatch',
        base: 'compute-page',
        expect: /DQE 嵌套明细字段 event_title 不符合页面字段 title 的类型 string/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].events[0].event_title = 3;
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 筛选器
  {
    id: 'filter-id-unique',
    description: '筛选器 id 唯一',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'duplicate-filter-id',
        base: 'filters-page',
        expect: /筛选器 id 重复:keyword/,
        mutate: (document) => {
          document.filters.push({ id: 'keyword', type: 'search' });
        }
      }
    ]
  },
  {
    id: 'time-range-default-calendar',
    description: 'timeRange 绝对默认值须为合法公历值、精度一致且 from 不晚于 to',
    valid: ['filters-page'],
    cases: [
      {
        case: 'time-range-from-format',
        base: 'filters-page',
        expect: /时间范围 from 须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          document.filters[2].default.from = '2026/07/01';
        }
      },
      {
        case: 'time-range-to-calendar',
        base: 'filters-page',
        expect: /时间范围 to 不是有效的公历日期/,
        mutate: (document) => {
          document.filters[2].default.to = '2026-02-30';
        }
      },
      {
        // 未声明 precision 时校验按 date 代入，因此「from 与 to 精度不一致」在页面校验里不可达，
        // 这里钉住的是省略 precision 后 datetime 端点被按 date 格式拒绝。
        case: 'time-range-datetime-without-precision',
        base: 'filters-page',
        expect: /时间范围 to 须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          delete document.filters[2].precision;
          document.filters[2].default.to = '2026-07-31T10:00';
        }
      },
      {
        case: 'time-range-from-after-to',
        base: 'filters-page',
        expect: /时间范围 from 不得晚于 to/,
        mutate: (document) => {
          document.filters[2].default = { from: '2026-07-31', to: '2026-07-01' };
        }
      }
    ]
  },
  {
    id: 'relative-time-anchor',
    description: '结构化相对时间的 anchor 须为合法公历日期',
    valid: ['filters-page'],
    cases: [
      {
        case: 'relative-time-anchor-invalid',
        base: 'filters-page',
        expect: /时间点不是有效的公历日期/,
        mutate: (document) => {
          document.filters[3].default.anchor = '2026-13-01';
        }
      }
    ]
  },
  {
    id: 'time-point-default',
    description: 'timePoint 默认值符合其粒度的格式与日历',
    valid: ['filters-page'],
    cases: [
      {
        case: 'time-point-month-format',
        base: 'filters-page',
        expect: /时间点须为 YYYY-MM 格式/,
        mutate: (document) => {
          document.filters[4].default = '202607';
        }
      },
      {
        case: 'time-point-month-range',
        base: 'filters-page',
        expect: /时间点不是有效月份/,
        mutate: (document) => {
          document.filters[4].default = '2026-13';
        }
      },
      {
        case: 'time-point-date-format',
        base: 'filters-page',
        expect: /时间点须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          document.filters[5].default = '20260731';
        }
      },
      {
        case: 'time-point-date-calendar',
        base: 'filters-page',
        expect: /时间点不是有效的公历日期/,
        mutate: (document) => {
          document.filters[5].default = '2026-02-30';
        }
      }
    ]
  },
  {
    id: 'number-range-default',
    description: 'numberRange 默认值至少有一端且 from 不大于 to',
    valid: ['filters-page'],
    cases: [
      {
        case: 'number-range-empty',
        base: 'filters-page',
        expect: /数值区间至少要有一端/,
        mutate: (document) => {
          document.filters[6].default = {};
        }
      },
      {
        case: 'number-range-inverted',
        base: 'filters-page',
        expect: /数值区间 from 不得大于 to/,
        mutate: (document) => {
          document.filters[6].default = { from: 10, to: 5 };
        }
      }
    ]
  },
  {
    id: 'hierarchy-level-id-unique',
    description: '层级 id 在同一筛选器内唯一',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'duplicate-hierarchy-level-id',
        base: 'filters-page',
        expect: /层级 id 重复:region-level/,
        mutate: (document) => {
          document.filters[0].hierarchy[1].id = 'region-level';
          document.filters[0].defaultLevel = 'region-level';
        }
      }
    ]
  },
  {
    id: 'default-level-declared',
    description: 'defaultLevel 只能用于声明了 hierarchy 的筛选器并引用已声明层级',
    valid: ['filters-page'],
    cases: [
      {
        case: 'default-level-without-hierarchy',
        base: 'filters-page',
        expect: /defaultLevel 只能用于声明了 hierarchy 的维度筛选器/,
        mutate: (document) => {
          document.filters[1].defaultLevel = 'city-level';
        }
      },
      {
        case: 'default-level-unknown',
        base: 'filters-page',
        expect: /defaultLevel 引用了未知层级:country/,
        mutate: (document) => {
          document.filters[0].defaultLevel = 'country';
        }
      }
    ]
  },
  {
    id: 'hierarchy-picker-requires-hierarchy',
    description: 'hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'hierarchy-picker-without-hierarchy',
        base: 'filters-page',
        expect: /hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器/,
        mutate: (document) => {
          document.filters[1].hierarchyPicker = 'tabs';
        }
      }
    ]
  },
  {
    id: 'filter-depends-on',
    description: '级联只能依赖另一个已声明的 dimension 筛选器且不成环',
    valid: ['filters-page'],
    cases: [
      {
        case: 'depends-on-self',
        base: 'filters-page',
        expect: /筛选器不能依赖自己/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'city';
        }
      },
      {
        case: 'depends-on-undeclared',
        base: 'filters-page',
        expect: /dependsOn 引用了未声明的筛选器:country/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'country';
        }
      },
      {
        case: 'depends-on-non-dimension',
        base: 'filters-page',
        expect: /级联上游必须是 dimension 筛选器:period/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'period';
        }
      },
      {
        case: 'depends-on-cycle',
        base: 'filters-page',
        expect: /筛选器级联存在循环/,
        mutate: (document) => {
          document.filters[0].dependsOn = 'city';
        }
      }
    ]
  },
  {
    id: 'hidden-hierarchy-picker-needs-map',
    description: '隐藏层级切换器时必须有地图通过 hierarchyFilter 承担下钻',
    valid: ['map-page'],
    cases: [
      {
        case: 'hidden-hierarchy-picker-without-map',
        base: 'filters-page',
        expect: /隐藏层级切换器要求同页地图通过 hierarchyFilter 承担下钻:region/,
        mutate: (document) => {
          document.filters[0].hierarchyPicker = 'hidden';
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 分区
  {
    id: 'section-id-unique',
    description: '内容分区 id 唯一',
    valid: ['composite-page'],
    cases: [
      {
        case: 'duplicate-section-id',
        base: 'composite-page',
        expect: /section id 重复:overview/,
        mutate: (document) => {
          document.sections[1].id = 'overview';
        }
      }
    ]
  },
  {
    id: 'component-id-unique',
    description: '组件 id 在整页（含容器内）唯一',
    valid: ALL_VALID,
    cases: [
      {
        case: 'duplicate-component-id',
        base: 'query-dashboard',
        expect: /component id 重复:sales-table/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'sales-table',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: 'Duplicate' }
          });
        }
      },
      {
        case: 'duplicate-component-id-in-container',
        base: 'composite-page',
        expect: /component id 重复:single-panel/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[3].id = 'single-panel';
        }
      }
    ]
  },
  {
    id: 'layer-top-level-only',
    description: 'layout.layer 只能声明在内容分区的顶层组件上',
    valid: ['composite-page'],
    cases: [
      {
        case: 'layer-inside-composite-card',
        base: 'composite-page',
        expect: /layout\.layer 只能声明在内容分区的顶层组件上/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[1].layout.layer = 'backdrop';
        }
      }
    ]
  },
  {
    id: 'single-backdrop-per-section',
    description: '一个分区最多一个 backdrop',
    valid: ['composite-page'],
    cases: [
      {
        case: 'two-backdrops',
        base: 'composite-page',
        expect: /声明了 2 个 backdrop，最多允许一个/,
        mutate: (document) => {
          firstComponent(document, 0, 2).layout.layer = 'backdrop';
        }
      }
    ]
  },
  {
    id: 'backdrop-needs-siblings',
    description: '声明 backdrop 的分区必须还有别的组件叠在其上',
    valid: ['composite-page'],
    cases: [
      {
        case: 'backdrop-only-section',
        base: 'composite-page',
        expect: /只有 backdrop 组件，没有可叠放其上的组件/,
        mutate: (document) => {
          const section = document.sections[0];
          delete section.columnTracks;
          section.components = [section.components[0]];
        }
      }
    ]
  },
  {
    id: 'backdrop-container-plain',
    description: '声明 backdrop 的分区必须使用 container: plain',
    valid: ['composite-page'],
    cases: [
      {
        case: 'backdrop-in-card-container',
        base: 'composite-page',
        expect: /必须使用 container: plain，当前为 card/,
        mutate: (document) => {
          document.sections[0].container = 'card';
        }
      },
      {
        case: 'backdrop-without-container',
        base: 'composite-page',
        expect: /必须使用 container: plain，当前为 缺省/,
        mutate: (document) => {
          delete document.sections[0].container;
        }
      }
    ]
  },
  {
    id: 'column-track-span',
    description: '声明列轨的分区里顶层组件 span 不得超过轨数',
    valid: ['composite-page'],
    cases: [
      {
        case: 'span-exceeds-column-tracks',
        base: 'composite-page',
        expect: /声明了 2 条列轨，组件 card 的 span 不能超过 2/,
        mutate: (document) => {
          firstComponent(document, 0, 1).layout.span = 3;
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 数据源
  {
    id: 'inline-rows-contract',
    description: 'inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）',
    valid: ['inline-report', 'mixed-page', 'compute-page', 'params-page', 'composite-page', 'forecast-page'],
    cases: [
      {
        case: 'inline-row-undeclared-field',
        base: 'inline-report',
        expect: /行包含未声明字段:extra/,
        mutate: (document) => {
          document.dataSources.overview.source.rows[0].extra = 1;
        }
      },
      {
        case: 'inline-row-missing-field',
        base: 'forecast-page',
        expect: /行缺少字段:yoy/,
        mutate: (document) => {
          delete document.dataSources.current.source.rows[0].yoy;
        }
      },
      {
        case: 'inline-row-null-not-allowed',
        base: 'compute-page',
        expect: /字段 region 声明 nullable=false,不允许为 null/,
        mutate: (document) => {
          document.dataSources.targets.source.rows[0].region = null;
        }
      },
      {
        case: 'inline-row-type-mismatch',
        base: 'inline-report',
        expect: /字段 gmv 的值不符合类型 number/,
        mutate: (document) => {
          document.dataSources.overview.source.rows[0].gmv = 'a lot';
        }
      },
      {
        case: 'inline-row-date-invalid',
        base: 'forecast-page',
        expect: /字段 day 的值不符合类型 date/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].day = '2026-6-15';
        }
      },
      {
        case: 'inline-row-datetime-invalid',
        base: 'forecast-page',
        expect: /字段 at 的值不符合类型 datetime/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].at = '2026-06-15 10:00';
        }
      },
      {
        case: 'inline-row-semantic-html-type',
        base: 'forecast-page',
        expect: /字段 body 的值不符合类型 semanticHtml/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].body = 123;
        }
      },
      {
        case: 'inline-row-detail-undeclared-field',
        base: 'forecast-page',
        expect: /嵌套明细项包含未声明字段:extra/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].extra = 'x';
        }
      },
      {
        case: 'inline-row-detail-missing-field',
        base: 'forecast-page',
        expect: /嵌套明细项缺少字段:value/,
        mutate: (document) => {
          delete document.dataSources.notes.source.rows[0].items[0].value;
        }
      },
      {
        case: 'inline-row-detail-null-not-allowed',
        base: 'forecast-page',
        expect: /嵌套明细项字段 value 声明 nullable=false,不允许为 null/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].value = null;
        }
      },
      {
        case: 'inline-row-detail-type-mismatch',
        base: 'forecast-page',
        expect: /嵌套明细项字段 value 的值不符合类型 number/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].value = '3';
        }
      }
    ]
  },
  {
    id: 'detail-item-object',
    description: '嵌套明细的每一项必须是对象；inline 在结构层拒绝，查询原始初始行在归一化层拒绝',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'initial-row-detail-item-not-object',
        base: 'compute-page',
        expect: /必须是对象/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].events = ['续约'];
        }
      },
      {
        case: 'inline-row-detail-item-not-object',
        base: 'forecast-page',
        expect: /must be object|必须是对象/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items = ['续约'];
        }
      }
    ]
  },
  {
    id: 'detail-list-max-items',
    description: '嵌套明细最多 100 项；inline 在结构层拒绝，查询原始初始行在归一化层拒绝',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'initial-row-detail-list-too-large',
        base: 'compute-page',
        expect: /最多允许 100 项/,
        mutate: (document) => {
          const row = document.dataSources.customers.source.initial.rows[0];
          row.events = Array.from({ length: 101 }, (_unused, index) => ({
            event_title: `e${index}`,
            event_impact: index,
            event_desc: null
          }));
        }
      },
      {
        case: 'inline-row-detail-list-too-large',
        base: 'forecast-page',
        expect: /must NOT have more than 100 items|最多允许 100 项/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items = Array.from(
            { length: 101 },
            (_unused, index) => ({ name: `n${index}`, value: index })
          );
        }
      }
    ]
  },
  {
    id: 'captured-at-valid',
    description: '内嵌初始行的 capturedAt 须为有效的 RFC 3339 日期时间',
    valid: ['filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page'],
    cases: [
      {
        case: 'captured-at-invalid-month',
        base: 'filters-page',
        expect: /capturedAt 必须是有效的 RFC 3339 日期时间/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.capturedAt = '2026-13-01T00:00:00Z';
        }
      }
    ]
  },
  {
    id: 'query-field-mapping',
    description: 'query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射',
    valid: ['query-dashboard', 'mixed-page', 'filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page'],
    cases: [
      {
        case: 'query-field-without-mapping',
        base: 'filters-page',
        expect: /既没有 queryField 映射，也不是计算阶段产出字段/,
        mutate: (document) => {
          document.dataSources.orders.fields.extra = { type: 'number', role: 'measure' };
        }
      },
      {
        case: 'query-field-duplicate-mapping',
        base: 'filters-page',
        expect: /queryField region 已映射到页面字段 region/,
        mutate: (document) => {
          document.dataSources.orders.fields.city.queryField = 'region';
        }
      },
      {
        case: 'query-field-not-output',
        base: 'query-dashboard',
        expect: /不在 DQE 输出字段中/,
        mutate: (document) => {
          document.dataSources.sales.fields.gmv.queryField = 'unknown';
        }
      },
      {
        case: 'query-detail-item-duplicate-mapping',
        base: 'compute-page',
        expect: /嵌套明细 queryField event_title 已映射到页面字段 title/,
        mutate: (document) => {
          document.dataSources.customers.fields.events.items.fields.desc.queryField = 'event_title';
        }
      },
      {
        case: 'query-dimension-role-mismatch',
        base: 'filters-page',
        expect: /DQE 维度 city 的 role 必须为 dimension/,
        mutate: (document) => {
          document.dataSources.orders.fields.city.role = 'measure';
        }
      },
      {
        case: 'query-role-mismatch',
        base: 'query-dashboard',
        expect: /DQE 度量 gmv 的 role 必须为 measure/,
        mutate: (document) => {
          document.dataSources.sales.fields.gmv.role = 'dimension';
        }
      },
      {
        case: 'query-output-unmapped',
        base: 'query-dashboard',
        expect: /DQE 输出字段 uv 缺少显式 queryField 映射/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].output_metrics.push('uv');
        }
      }
    ]
  },
  {
    id: 'filter-binding',
    description:
      '筛选绑定引用已声明筛选器，time / dimension 目标类型匹配，层级绑定逐级声明谓词字段',
    valid: ['query-dashboard', 'filters-page', 'map-page', 'hierarchy-binding-page'],
    cases: [
      {
        case: 'level-query-fields-on-flat-filter',
        base: 'hierarchy-binding-page',
        expect: /levelQueryFields 只能绑定层级维度筛选器:area/,
        mutate: (document) => {
          delete document.filters[0].hierarchy;
          delete document.filters[0].defaultLevel;
        }
      },
      {
        case: 'level-query-fields-missing-level',
        base: 'hierarchy-binding-page',
        expect: /层级 office 缺少谓词字段/,
        mutate: (document) => {
          delete document.dataSources.sales.source.query.filterBindings.area
            .levelQueryFields.office;
        }
      },
      {
        case: 'level-query-fields-undeclared-level',
        base: 'hierarchy-binding-page',
        expect: /筛选器 area 未声明层级:country/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings.area.levelQueryFields.country =
            'country_code';
        }
      },
      {
        case: 'hierarchy-filter-flat-query-field',
        base: 'map-page',
        expect: /层级维度筛选器必须用 levelQueryFields 逐级声明谓词字段:area/,
        mutate: (document) => {
          document.dataSources.regions.source.query.filterBindings.area = {
            target: 'dimension',
            queryField: 'code'
          };
        }
      },
      {
        case: 'time-point-target-not-time-point',
        base: 'non-dimension-bindings-page',
        expect: /timePoint 目标必须绑定 timePoint 筛选器:only-key/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings['only-key'] = {
            target: 'timePoint',
            queryField: 'stat_month'
          };
        }
      },
      {
        case: 'boolean-target-not-boolean',
        base: 'non-dimension-bindings-page',
        expect: /boolean 目标必须绑定 boolean 筛选器:amount-range/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings['amount-range'] = {
            target: 'boolean',
            queryField: 'is_key',
            whenTrue: ['true']
          };
        }
      },
      {
        case: 'number-range-target-not-number-range',
        base: 'non-dimension-bindings-page',
        expect: /numberRange 目标必须绑定 numberRange 筛选器:only-key/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings['only-key'] = {
            target: 'numberRange',
            metric: 'amount'
          };
        }
      },
      {
        case: 'time-point-initial-param-not-times',
        base: 'non-dimension-bindings-page',
        expect: /时间点筛选初值必须引用必需的 times 参数/,
        mutate: (document) => {
          document.params = { display: [{ id: 'report-month', type: 'string', value: '2026-07' }] };
        }
      },
      {
        case: 'time-point-initial-param-precision',
        base: 'non-dimension-bindings-page',
        expect: /时间点筛选初值的参数精度必须与筛选器一致/,
        mutate: (document) => {
          Object.assign(document.params.query.times[0], {
            granularity: 'date',
            start: '2026-07-01',
            end: '2026-07-01'
          });
        }
      },
      {
        case: 'time-point-initial-param-range',
        base: 'non-dimension-bindings-page',
        expect: /时间点筛选初值要求参数是单点/,
        mutate: (document) => {
          document.params.query.times[0].end = '2026-09';
        }
      },
      {
        case: 'time-point-initial-param-and-default',
        base: 'non-dimension-bindings-page',
        expect: /参数初始化与筛选default互斥/,
        mutate: (document) => {
          document.filters[0].default = '2026-07';
        }
      },
      {
        case: 'time-point-initial-param-without-query-target',
        base: 'non-dimension-bindings-page',
        expect: /参数初始化筛选必须具有匹配的显式查询目标/,
        mutate: (document) => {
          delete document.dataSources.sales.source.query.filterBindings.month;
        }
      },
      {
        case: 'unknown-filter-binding',
        base: 'query-dashboard',
        expect: /筛选绑定引用了未知筛选器:unknown/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings.unknown = {
            target: 'dimension',
            queryField: 'region'
          };
        }
      },
      {
        case: 'filter-binding-time-target-not-time-range',
        base: 'filters-page',
        expect: /time 目标必须绑定 timeRange 筛选器:city/,
        mutate: (document) => {
          document.dataSources.orders.source.query.filterBindings.city = { target: 'time' };
        }
      },
      {
        case: 'filter-binding-dimension-target-not-dimension',
        base: 'filters-page',
        expect: /dimension 目标必须绑定维度筛选器:period/,
        mutate: (document) => {
          document.dataSources.orders.source.query.filterBindings.period = {
            target: 'dimension',
            queryField: 'region'
          };
        }
      }
    ]
  },
  {
    id: 'compute-operator-inputs',
    description: '算子引用的字段已声明、角色相容、数值算子输入为数值类型',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-undeclared-field',
        base: 'compute-page',
        expect: /算子引用了未声明的字段:missing/,
        mutate: (document) => {
          document.dataSources.targets.compute[0].numerator = 'missing';
        }
      },
      {
        case: 'compute-role-mismatch',
        base: 'compute-page',
        expect: /字段 region 的 role 为 dimension，此处要求 measure/,
        mutate: (document) => {
          document.dataSources.targets.compute[0].numerator = 'region';
        }
      },
      {
        case: 'compute-non-numeric-input',
        base: 'compute-page',
        expect: /字段 flag 的类型 boolean 不能参与数值算子/,
        mutate: (document) => {
          document.dataSources.targets.fields.flag = { type: 'boolean', role: 'measure' };
          document.dataSources.targets.source.rows.forEach((row: Doc) => {
            row.flag = true;
          });
          document.dataSources.targets.compute[1].minuend = 'flag';
        }
      }
    ]
  },
  {
    id: 'compute-operator-outputs',
    description: '算子产出字段已声明、不重名、不来自外部响应',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-duplicate-output',
        base: 'compute-page',
        expect: /算子产出字段重复:rate/,
        mutate: (document) => {
          document.dataSources.targets.compute[1].output = 'rate';
        }
      },
      {
        case: 'compute-output-with-query-field',
        base: 'compute-page',
        expect: /算子产出字段 online 不来自外部响应，不得声明 queryField/,
        mutate: (document) => {
          document.dataSources.pivoted.fields.online.queryField = 'online';
          document.dataSources.pivoted.source.initial.rows[0].online = 5;
        }
      }
    ]
  },
  {
    id: 'compute-folding-collapsible',
    description: '折叠算子只能作用于显式声明 collapsible 的度量字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-fold-non-collapsible',
        base: 'compute-page',
        expect: /折叠算子只能作用于显式声明 collapsible 的度量字段:actual/,
        mutate: (document) => {
          delete document.dataSources.targets.fields.actual.collapsible;
        }
      }
    ]
  },
  {
    id: 'compute-row-kind-field',
    description: '行类别字段必须是可空的 string 维度',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-row-kind-not-string',
        base: 'compute-page',
        expect: /行类别字段 row-kind 必须是 string 类型/,
        mutate: (document) => {
          document.dataSources.targets.fields['row-kind'].type = 'number';
        }
      },
      {
        case: 'compute-row-kind-not-nullable',
        base: 'compute-page',
        expect: /行类别字段 row-kind 在明细行上没有取值，必须允许为空/,
        mutate: (document) => {
          document.dataSources.targets.fields['row-kind'].nullable = false;
        }
      }
    ]
  },
  {
    id: 'compute-pivot-categories-unique',
    description: '透视类别取值只能映射到一个目标列',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-pivot-duplicate-category',
        base: 'compute-page',
        expect: /类别取值已映射到其它目标列:线上/,
        mutate: (document) => {
          document.dataSources.pivoted.compute[0].columns[1].categories.push('线上');
        }
      }
    ]
  },
  {
    id: 'compute-output-not-in-rows',
    description: '算子产出字段不得出现在数据行中',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-output-in-inline-rows',
        base: 'compute-page',
        expect: /算子产出字段 rate 不得出现在数据行中/,
        mutate: (document) => {
          document.dataSources.targets.source.rows[0].rate = 1.2;
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 组件绑定
  {
    id: 'data-slot-known-source',
    description: '组件数据槽只能引用已声明的页面数据源',
    valid: ALL_VALID,
    cases: [
      {
        case: 'data-slot-unknown-source',
        base: 'inline-report',
        expect: /数据槽 main 引用了未知数据源:nope/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data.main = 'nope';
        }
      }
    ]
  },
  {
    id: 'field-binding-resolves',
    description: '字段绑定引用组件已声明的数据槽与数据源中存在的字段',
    valid: ALL_VALID,
    cases: [
      {
        case: 'field-binding-undeclared-slot',
        base: 'inline-report',
        expect: /字段绑定引用了组件未声明的数据槽:compare/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.rows[0].valueField = { data: 'compare', field: 'gmv' };
        }
      },
      {
        case: 'unknown-component-field',
        base: 'query-dashboard',
        expect: /字段 unknown 不在数据槽 main 的数据源 sales 中/,
        mutate: (document) => {
          firstComponent(document).props.columns[1].field = 'unknown';
        }
      }
    ]
  },
  {
    id: 'field-binding-role',
    description: '字段绑定的角色符合组件属性要求',
    valid: ALL_VALID,
    cases: [
      {
        case: 'field-binding-role-mismatch',
        base: 'mixed-page',
        expect: /字段 gmv 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.xField = { data: 'main', field: 'gmv' };
        }
      }
    ]
  },
  {
    id: 'detail-field-consumption',
    description: '嵌套明细字段只能由显式支持 detail 的组件属性消费',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'detail-field-in-generic-binding',
        base: 'forecast-page',
        expect: /嵌套明细字段 items 只能由显式支持 detail 的组件属性消费/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'note-panel',
            type: 'keyValuePanel',
            layout: { span: 4 },
            data: { main: 'notes' },
            props: { items: [{ label: '明细', field: 'items' }] }
          });
        }
      },
      {
        case: 'record-list-in-table-column',
        base: 'compute-page',
        expect: /此组件属性只支持 semanticHtml 类型的 detail 字段:events/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data = { main: 'customers' };
          firstComponent(document, 0, 1).props.columns = [{ field: 'name' }, { field: 'events' }];
        }
      }
    ]
  },
  {
    id: 'field-binding-match',
    description: '行匹配字段必须是 dimension，匹配值符合其类型',
    valid: ['composite-page'],
    cases: [
      {
        case: 'match-field-unknown',
        base: 'composite-page',
        expect: /字段 missing 不在数据槽 main 的数据源 summary 中/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.field =
            'missing';
        }
      },
      {
        case: 'match-field-not-dimension',
        base: 'composite-page',
        expect: /行匹配字段 share 的 role 必须为 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.field =
            'share';
        }
      },
      {
        case: 'match-value-type-mismatch',
        base: 'composite-page',
        expect: /匹配值不符合字段 channel 的类型 string/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.equals = 1;
        }
      }
    ]
  },
  {
    id: 'ai-summary-related-data',
    description: 'AI 总结关联数据引用已声明数据源中的非明细字段，不重复且术语一致',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'ai-summary-unknown-source',
        base: 'forecast-page',
        expect: /关联数据引用了未知数据源:nope/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.source = 'nope';
        }
      },
      {
        case: 'ai-summary-unknown-field',
        base: 'forecast-page',
        expect: /关联字段 nope 不在数据源 current 中/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.fields[0].field = 'nope';
        }
      },
      {
        case: 'ai-summary-detail-field',
        base: 'forecast-page',
        expect: /AI 总结暂不支持嵌套明细字段:items/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi = {
            source: 'notes',
            description: '说明',
            fields: [{ field: 'items', term: '明细' }]
          };
        }
      },
      {
        case: 'ai-summary-duplicate-field',
        base: 'forecast-page',
        expect: /关联字段重复:gmv/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.fields.push({ field: 'gmv', term: '成交额' });
        }
      },
      {
        case: 'ai-summary-term-conflict',
        base: 'forecast-page',
        expect: /关联字段 gmv 的术语映射冲突:成交额\/销售额/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.other = {
            source: 'current',
            description: '再引一次',
            fields: [{ field: 'gmv', term: '销售额' }]
          };
        }
      }
    ]
  },
  {
    id: 'metric-row-link-needs-navigate',
    description: '指标行声明 link 时组件必须至少有一个 navigate 动作',
    valid: ['composite-page'],
    cases: [
      {
        case: 'metric-row-link-without-navigate',
        base: 'composite-page',
        expect: /指标值链接必须至少声明一个 navigate 或 openDetail 动作/,
        mutate: (document) => {
          delete firstComponent(document, 0, 1).props.components[0].props.actions;
        }
      }
    ]
  },
  {
    id: 'bar-forecast-boundary',
    description: '实际 / 预测系列不得跨越采集时间所在月',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'forecast-before-captured-month',
        base: 'forecast-page',
        expect: /6月为统计月及之前不得提供预测系列 forecast/,
        mutate: (document) => {
          document.dataSources.monthly.source.initial.rows[1].forecast = 13;
        }
      },
      {
        case: 'actual-after-captured-month',
        base: 'forecast-page',
        expect: /7月为统计月之后不得提供实际系列 actual/,
        mutate: (document) => {
          document.dataSources.monthly.source.initial.rows[2].actual = 14;
        }
      }
    ]
  },
  {
    id: 'table-row-key',
    description: '多数据槽表格必须声明各槽都有且类型一致的 dimension rowKey',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'table-multi-slot-without-row-key',
        base: 'forecast-page',
        expect: /多数据槽表格必须声明 rowKey/,
        mutate: (document) => {
          delete firstComponent(document, 0, 2).props.rowKey;
        }
      },
      {
        case: 'table-row-key-missing-in-slot',
        base: 'forecast-page',
        expect: /数据槽 compare 的数据源 previous 缺少 rowKey 字段:yoy/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.rowKey = 'yoy';
        }
      },
      {
        case: 'table-row-key-not-dimension',
        base: 'forecast-page',
        expect: /rowKey 字段 gmv 的 role 必须为 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.rowKey = 'gmv';
        }
      },
      {
        case: 'table-row-key-type-inconsistent',
        base: 'forecast-page',
        expect: /rowKey 字段 key 的类型必须一致:string\/number/,
        mutate: (document) => {
          document.dataSources.previous.fields.key.type = 'number';
          document.dataSources.previous.source.rows[0].key = 1;
        }
      }
    ]
  },
  {
    id: 'table-row-kind-field',
    description: '表格行类别字段必须存在且由该数据源的折叠算子写入',
    valid: ['compute-page'],
    cases: [
      {
        case: 'table-row-kind-field-unknown',
        base: 'compute-page',
        expect: /行类别字段 kind 不在数据源 targets 中/,
        mutate: (document) => {
          firstComponent(document).props.rowKindField = 'kind';
        }
      },
      {
        case: 'table-row-kind-field-not-written',
        base: 'compute-page',
        expect: /行类别字段 region 没有任何折叠算子写入/,
        mutate: (document) => {
          firstComponent(document).props.rowKindField = 'region';
        }
      }
    ]
  },
  {
    id: 'table-merge-by-column',
    description: 'mergeBy 必须是表格已声明的列字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'table-merge-by-not-column',
        base: 'compute-page',
        expect: /mergeBy 必须是表格已声明的列字段:row-kind/,
        mutate: (document) => {
          firstComponent(document).props.mergeBy = 'row-kind';
        }
      }
    ]
  },
  {
    id: 'table-selection-writes',
    description: '单元格选择只能写入已声明的 dimension 筛选器',
    valid: ['filters-page'],
    cases: [
      {
        case: 'table-selection-writes-unknown-filter',
        base: 'filters-page',
        expect: /写入了未声明的筛选器:country/,
        mutate: (document) => {
          firstComponent(document).props.columns[0].selection.writes.country = { value: 'CN' };
        }
      },
      {
        case: 'table-selection-writes-non-dimension',
        base: 'filters-page',
        expect: /单元格选择只能写入 dimension 筛选器:keyword/,
        mutate: (document) => {
          firstComponent(document).props.columns[0].selection.writes.keyword = { value: '华' };
        }
      }
    ]
  },
  {
    id: 'table-column-binding-unique',
    description: '表格列字段绑定不重复',
    valid: ['query-dashboard', 'filters-page', 'compute-page', 'forecast-page'],
    cases: [
      {
        case: 'table-duplicate-column-binding',
        base: 'query-dashboard',
        expect: /表格列字段绑定重复:main:region/,
        mutate: (document) => {
          firstComponent(document).props.columns.push({ field: { data: 'main', field: 'region' } });
        }
      }
    ]
  },
  {
    id: 'table-filterable-dimension',
    description: '表头筛选只能声明在 dimension 列上',
    valid: ['filters-page'],
    cases: [
      {
        case: 'table-filterable-on-measure',
        base: 'filters-page',
        expect: /字段 orders 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document).props.columns[4].filterable = { mode: 'select' };
        }
      }
    ]
  },
  {
    id: 'category-swatches-need-pie',
    description: '分类明细开启色点要求同页有饼图绑定同一类别字段',
    valid: ['composite-page'],
    cases: [
      {
        case: 'category-swatches-without-pie',
        base: 'composite-page',
        expect: /没有配对的饼图/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.splice(1, 1);
        }
      }
    ]
  },
  {
    id: 'map-legend-bands-increasing',
    description: '地图图例档位下界严格递增',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-legend-bands-not-increasing',
        base: 'map-page',
        expect: /图例档位下界必须严格递增:第 2 档 0 不大于第 1 档 0/,
        mutate: (document) => {
          firstComponent(document).props.legend.bands[1].from = 0;
        }
      }
    ]
  },
  {
    id: 'map-pinned-summary',
    description: '固定地域摘要只用于 regionalOverview，匹配值符合类型，标签不重复',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-pinned-summary-wrong-variant',
        base: 'map-page',
        expect: /pinnedSummary 只能用于 variant: regionalOverview 的地图/,
        mutate: (document) => {
          delete firstComponent(document).props.variant;
        }
      },
      {
        case: 'map-pinned-summary-match-value-type',
        base: 'map-page',
        expect: /匹配值不符合字段 code 的类型 string/,
        mutate: (document) => {
          firstComponent(document).props.pinnedSummary.matchValue = 310000;
        }
      },
      {
        case: 'map-pinned-summary-duplicate-label',
        base: 'map-page',
        expect: /地域摘要字段标签重复:GMV/,
        mutate: (document) => {
          firstComponent(document).props.pinnedSummary.fields[1].label = 'GMV';
        }
      }
    ]
  },
  {
    id: 'map-hierarchy',
    description: '地图下钻字段只与 hierarchyFilter 一起使用，目标是声明了 hierarchy 的维度筛选器',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-level-fields-without-hierarchy-filter',
        base: 'map-page',
        expect: /levelField 只能与 hierarchyFilter 一起使用/,
        mutate: (document) => {
          delete firstComponent(document).props.hierarchyFilter;
        }
      },
      {
        case: 'map-hierarchy-filter-undeclared',
        base: 'map-page',
        expect: /地图下钻引用了未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.hierarchyFilter = 'nope';
        }
      },
      {
        case: 'map-hierarchy-filter-not-hierarchical',
        base: 'map-page',
        expect: /地图下钻目标必须是声明了 hierarchy 的维度筛选器:keyword/,
        mutate: (document) => {
          firstComponent(document).props.hierarchyFilter = 'keyword';
        }
      },
      {
        case: 'map-level-maps-unknown-level',
        base: 'map-page',
        expect: /levelMaps 引用了筛选器 area 未声明的层级:country/,
        mutate: (document) => {
          firstComponent(document).props.levelMaps.country = 'world';
        }
      }
    ]
  },
  {
    id: 'tab-container',
    description: 'Tab id 唯一且 defaultTab 已声明',
    valid: ['composite-page'],
    cases: [
      {
        case: 'tab-id-duplicate',
        base: 'composite-page',
        expect: /Tab id 重复:top/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.tabs[1].id = 'top';
        }
      },
      {
        case: 'tab-default-unknown',
        base: 'composite-page',
        expect: /defaultTab 不是已声明的 Tab:none/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.defaultTab = 'none';
        }
      }
    ]
  },
  {
    id: 'ranking-detail-semantic-description',
    description: '语义 HTML 说明必须绑定 semanticHtml 类型的 detail 字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'ranking-semantic-description-not-detail',
        base: 'compute-page',
        expect: /字段 note 的 role 为 dimension，此处要求 detail/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.semanticDescriptionField = 'note';
        }
      },
      {
        case: 'ranking-semantic-description-record-list',
        base: 'compute-page',
        expect: /语义 HTML 说明必须绑定 semanticHtml 字段:events/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.semanticDescriptionField = 'events';
        }
      }
    ]
  },
  {
    id: 'ranking-detail-records',
    description: '结构化明细必须绑定 recordList 字段，项字段存在且角色相容',
    valid: ['compute-page'],
    cases: [
      {
        case: 'ranking-details-not-record-list',
        base: 'compute-page',
        expect: /结构化明细必须绑定 recordList 字段:reason/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.field = 'reason';
        }
      },
      {
        case: 'ranking-details-item-field-unknown',
        base: 'compute-page',
        expect: /嵌套明细字段 events 不包含项字段:owner/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.titleField = 'owner';
        }
      },
      {
        case: 'ranking-details-item-role-mismatch',
        base: 'compute-page',
        expect: /嵌套明细项字段 impact 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.titleField = 'impact';
        }
      }
    ]
  },
  {
    id: 'actions-live-only',
    description: '旧版本writeFilter只允许query组件；6.35的本地入口必须有查询或显隐消费方',
    valid: ['query-dashboard', 'filters-page', 'params-page', 'composite-page', 'map-page'],
    cases: [
      {
        case: 'write-filter-on-inline-component',
        base: 'filters-page',
        expect: /writeFilter 只允许绑定 query 数据源的组件/,
        mutate: (document) => {
          document.dataSources.fixed = {
            fields: { region: { type: 'string', role: 'dimension' } },
            source: { type: 'inline', rows: [{ region: '华东' }] }
          };
          firstComponent(document).data = { main: 'fixed' };
          firstComponent(document).props.columns = [{ field: 'region' }];
          for(const source of Object.values(document.dataSources) as any[])if(source.source.type==='query')delete source.source.query.filterBindings;
        }
      }
    ]
  },
  {
    id: 'write-filter-target',
    description: '回写目标是已声明的 dimension 筛选器',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'write-filter-undeclared',
        base: 'query-dashboard',
        expect: /回写了未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.actions[0].writeFilter = 'nope';
        }
      },
      {
        case: 'write-filter-non-dimension',
        base: 'filters-page',
        expect: /回写目标必须是 dimension 筛选器:period/,
        mutate: (document) => {
          firstComponent(document).props.actions[0].writeFilter = 'period';
        }
      }
    ]
  },
  {
    id: 'navigation-filter-source',
    description: '导航绑定只能引用已声明的筛选器',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'navigation-filter-undeclared',
        base: 'filters-page',
        expect: /未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.actions[1].navigate.query.nope = {source:'filter',id:'nope'};
        }
      }
    ]
  },
  {
    id: 'pagination-local-inline',
    description: "pagination.mode='local' 只允许绑定 inline 或显式 complete 且无分页窗口的数据源",
    valid: ['composite-page'],
    cases: [
      {
        case: 'pagination-local-on-query',
        base: 'query-dashboard',
        expect: /pagination\.mode='local' 只允许绑定 inline 或显式 complete 且无分页窗口的数据源:sales/,
        mutate: (document) => {
          firstComponent(document).props.pagination = { mode: 'local', pageSize: 10 };
        }
      }
    ]
  },
  {
    id: 'pagination-query-source',
    description: "pagination.mode='query' 只允许绑定 query 数据源",
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-query-on-inline',
        base: 'composite-page',
        expect: /pagination\.mode='query' 只允许绑定 query 数据源:summary/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.tabs[1].components[0].props.pagination = { mode: 'query' };
        }
      }
    ]
  },
  {
    id: 'pagination-query-order',
    description: '查询分页要求 DQE order.offset 为 0 且 limit 为正整数',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-offset-not-zero',
        base: 'query-dashboard',
        expect: /查询分页要求 DQE order\.offset 为 0/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].order.offset = 20;
        }
      },
      {
        case: 'pagination-limit-not-positive',
        base: 'query-dashboard',
        expect: /查询分页要求 DQE order\.limit 为正整数/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].order.limit = 0;
        }
      }
    ]
  },
  {
    id: 'pagination-initial-rows',
    description: '查询分页的内嵌初始行必须声明 totalCount 且是完整第一页',
    valid: ['filters-page'],
    cases: [
      {
        case: 'pagination-initial-without-total-count',
        base: 'filters-page',
        expect: /查询分页的内嵌初始行必须声明 totalCount/,
        mutate: (document) => {
          delete document.dataSources.paged.source.initial.totalCount;
        }
      },
      {
        case: 'pagination-initial-not-full-page',
        base: 'filters-page',
        expect: /查询分页的内嵌初始行必须是完整第一页/,
        mutate: (document) => {
          document.dataSources.paged.source.initial.totalCount = 3;
        }
      }
    ]
  },
  {
    id: 'pagination-exclusive-source',
    description: '查询分页表格必须独占页面数据源',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-shared-source',
        base: 'query-dashboard',
        expect: /查询分页表格必须独占页面数据源 sales，当前引用 2 次/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'sales-pie',
            type: 'pieChart',
            layout: { span: 6 },
            data: { main: 'sales' },
            props: { categoryField: 'region', valueField: 'gmv' }
          });
        }
      }
    ]
  }
];

// Explicit negative witnesses for schema-shared component branches rejected by detail semantics.
invariants.push({id:"detail-view-component-types",description:"详情只允许说明、图表和表格；共享 Schema 其它组件分支有显式拒绝见证",valid:["detail-views"],cases:[
{case:"detail-component-reject-reportheader",base:"dimension-params-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="reportHeader"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-metriccard",base:"composite-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="metricCard"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-mapchart",base:"map-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="mapChart"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-tabcontainer",base:"composite-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="tabContainer"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-compositecard",base:"composite-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="compositeCard"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-rankingcard",base:"reference-variants-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="rankingCard"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-rankingdetailcard",base:"compute-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="rankingDetailCard"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-keyvaluepanel",base:"composite-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="keyValuePanel"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-categorybreakdown",base:"composite-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="categoryBreakdown"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-fieldtext",base:"compute-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="fieldText"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
{case:"detail-component-reject-aisummary",base:"forecast-page",expect:/详情只允许说明/,mutate(d){let selected:any;const visit=(c:any)=>{if(c.type==="aiSummary"&&!selected)selected=c;if(c.props?.components)c.props.components.forEach(visit);for(const t of c.props?.tabs??[])(t.components??[t.component]).forEach(visit);};d.sections.forEach((s:any)=>s.components.forEach(visit));const c=structuredClone(selected);const rename=(n:any)=>{n.id="detail-negative-"+n.id;if(n.props?.components)n.props.components.forEach(rename);for(const t of n.props?.tabs??[])(t.components??[t.component]).forEach(rename);};rename(c);d.schemaVersion="6.13";d.detailViews=[{id:"negative-detail",mode:"snapshot",components:[c]}];}},
]});

const detailButtonRule=invariants.find(rule=>rule.id==='detail-view-component-types');
detailButtonRule?.cases.push({case:'detail-component-reject-button',base:'reference-conditions-page',expect:/详情只允许说明/,mutate(document){
 const button=structuredClone(document.sections[0].components[0]);button.id='negative-detail-button';
 document.detailViews=[{id:'button-detail',mode:'snapshot',components:[button]}];
}});
