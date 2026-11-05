import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {Page,QueryDataSource} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import type {FilterValue} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {createKeyOfficePriorityGateway} from '../../../apps/playground/fixtures/key-office-filter/gateway';

const raw=JSON.parse(readFileSync('pages/capabilities/filters/ioc-customer-query-field.json','utf8'));
function customerPage(id:string,component:boolean):Page {
  const document=structuredClone(raw);
  const header=document.sections[0].components[0].props;
  document.filters.find((filter:{id:string})=>filter.id==='customer-category').id=id;
  header.filterIds=header.filterIds.map((value:string)=>value==='customer-category'?id:value);
  const bindings=document.dataSources.offices.source.query.filterBindings;
  delete bindings['customer-category'];bindings[id]={target:'dimension',queryField:'客户类型'};
  if(!component){
    document.sections[0].components.shift();
    document.iocHeader=header;document.dashboardToolbar='hidden';
  }
  const result=parsePage(document);
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
function compose(page:Page,id:string,selected=true){
  const values=new Map<string,FilterValue>();
  if(selected)values.set(id,{type:'dimension',dimension:'customer-level',values:['战略']});
  return composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},values,0,[],{});
}

describe('IOC Header owns the customer query field',()=>{
  it.each(['customer-category','na-type','customer-type'])('fixes %s for component and legacy headers without mutating metadata',id=>{
    for(const component of [true,false]){
      const page=customerPage(id,component),before=JSON.stringify(page);
      expect(effectiveDqeItem(compose(page,id)).filter).toEqual({dims:[{dim_name:'客户级别',dim_value_list:['战略']}],metrics:[]});
      expect(JSON.stringify(page)).toBe(before);
      expect(compose(page,id,false).filterValues).toEqual([]);
    }
  });
  it('keeps explicitly configured fields for ordinary filters and unclaimed customer filters',()=>{
    const page=customerPage('customer-category',true);
    const header=page.sections[0].components[0];
    if(header.type!=='iocHeader')throw Error('Missing component header');
    header.props.filterIds=[];
    expect(compose(page,'customer-category').filterValues).toEqual([{target:'dimension',queryField:'客户类型',values:['战略']}]);
    page.sections[0].components.shift();
    expect(compose(page,'customer-category').filterValues).toEqual([{target:'dimension',queryField:'客户类型',values:['战略']}]);
  });
  it('recognizes customer controls declared through header components',()=>{
    const page=customerPage('customer-category',true),header=page.sections[0].components[0];
    if(header.type!=='iocHeader')throw Error('Missing component header');
    header.props.components=[{id:'customer-control',type:'filterControl',props:{filterId:'customer-category'}}];
    delete header.props.filterIds;
    expect(effectiveDqeItem(compose(page,'customer-category')).filter).toEqual({dims:[{dim_name:'客户级别',dim_value_list:['战略']}],metrics:[]});
  });
  it('uses the fixed field in screen and complete reads through the source program',async()=>{
    const page=customerPage('customer-category',true),queries:unknown[]=[];
    const gateway=createKeyOfficePriorityGateway((kind,request)=>{if(kind==='query')queries.push(request);});
    const program=createSourceProgram(page,{gateway});
    const conditions=new Map<string,FilterValue>([['customer-category',{type:'dimension',dimension:'customer-level',values:['战略']}]]);
    try{
      for(const purpose of ['screen','complete'] as const){
        const updates=[];
        for await(const update of program.read({roots:['offices'],conditions,purpose,freshness:'refresh'}))updates.push(update);
        expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',rows:[{office:'上海代表处'},{office:'广州代表处'}]});
      }
      expect(queries).toHaveLength(2);
      expect(JSON.stringify(queries)).toContain('客户级别');expect(JSON.stringify(queries)).not.toContain('客户类型');
    }finally{program.dispose();}
  });
});
