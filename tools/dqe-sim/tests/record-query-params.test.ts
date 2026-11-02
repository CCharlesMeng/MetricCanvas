import {expect,it} from 'vitest';
import document from '../../../pages/capabilities/table/record-join-query-params.json';
import {executeDqeItem} from '../src/execute';

const main=()=>structuredClone(document.dataSources.decisions.source.query.body.dsl_list[0]);
it('serves the actual page object query with complete count, ordering and windows',()=>{
  const query={...main(),filter:{fields:[{field_name:'审批人姓名',value_list:['合成审批人甲'],operator:'='}]},order:{order_by_field:'审批顺序',type:'asc',offset:0,limit:2}};
  expect(executeDqeItem(query)).toMatchObject({code:'SUCCESS',total_count:3,data:[{'审批记录ID':'A-1'},{'审批记录ID':'A-2'}]});
  expect(executeDqeItem({...query,order:{...query.order,offset:2}})).toMatchObject({code:'SUCCESS',total_count:3,data:[{'审批记录ID':'A-4'}]});
});
it('handles supplemental keys and member-local owner conditions as ordinary DQE',()=>{
  const query=document.dataSources.basics.source.query.body.dsl_list[0];
  expect(executeDqeItem({...query,filter:{dims:[{dim_name:'商务ID',dim_value_list:['B-1','B-3']}],metrics:[]}}))
    .toMatchObject({code:'SUCCESS',total_count:1,data:[{'商务ID':'B-1','责任人名称':'合成责任人甲'}]});
});
it('does not widen unsupported object predicates or query signatures',()=>{
  expect(executeDqeItem({...main(),filter:{fields:[{field_name:'未知字段',value_list:['x'],operator:'='}]}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  expect(executeDqeItem({...main(),filter:{fields:[{field_name:'审批人姓名',value_list:['甲'],operator:'contains'}]}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  const basic=document.dataSources.basics.source.query.body.dsl_list[0];
  expect(executeDqeItem({...basic,filter:{dims:[],metrics:[{metric_name:'未知指标',operator:'>',value:1}]}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
it('returns empty matches and multiple requested names without changing the input',()=>{
  const query={...main(),filter:{fields:[{field_name:'审批人姓名',value_list:['没有匹配记录'],operator:'='}]}};
  const before=structuredClone(query);
  expect(executeDqeItem(query)).toMatchObject({code:'SUCCESS',total_count:0,data:[]});
  expect(query).toEqual(before);
  expect(executeDqeItem({...query,filter:{fields:[{field_name:'审批人姓名',value_list:['合成审批人甲','合成审批人乙'],operator:'='}]}})).toMatchObject({code:'SUCCESS',total_count:4});
});
