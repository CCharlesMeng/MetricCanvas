import pageWindow from '../../packages/page/fixtures/contract-valid/query-result-page-window-page.json';
/** Shared protocol vectors, exported for authoring and tested by both validators. */
export function queryResultCases(base: unknown) {
  const main = 'project-efficiency-bottom5', detail = `${main}-stages`;
  const cases: Array<{name: string; input: unknown; expected: {ok: boolean; path?: string}}> = [];
  function add(name: string, change: (page: any) => void, path?: string) {
    const input = structuredClone(base);
    change(input);
    cases.push({name, input, expected: {ok: path === undefined, ...(path ? {path} : {})}});
  }
  const bindingPath = `/dataSources/${detail}/source/query/resultBindings`;
  add('phased-query-and-compute', () => {});
  add('old-version', p => {p.schemaVersion = '6.13';}, '/dataSources/');
  add('unknown-source', p => {p.dataSources[detail].source.query.resultBindings[0].source = 'missing';}, bindingPath);
  add('computed-input', p => {p.dataSources[detail].source.query.resultBindings[0].field = 'rep-office-time';}, bindingPath);
  add('self-cycle', p => {p.dataSources[detail].source.query.resultBindings[0].source = detail;}, '/dataSources/');
  add('query-cycle', p => {p.dataSources[main].source.query.resultBindings = [{source: detail, field: 'commerce-id', target: 'dimension', queryField: 'x', maxValues: 5}];}, '/dataSources/');
  add('static-conflict', p => {p.dataSources[detail].source.query.body.dsl_list[0].filter.dims = [{dim_name: '商务编号', dim_value_list: ['A']}];}, bindingPath);
  add('repeated-binding', p => {p.dataSources[detail].source.query.resultBindings.push({...p.dataSources[detail].source.query.resultBindings[0]});}, bindingPath);
  add('offset-window', p => {p.dataSources[main].source.query.body.dsl_list[0].order.offset = 0;}, bindingPath);
  add('unbounded-input', p => {delete p.dataSources[main].source.query.body.dsl_list[0].order.limit;}, bindingPath);
  add('incomplete-detail', p => {delete p.dataSources[detail].source.resultScope;}, `/dataSources/${main}/compute`);
  add('wrong-pivot-unit', p => {p.dataSources[detail].fields['rep-office-count'].unit = '天';}, `/dataSources/${detail}/compute`);
  add('duplicate-pivot-measure-category', p => {delete p.dataSources[detail].compute[0].columns[1].valueField;}, `/dataSources/${detail}/compute`);
  add('max-values-zero', p => {p.dataSources[detail].source.query.resultBindings[0].maxValues = 0;}, bindingPath);
  add('max-values-over-hard-limit', p => {p.dataSources[detail].source.query.resultBindings[0].maxValues = 1001;}, bindingPath);
  const wherePath = `${bindingPath}/0/where`;
  function whereCase(name: string, where: unknown, path?: string, change?: (p: any) => void) {
    add(name, p => {p.schemaVersion = '6.19'; p.dataSources[detail].source.query.resultBindings[0].where = where; change?.(p);}, path);
  }
  whereCase('where-measure', {field:'decision-time',op:'gt',value:1});
  whereCase('where-nested', {all:[{field:'commerce-id',op:'in',values:['A','B']},{any:[{field:'decision-time',op:'isNull'},{field:'decision-time',op:'lte',value:0}]}]});
  whereCase('where-old-version', {field:'decision-time',op:'gt',value:1}, '/dataSources/', p=>{p.schemaVersion='6.18';});
  whereCase('where-unknown-field', {field:'absent',op:'eq',value:1}, wherePath);
  whereCase('where-computed-field', {field:'rep-office-time',op:'eq',value:1}, wherePath);
  whereCase('where-wrong-literal', {field:'decision-time',op:'eq',value:'1'}, wherePath);
  whereCase('where-mixed-set', {field:'commerce-id',op:'in',values:['A',1]}, wherePath);
  whereCase('where-string-order', {field:'commerce-id',op:'gt',value:1}, wherePath);
  whereCase('where-empty-group', {all:[]}, bindingPath);
  whereCase('where-empty-set', {field:'commerce-id',op:'in',values:[]}, bindingPath);
  whereCase('where-unknown-op', {field:'commerce-id',op:'contains',value:'A'}, bindingPath);
  whereCase('where-null-literal', {field:'commerce-id',op:'eq',value:null}, bindingPath);
  whereCase('where-extra-key', {field:'commerce-id',op:'eq',value:'A',expression:'x'}, bindingPath);
  whereCase('where-mixed-node', {all:[{field:'commerce-id',op:'isNull'}],field:'commerce-id',op:'isNull'}, bindingPath);
  const leaf = {field:'commerce-id',op:'eq',value:'A'};
  whereCase('where-max-depth', {all:[{all:[{all:[{all:[leaf]}]}]}]});
  whereCase('where-depth-overflow', {all:[{all:[{all:[{all:[{all:[leaf]}]}]}]}]}, wherePath);
  whereCase('where-leaf-overflow', {all:[{any:Array.from({length:64},()=>leaf)},leaf]}, wherePath);
  whereCase('where-set-overflow', {field:'commerce-id',op:'in',values:Array.from({length:1001},()=> 'A')}, bindingPath);
  function windowCase(name: string, change: (page: any) => void, path?: string) {
    const input = structuredClone(pageWindow);
    change(input);
    cases.push({name, input, expected:{ok:path === undefined, ...(path ? {path} : {})}});
  }
  windowCase('page-window', () => {});
  windowCase('page-window-old-version', p => {p.schemaVersion='6.19';}, '/dataSources/');
  windowCase('page-window-complete', p => {p.dataSources.projects.source.resultScope='complete';}, '/dataSources/');
  windowCase('page-window-no-limit', p => {delete p.dataSources.projects.source.query.body.dsl_list[0].order.limit;}, '/dataSources/');
  windowCase('page-window-nonzero-offset', p => {p.dataSources.projects.source.query.body.dsl_list[0].order.offset=10;}, '/dataSources/');
  windowCase('page-window-hidden-in-tab', p => {
    const section = p.sections.find((s:any) => s.components.some((c:any) => c.type==='table' && c.data.main==='projects'));
    const table = section.components.find((c:any) => c.type==='table' && c.data.main==='projects');
    section.components = section.components.filter((c:any) => c!==table);
    section.components.push({id:'paged-tab',type:'tabContainer',layout:{span:12},props:{tabs:[{id:'projects',label:'项目',component:table}]}});
  });
  return cases;
}
