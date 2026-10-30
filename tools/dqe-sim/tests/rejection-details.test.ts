import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
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
it('serves the exact ten-row Playground page fields and keeps time filtering in both windows',()=>{
  const page=JSON.parse(readFileSync('pages/temporary/business-rejection-pagination-10/business-rejection-details-pagination-10.json','utf8'));
  const item=page.dataSources['rejection-details'].source.query.body.dsl_list[0];
  const filter={fields:[{field_name:'审批时间',operator:'>=',value_list:['2026-09-01 00:00:00']},{field_name:'审批时间',operator:'<=',value_list:['2026-09-30 23:59:59']}]};
  const first=executeRejectionDetails({...item,filter});
  const second=executeRejectionDetails({...item,filter,order:{...item.order,offset:10}});
  expect(first).toMatchObject({code:'SUCCESS',total_count:1205});
  expect(first?.data).toHaveLength(10);
  expect(second?.data).toHaveLength(10);
  expect(first?.data[0]).toMatchObject({'审批时间':'2026-09-28 12:00:00','审批人名称':'模拟评审组织人'});
  expect(first?.data).not.toEqual(second?.data);
});
