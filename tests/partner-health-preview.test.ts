import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import {applyComputation} from '../packages/data-execution/src/compute';
import {partnerHealthResult,createPartnerHealthPreview,partnerHealthPreviewGateway,type PartnerHealthQuery} from '../apps/playground/fixtures/partner-preview/gateway';
import {scoreMetrics} from '../apps/playground/fixtures/partner-preview/data';
import {pageExternalInputs} from '../apps/playground/fixtures/preview-inputs';

const document=JSON.parse(readFileSync('pages/temporary/partner-health.json','utf8'));
const parsed=parsePage(document);
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const source=parsed.page.dataSources['health-overview']!;
function query(dims:string[]=[],field='data_site_type',values=['中国区'],start='2026-10'):PartnerHealthQuery {
  return {output_dims:dims,output_metrics:scoreMetrics,filter:{dims:values.length?[{dim_name:field,dim_value_list:values}]:[],time:{start}}};
}
function computed(item:PartnerHealthQuery) {
  const response=partnerHealthResult(item);
  const rows=response.data.map(raw=>Object.fromEntries(Object.entries(source.fields).filter(([,field])=>'queryField' in field)
    .map(([id,field])=>[id,'queryField' in field && typeof field.queryField==='string'?raw[field.queryField]:null])));
  return applyComputation(source.compute!,rows);
}

describe('伙伴健康度完整预览使用页面协议',()=>{
 it('模拟原始指标与实际页面查询一致，由页面计算总分',()=>{
  expect(document.dataSources['health-overview'].source.query.body.dsl_list[0].output_metrics).toEqual(scoreMetrics);
  const raw=partnerHealthResult(query()).data[0]!;
  expect(raw).not.toHaveProperty('total-score');
  expect(computed(query())[0]).toMatchObject({'perception-score':25.5,'satisfaction-score':26,'risk-score':-2});
  expect(computed(query())[0]!['total-score']).toBeCloseTo(81.3);
  expect(computed(query([], 'data_site_type',['海外']))[0]!['total-score']).toBeCloseTo(70.8);
 });
 it('按地区部/代表处切分，组织筛选真正限制结果集合',()=>{
  expect(partnerHealthResult(query(['地区部'])).data.map(row=>row['地区部'])).toEqual(['华东地区部','华南地区部']);
  expect(partnerHealthResult(query(['地区部'],'data_site_type',[])).data).toHaveLength(4);
  expect(partnerHealthResult(query(['rep_office_name_cn_fin'],'地区部',['华东地区部'])).data.map(row=>row.rep_office_name_cn_fin)).toEqual(['上海代表处','杭州代表处']);
  expect(computed(query([],'rep_office_name_cn_fin',['上海代表处']))[0]!['total-score']).toBeCloseTo(89.4);
 });
 it('部分缺项和全部缺项经过真实页面compute归零；空范围不造行',()=>{
  expect(computed(query([],'rep_office_name_cn_fin',['广州代表处']))[0]!['csp-customer-payment-ratio']).toBe(0);
  expect(computed(query([],'rep_office_name_cn_fin',['智利代表处（全缺项示例）']))[0]).toMatchObject({'perception-score':0,'contribution-score':0,'total-score':0});
  expect(partnerHealthResult(query([],'地区部',['不存在'])).data).toEqual([]);
 });
 it('年份/月变化改变源分数；候选值来自同一组织字典',()=>{
  expect(computed(query([], 'data_site_type',['中国区'],'2026-09'))[0]!['total-score']).not.toBe(computed(query())[0]!['total-score']);
  expect(computed(query([], 'data_site_type',['中国区'],'2025-10'))[0]!['total-score']).not.toBe(computed(query())[0]!['total-score']);
  expect(partnerHealthResult({output_dims:['region_dept_name_cn'],output_metrics:[]}).data).toHaveLength(4);
  expect(partnerHealthResult({output_dims:['rep_office_name_cn_fin'],output_metrics:[]}).data).toHaveLength(8);
 });
 it('只在指定预览入口启用，不影响其他页面，不为未知查询伪造成功',async()=>{
  const fallback={async fetchData(){throw Error('unused')}};
  expect(partnerHealthPreviewGateway('other',fallback)).toBe(fallback);
  expect(pageExternalInputs('partner-health')).toBe('partner-preview');
  expect(partnerHealthResult({output_dims:[],output_metrics:['未知指标']}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  const controller=new AbortController();controller.abort();
  await expect(createPartnerHealthPreview().dataGateway.fetchDimensionValues('geo_pc_name_cn',{signal:controller.signal})).rejects.toMatchObject({code:'DQE_CANCELLED'});
 });
});
