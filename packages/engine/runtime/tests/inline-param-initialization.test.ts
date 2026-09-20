import {expect,it} from 'vitest';
import fixture from '../../../page/fixtures/contract-valid/inline-params-page.json';
import legacy from '../../../page/fixtures/contract-valid/dimension-params-page.json';
import {parsePage,resolvePageParams as resolveDocument} from '@metriccanvas/page';
import {initializePageParams,resolvePageParams} from '../src/page-params';
import {effectiveDqeItem} from '../../data-gateway/src/dqe';

it('fails before a template can expose initial rows or produce a DQE request',()=>{
  const raw=structuredClone(fixture) as any;
  raw.dataSources.tokens.source.initial={capturedAt:'2026-01-01T00:00:00Z',rows:[{tokens:99}]};
  const parsed=parsePage(raw);if(!parsed.ok)throw Error('fixture');
  expect(()=>initializePageParams(parsed.page,new Map())).toThrow();
  const query=(parsed.page.dataSources.tokens.source as any).query;
  expect(()=>effectiveDqeItem({...query,fieldMappings:{},filterValues:[]})).toThrow('未解析');
});
it('6.5 documents with legacy bindings inject each unfiltered predicate exactly once',()=>{
  const raw={...structuredClone(legacy),schemaVersion:'6.5'};
  const parsed=parsePage(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const params=resolvePageParams('',parsed.page.params??[]);
  const initialized=initializePageParams(parsed.page,params.values);
  const query=(initialized.dataSources.shared.source as any).query;
  expect(query.body.dsl_list[0].filter.dims).toEqual([{dim_name:'region',dim_value_list:['APAC']}]);
});
it('initializes filter-owned targets once and keeps unbound targets fixed after clearing',()=>{
  const raw=structuredClone(fixture) as any;
  raw.filters=[{id:'region-filter',type:'dimension',dimension:'region',initialParam:'region'}];
  raw.dataSources.fixed=structuredClone(raw.dataSources.tokens);
  raw.dataSources.tokens.source.query.filterBindings={'region-filter':{target:'dimension',queryField:'区域'}};
  const resolved=resolveDocument(raw,{region:'中国区','report-period':{start:'2026-01',end:'2026-06',granularity:'month'}});
  expect(resolved.ok,JSON.stringify(resolved.issues)).toBe(true);if(!resolved.ok)throw Error(JSON.stringify(resolved.issues));
  const parsed=parsePage(resolved.document);if(!parsed.ok)throw Error('fixture');
  const initialized=initializePageParams(parsed.page,resolved.effectiveInputs);
  expect(initialized.filters?.[0].default).toEqual(['中国区']);
  const controlled=(initialized.dataSources.tokens.source as any).query;
  const fixed=(initialized.dataSources.fixed.source as any).query;
  expect((effectiveDqeItem({...controlled,fieldMappings:{},filterValues:[]}).filter as any).dims).toEqual([]);
  expect((effectiveDqeItem({...fixed,fieldMappings:{},filterValues:[]}).filter as any).dims[0].dim_value_list).toEqual(['中国区']);
  if(!Array.isArray(resolved.document.params))throw Error('expected legacy array');
  const params=resolvePageParams('?region=全球',resolved.document.params);
  expect(params.values.get('region')).toBe('中国区');
});
