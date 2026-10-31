import {describe, expect, it} from 'vitest';
import {createDqeGateway} from '../packages/engine/data-gateway/src/dqe';
import type {EffectiveQuery} from '../packages/page/src/query';
import {createPartnerHealthPreview, partnerHealthResult} from './fixtures/partner-health/gateway';

describe('伙伴健康度粘贴页面的预览查询', () => {
  it('对象查询保留原始输出字段，不把它当成指标查询', () => {
    const result = partnerHealthResult({
      query_type:'object',object_type:'Partner Health/Partner Deduction Score',
      output_fields:['地区部','扣分']
    });
    expect(result.code).toBe('SUCCESS');
    expect(result.data).toContainEqual({'地区部':'华东地区部','扣分':-1});
    expect(result.data).toHaveLength(4);
  });

  it('代表处指标查询与对象查询使用相同的组织行键', () => {
    const metric = partnerHealthResult({output_dims:['代表处'],output_metrics:['伙伴声音闭环率得分']});
    const object = partnerHealthResult({query_type:'object',object_type:'Partner Health/Cooperate Willingness Score',output_fields:['代表处','合作意愿感知评分']});
    expect(metric.code).toBe('SUCCESS');
    expect(object.code).toBe('SUCCESS');
    expect(metric.data.map(row=>row['代表处'])).toEqual(object.data.map(row=>row['代表处']));
    expect(metric.data).toHaveLength(8);
    expect(object.data[0]).toEqual({'代表处':'上海代表处','合作意愿感知评分':23});
  });

  it('对象查询按声明的字段条件筛选，未知对象明确返回不支持', () => {
    expect(partnerHealthResult({query_type:'object',object_type:'Partner Health/Partner Core Income Score',output_fields:['地区部','收入得分'],
      filter:{fields:[{field_name:'geo_pc_name_cn',value_list:['海外']}]}}).data)
      .toEqual([{'地区部':'亚太地区部','收入得分':4},{'地区部':'拉美地区部','收入得分':3.2}]);
    expect(partnerHealthResult({query_type:'object',object_type:'unknown',output_fields:['地区部','扣分']}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
    expect(partnerHealthResult({query_type:'object',object_type:'Partner Health/Partner Deduction Score',output_fields:['未知字段']}).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  });

  it('指标和对象查询同批请求后均通过实际DQE字段归一化', async () => {
    const {dataGateway}=createPartnerHealthPreview();
    const fields={region:{queryField:'地区部',type:'string',role:'dimension'}} as const;
    const [metric, object]=await Promise.all([
      dataGateway.fetchData({language:'dqe',body:{dsl_list:[{output_dims:['地区部'],output_metrics:['伙伴声音闭环率得分']}]},
        fieldMappings:{...fields,voice:{queryField:'伙伴声音闭环率得分',type:'number',role:'measure'}},filterValues:[]}),
      dataGateway.fetchData({language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Partner Health/Partner Deduction Score',output_fields:['地区部','扣分']}]},
        fieldMappings:{...fields,risk:{queryField:'扣分',type:'number',role:'measure'}},filterValues:[]})
    ]);
    expect(metric.rows[0]).toEqual({region:'华东地区部',voice:4.4});
    expect(object.rows[0]).toEqual({region:'华东地区部',risk:-1});
    expect(metric.totalCount).toBe(4);
    expect(object.totalCount).toBe(4);
  });

  it('columns为null不影响映射，数值漏返置空，维度漏返仍失败', async () => {
    const gateway=createDqeGateway({fetchImpl:async ()=>Response.json({retCode:'CBC.0000',results:[
      {code:'SUCCESS',columns:null,data:[{'地区部':'华东地区部','客户对伙伴的评价得分':27}],total_count:1},
      {code:'SUCCESS',columns:null,data:[{'地区部':'华东地区部','错误别名':27}],total_count:1},
      {code:'SUCCESS',columns:null,data:[{'客户对伙伴的评价得分':27}],total_count:1}
    ]})});
    const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Partner Health/Custormer Partner Evaluation Score',output_fields:['地区部','客户对伙伴的评价得分']}]},
      fieldMappings:{region:{queryField:'地区部',type:'string',role:'dimension'},score:{queryField:'客户对伙伴的评价得分',type:'number',role:'measure'}},filterValues:[]};
    const first=gateway.fetchData({...query,body:{dsl_list:[{...query.body.dsl_list[0]}]},filterValues:[]});
    const second=gateway.fetchData({...query,body:{dsl_list:[{...query.body.dsl_list[0],order:{}}]},filterValues:[]});
    const third=gateway.fetchData({...query,body:{dsl_list:[{...query.body.dsl_list[0],filter:{fields:[]}}]},filterValues:[]});
    await expect(first).resolves.toEqual({rows:[{region:'华东地区部',score:27}],totalCount:1});
    await expect(second).resolves.toMatchObject({rows:[{region:'华东地区部',score:null}],totalCount:1,
      warnings:[{code:'MISSING_NUMERIC_QUERY_FIELD',fieldId:'score',queryField:'客户对伙伴的评价得分',count:1}]});
    await expect(third).rejects.toMatchObject({code:'DQE_FIELD_MAPPING_ERROR'});
  });
});
