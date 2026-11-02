import {describe,expect,it} from 'vitest';
import document from '../../../pages/capabilities/table/record-join-query-params.json';
import legacy from '../fixtures/contract-valid/paged-join-page.json';
import {parsePage} from '../src';

describe('record join member query parameters',()=>{
  it('accepts independent domain and supplemental query parameters without mutating the page',()=>{
    const before=structuredClone(document);
    expect(parsePage(document).errors).toEqual([]);
    expect(document).toEqual(before);
  });
  it('accepts independent parameters in explicit query pagination records',()=>{
    const page=structuredClone(document),source=page.dataSources.joined.source;
    const {fallback:_fallback,records:_records,...rest}=source;
    const updated={...page,schemaVersion:'6.76',dataSources:{...page.dataSources,joined:{...page.dataSources.joined,source:{
      ...rest,pagination:{mode:'query',pageSize:2,batchSize:2},records:{maxBytes:67108864,timeoutMs:60000}
    }}}};
    expect(parsePage(updated).errors).toEqual([]);
  });
  it('keeps the all-member parameter requirement for non-record joins',()=>{
    const meeting=legacy.dataSources['office-meeting'];
    const page={...legacy,params:{query:{dimensions:[{id:'approver-name',dim_name:'审批人姓名',required:false}]}},
      dataSources:{...legacy.dataSources,'office-meeting':{...meeting,source:{...meeting.source,query:{...meeting.source.query,
        paramBindings:{'approver-name':{target:'dimension',queryField:'审批人姓名'}}
      }}}}};
    expect(parsePage(page).errors).toContainEqual(expect.objectContaining({message:'每个成员必须显式消费全部组合查询参数'}));
  });
  it('still rejects undeclared member query parameters',()=>{
    const page=structuredClone(document);
    page.params.query.dimensions=[];
    expect(parsePage(page).ok).toBe(false);
  });
  it('still requires members to consume shared business filters',()=>{
    const page={...document,filters:[{id:'region',type:'dimension',dimension:'region'}],
      dataSources:{...document.dataSources,decisions:{...document.dataSources.decisions,source:{...document.dataSources.decisions.source,query:{
        ...document.dataSources.decisions.source.query,filterBindings:{region:{target:'dimension',queryField:'地区部'}}
      }}}}};
    expect(parsePage(page).errors).toContainEqual(expect.objectContaining({message:'每个成员必须显式消费全部组合业务筛选'}));
  });
  it('accepts member-local inline object parameter references',()=>{
    const query=document.dataSources.decisions.source.query;
    const {paramBindings:_bindings,...rest}=query;
    const page={...document,params:{query:{dimensions:document.params.query.dimensions.map(p=>({...p,required:p.id==='approver-name'}))}},
      dataSources:{...document.dataSources,decisions:{...document.dataSources.decisions,source:{...document.dataSources.decisions.source,
        query:{...rest,body:{dsl_list:[{...query.body.dsl_list[0],filter:{fields:[{field_name:'审批人姓名',value_list:{param:'approver-name'},operator:'='}]}}]}}
      }}}};
    expect(parsePage(page).errors).toEqual([]);
  });
});
