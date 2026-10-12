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
  return cases;
}
