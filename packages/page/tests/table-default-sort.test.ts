import { expect, it } from 'vitest';
import { parsePage } from '../src';

function document() {
  return {
    schemaVersion:'6.108', id:'local-default-sort', layout:'dashboard',
    dataSources:{rows:{fields:{name:{type:'string',role:'dimension'}, score:{type:'number',role:'measure'}}, source:{type:'inline',rows:[{name:'A',score:2},{name:'B',score:4}]}}},
    sections:[{id:'main',components:[{id:'results',type:'table',layout:{span:12},data:{main:'rows'},props:{rowKey:'name',defaultSort:[{field:'score',direction:'desc'}],columns:[{field:'name'},{field:'score',sortable:true}],pagination:{mode:'local',pageSize:10}}}]}]
  };
}
it('accepts a local default ordering by final page fields', () => {
  expect(parsePage(document()).ok).toBe(true);
});
it.each(['unknown','duplicate','old-version','remote','empty','direction'])('rejects invalid local default ordering: %s', kind => {
  const input = document();
  const props = input.sections[0].components[0].props;
  if (kind === 'unknown') props.defaultSort[0].field = 'unknown';
  if (kind === 'duplicate') props.defaultSort.push({...props.defaultSort[0]});
  if (kind === 'old-version') input.schemaVersion = '6.107';
  if (kind === 'empty') props.defaultSort = [];
  if (kind === 'direction') props.defaultSort[0].direction = 'up';
  if (kind === 'remote') {
    const source = input.dataSources.rows as unknown as Record<string,unknown>;
    source.fields = {name:{type:'string',role:'dimension',queryField:'地区部'},score:{type:'number',role:'measure',queryField:'得分'}};
    source.source = {type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['地区部'],output_metrics:['得分']}]}}};
  }
  const parsed = parsePage(input);
  expect(parsed.ok).toBe(false);
  expect(parsed.errors.some(error => error.path.includes('defaultSort'))).toBe(true);
});
it('accepts an explicit complete query with computed final fields', () => {
  const input = document();
  const page = {...input,dataSources:{rows:{
    fields:{name:{type:'string',role:'dimension',queryField:'地区部'},raw:{type:'number',role:'measure',queryField:'得分'},score:{type:'number',role:'measure'}},
    source:{type:'query',resultScope:'complete',query:{language:'dqe',body:{dsl_list:[{output_dims:['地区部'],output_metrics:['得分']}]}}},
    compute:[{op:'sumFields',fields:['raw'],output:'score',onMissing:'zero'}]
  }}};
  expect(parsePage(page).ok).toBe(true);
});
