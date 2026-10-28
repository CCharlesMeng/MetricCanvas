import {expect,it} from 'vitest';
import {executeRejectionDetails,rejectionSimRows} from '../src/rejection-details';

const query=()=>({query_type:'object',object_type:'Business/Commercial Review Rejection Details',output_fields:['商务ID','审批完成时间','阶段名称'],filter:{fields:[] as unknown[]},order:{order_by_field:'商务ID',type:'asc',limit:500,offset:0}});
it('keeps this synthetic surface limited to the exact object and basic query signatures',()=>{
  expect(executeRejectionDetails({query_type:'object',object_type:'Other'})).toBeUndefined();
  expect(executeRejectionDetails({output_dims:['商务ID'],output_metrics:[]})).toBeUndefined();
  expect(executeRejectionDetails({...query(),output_fields:['未知字段']})).toMatchObject({code:'DQE_SIM_UNSUPPORTED_QUERY'});
});
it('returns complete count and paged raw records without collapsing repeated business IDs',()=>{
  expect(rejectionSimRows()).toHaveLength(1213);
  const result=executeRejectionDetails(query());
  expect(result).toMatchObject({code:'SUCCESS',total_count:1213});
  expect(result?.data).toHaveLength(500);
  expect(result?.data[0]['商务ID']).toBe(result?.data[1]['商务ID']);
  const next=executeRejectionDetails({...query(),order:{...query().order,offset:1000}});
  expect(next?.data).toHaveLength(213);
});
it('rejects unknown predicates and unsupported operators rather than broadening the mock scope',()=>{
  const input=query();input.filter.fields=[{field_name:'未知字段',value_list:['x']}];
  expect(executeRejectionDetails(input)).toMatchObject({code:'DQE_SIM_UNSUPPORTED_QUERY'});
  input.filter.fields=[{field_name:'商务ID',operator:'contains',value_list:['SIM']}];
  expect(executeRejectionDetails(input)).toMatchObject({code:'DQE_SIM_UNSUPPORTED_QUERY'});
});
