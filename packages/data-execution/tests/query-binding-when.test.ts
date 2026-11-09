import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {QueryDataSource} from '@metriccanvas/page/internal';
import {createFilterBindingWhenPreview} from '../../../apps/playground/fixtures/filter-binding-when';
import {initialFilterValues} from '../src/filter-values';
import {composeEffectiveQuery} from '../src/effective-query';
import {createSourceProgram} from '../src/source-program/session';
import {compilePresentation} from '../../engine/runtime/src/presentation';

function setup(){
  const input=JSON.parse(readFileSync('pages/capabilities/filters/filter-binding-when.json','utf8'));
  const parsed=parsePage(input);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,values=initialFilterValues(page.filters??[]),preview=createFilterBindingWhenPreview();
  const compose=()=>composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},values,0,[],{});
  return {page,values,preview,compose};
}
describe('conditional dimension predicate execution',()=>{
  it('applies the same rule to all four governance charts without removing their controls',()=>{
    const parsed=parsePage(JSON.parse(readFileSync('pages/temporary/governance-compliance-20261027/governance-compliance.json','utf8')));
    if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const page=parsed.page,values=initialFilterValues(page.filters??[]);
    for(const id of ['decision-validity-trend','urgent-decision-trend','apply-norm-trend','contract-decision-trend']){
      const source=page.dataSources[id] as QueryDataSource;
      values.delete('region');
      expect(composeEffectiveQuery({page,filters:page.filters,dataSource:source},values,0,[],{}).filterValues).toContainEqual({target:'dimension',queryField:'国内或海外',values:['国内']});
      values.set('region',{type:'dimension',dimension:'region-dept-code',level:'region-dept',values:['海外地区部']});
      const query=composeEffectiveQuery({page,filters:page.filters,dataSource:source},values,0,[],{});
      expect(query.filterValues).not.toContainEqual(expect.objectContaining({queryField:'国内或海外'}));
      expect(query.filterValues).toContainEqual({target:'dimension',queryField:'地区部',values:['海外地区部']});
      expect(query.filterValues).toContainEqual(expect.objectContaining({target:'time'}));
    }
  });
  it('pauses the hidden predicate for a department/office and restores the retained global choice',()=>{
    const {page,values,compose}=setup(),presentation=compilePresentation(page);
    expect(compose().filterValues).toContainEqual({target:'dimension',queryField:'site',values:['国内']});
    values.set('site',{type:'dimension',dimension:'demo_site',values:['海外']});
    for(const level of ['dept','office']){
      values.set('region',{type:'dimension',dimension:'demo_dept',level,values:['海外地区部']});
      expect(presentation.evaluate({filters:values}).component('site-buttons').eligible).toBe(false);
      expect(compose().filterValues).not.toContainEqual(expect.objectContaining({queryField:'site'}));
      expect(values.get('site')).toMatchObject({values:['海外']});
    }
    values.delete('region');
    expect(presentation.evaluate({filters:values}).component('site-buttons').eligible).toBe(true);
    expect(compose().filterValues).toContainEqual({target:'dimension',queryField:'site',values:['海外']});
  });
  it('retains historical hidden-control filtering when the binding has no when',()=>{
    const {page,values,compose}=setup(),source=page.dataSources.offices as QueryDataSource;
    const binding=source.source.query.filterBindings!.site;if(binding.target!=='dimension')throw Error('dimension');
    delete binding.when;
    values.set('region',{type:'dimension',dimension:'demo_dept',level:'dept',values:['海外地区部']});
    expect(compose().filterValues).toContainEqual({target:'dimension',queryField:'site',values:['国内']});
  });
  it('rejects malformed runtime inputs instead of dropping a predicate on error',()=>{
    const {values,compose}=setup();
    values.set('region',{type:'dimension',dimension:'demo_geo',level:42 as unknown as string,values:[]});
    expect(compose).toThrow('查询绑定生效条件未就绪或无效');
  });
  it('does not reuse global initial data or captured conditions for scoped screen and complete reads',async()=>{
    const {page,values,preview}=setup(),source=page.dataSources.offices.source;
    if(source.type!=='query')throw Error('query');
    source.initial={capturedAt:'2026-11-09T00:00:00Z',rows:[{office:'旧数据',amount:999}],totalCount:1};
    const program=createSourceProgram(page,{gateway:preview.dataGateway});
    const captured=program.captureQueries(values,new Map(),new Map());
    values.set('region',{type:'dimension',dimension:'demo_dept',level:'dept',values:['海外地区部']});
    try{
      for(const purpose of ['screen','complete'] as const){
        const updates=[];
        for await(const update of program.read({roots:['offices'],conditions:values,purpose,freshness:'refresh',useInitial:true,queries:captured}))updates.push(update);
        expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',rows:[{office:'巴黎代表处',amount:20}]});
      }
      expect(preview.requests).toHaveLength(2);
      expect(preview.requests[1].filterValues).toEqual([{target:'dimension',queryField:'dept',values:['海外地区部']}]);
    }finally{program.dispose();}
  });
});
