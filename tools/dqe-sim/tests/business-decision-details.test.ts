import {expect,it} from 'vitest';
import document from '../../../pages/business/dashboard/ioc/commercial/business-decision-all-details.json';
import {executeDqeItem} from '../src/execute';

const main=()=>structuredClone(document.dataSources['decision-details'].source.query.body.dsl_list[0]);
it('filters the actual business object by approver and period before counting',()=>{
  const query={...main(),filter:{fields:[
    {field_name:'审批人姓名',value_list:['合成审批人甲'],operator:'='},
    {field_name:'审批完成时间',value_list:['2026-11-01 00:00:00'],operator:'>='},
    {field_name:'审批完成时间',value_list:['2026-11-30 23:59:59'],operator:'<='}
  ]},order:{order_by_field:'审批完成时间',type:'desc',offset:0,limit:10}};
  const before=structuredClone(query),result=executeDqeItem(query);
  expect(result).toMatchObject({code:'SUCCESS',total_count:24});
  expect(result.data).toHaveLength(10);
  expect(result.data.every(row=>row['审批人姓名']==='合成审批人甲')).toBe(true);
  expect(query).toEqual(before);
  expect(executeDqeItem({...query,filter:{fields:[{field_name:'审批人姓名',value_list:['合成审批人乙'],operator:'='}]}})).toMatchObject({code:'SUCCESS',total_count:6});
});
it('only supplements requested business keys and rejects unknown predicates',()=>{
  const query=document.dataSources['business-basic'].source.query.body.dsl_list[0];
  expect(executeDqeItem({...query,filter:{dims:[{dim_name:'商务ID',dim_value_list:['SIM-001','SIM-015']}],metrics:[]}}))
    .toMatchObject({code:'SUCCESS',total_count:1,data:[{'商务ID':'SIM-001','责任人名称':'合成责任人01'}]});
  expect(executeDqeItem({...main(),filter:{fields:[{field_name:'未知字段',value_list:['x']}]}}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  expect(executeDqeItem({...main(),filter:{fields:[{field_name:'审批人姓名',value_list:['不存在']}]}})).toMatchObject({code:'SUCCESS',total_count:0,data:[]});
});
