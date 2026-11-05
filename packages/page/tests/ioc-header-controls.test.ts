import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage,normalizePageDocument} from '../src/validate';
import {iocHeaderDeclaration} from '../src/header-binding';
import {standardIocRegionFilter} from '../src/ioc-header-controls';

const sample=()=>JSON.parse(readFileSync('pages/capabilities/ioc-header/controls/ioc-header-controls.json','utf8'));
describe('IOC Header controls',()=>{
  it('expands one Region for every consumer without mutating or rewriting compact source',()=>{
    const source=sample(),before=JSON.stringify(source),result=parsePage(source);
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.page.filters?.find(filter=>filter.id==='region')).toEqual(standardIocRegionFilter());
    expect(iocHeaderDeclaration(result.page)?.filterIds).toEqual(['stat-year','region']);
    expect(result.page.dataSources).toEqual(source.dataSources);
    expect(JSON.stringify(source)).toBe(before);
    expect(parsePage(result.page).ok).toBe(true);
    const normalized=normalizePageDocument(source);expect(normalized.ok).toBe(true);if(!normalized.ok)return;
    expect(normalized.document.filters).toEqual(source.filters);
    expect(normalized.document.sections[0].components[0]).toEqual(source.sections[0].components[0]);
  });
  it('keeps legacy controls, defaults and query bindings readable',()=>{
    const source=sample(),header=source.sections[0].components[0].props;
    delete header.components;header.filterIds=['stat-year','region'];source.filters.push(standardIocRegionFilter());source.schemaVersion='6.88';
    const parsed=parsePage(source);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    expect(parsed.page.filters).toEqual(source.filters);
    expect(parsed.page.dataSources).toEqual(source.dataSources);
  });
  it('points unknown filter references at the authored child',()=>{
    const source=sample();source.sections[0].components[0].props.components[0].props.filterId='missing';
    const parsed=parsePage(source);expect(parsed.ok).toBe(false);if(parsed.ok)return;
    expect(parsed.errors).toContainEqual(expect.objectContaining({path:'/sections/0/components/0/props/components/0'}));
  });
  it('does not create Region for a header containing only ordinary filters',()=>{
    const source=sample();source.sections[0].components[0].props.components.pop();delete source.dataSources.scope.source.query.filterBindings.region;
    const parsed=parsePage(source);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    expect(parsed.page.filters?.some(filter=>filter.id==='region')).toBe(false);
  });
  it.each([
    ['mixed lists',(d:any)=>d.sections[0].components[0].props.filterIds=['stat-year']],
    ['duplicate Region definition',(d:any)=>d.filters.push(standardIocRegionFilter())],
    ['duplicate public Region',(d:any)=>d.sections[0].components[0].props.components.push({id:'another-region',type:'regionFilter'})],
    ['duplicate component id',(d:any)=>d.sections[0].components[0].props.components[1].id='results'],
    ['unknown filter',(d:any)=>d.sections[0].components[0].props.components[0].props.filterId='missing'],
    ['hidden filter',(d:any)=>d.filters[0].visible=false],
    ['unknown child type',(d:any)=>d.sections[0].components[0].props.components[1].type='table'],
    ['old version',(d:any)=>d.schemaVersion='6.90']
  ])('rejects %s',(_name,change)=>{
    const source=sample();change(source);expect(parsePage(source).ok).toBe(false);
  });
});
