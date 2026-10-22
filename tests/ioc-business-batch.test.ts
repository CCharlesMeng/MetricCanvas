import { pageFilesById } from '../tools/scripts/page-files.mjs';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../packages/page/src/validate';
import {createFilterState,initialFilterValues} from '../packages/engine/runtime/src/filter-state';
import {filterCandidatesRequest} from '../packages/engine/runtime/src/filter-candidates';
import {businessReviewPages,collaborationCandidates,createIocBusinessPreview} from '../apps/playground/src/lib/ioc-business-preview';
import {recentMonthOptions} from '../tools/scripts/recent-month-options';
function load(id:string){const parsed=parsePage(JSON.parse(readFileSync(pageFilesById('pages').get(`${id}`)!,'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
it.each(businessReviewPages)('review consumes the canonical page: $value',({value})=>{
 const page=load(value);expect(page.iocHeader?.identity?.title).toBeTruthy();expect(page.iocHeader?.presentation).toMatchObject({layout:'inline',collapse:'none'});
});
it('model candidates depend only on the date range, preserving unrelated selection',()=>{
 const page=load('ioc-header-models'),model=page.filters!.find(f=>f.id==='model')!;if(model.type!=='dimension')throw Error();
 const state=createFilterState(initialFilterValues(page.filters!),page.filters);const before=filterCandidatesRequest(model,page.filters!,initialFilterValues(page.filters!));
 state.write('key',{type:'boolean',value:true});expect(model.candidateContext?.filterIds).toEqual(['range']);expect(before.constraints.times.range.to).toBe('2026-09-30');
});
it('required multiple preserves a discrete month set, rejects clear, and keeps single strict',()=>{
 const page=load('ioc-header-months'),state=createFilterState(initialFilterValues(page.filters!),page.filters);
 expect(state.blocked().size).toBe(0);expect(state.commit({type:'clear',filterId:'months'}).ok).toBe(false);
 expect(state.commit({type:'set',filterId:'months',value:{type:'dimension',dimension:'month-code',values:['202610','202608']}}).ok).toBe(true);
 for(const id of ['ioc-header-standard','ioc-header-dense','ioc-header-inputs','ioc-header-models'])expect(load(id).filters!.find(f=>f.id==='region')).toMatchObject({selection:{mode:'single'}});
});
it('currency change clears both original preset ranges in one transaction',()=>{
 const page=load('ioc-header-currency'),state=createFilterState(initialFilterValues(page.filters!),page.filters);state.write('amount',{type:'numberRange',from:2000000,to:10000000});
 let changes=0;const stop=state.subscribe(()=>changes++);state.write('currency',{type:'dimension',dimension:'currency',values:['USD']});expect(changes).toBe(2);expect(state.toURL()).not.toContain('2000000');stop();
 const amount=page.filters!.find(f=>f.type==='numberRange')!;if(amount.type!=='numberRange')throw Error();expect(Object.values(amount.units!.cases).map(unit=>unit.presets?.length)).toEqual([5,4]);
});
it('permission payload normalization has no implicit authorization fallback',()=>{
 expect(collaborationCandidates({},true)).toEqual({kind:'unconfigured'});
 expect(collaborationCandidates({orgAuthority:{orgUnitList:[{orgUnitName:'协同小组',dataPermissionList:[]}]}},true)).toEqual({kind:'values',candidates:[]});
 expect(collaborationCandidates({orgAuthority:{orgUnitList:[]}},false)).toEqual({kind:'unconfigured'});
});
it('calendar options use the explicit anchor and never fill skipped selections',()=>{
 expect(recentMonthOptions('2026-10').map(o=>o.value)).toEqual(load('ioc-header-months').filters!.flatMap(f=>f.type==='dimension'?f.options!.map(o=>o.value):[]));expect(()=>recentMonthOptions('2026-13')).toThrow();
});
it('preview isolates candidate attempts and normalizes incomplete data before the engine',async()=>{
 const page=load('ioc-header-models'),filter=page.filters!.find(f=>f.id==='model')!;if(filter.type!=='dimension')throw Error();const request=filterCandidatesRequest(filter,page.filters!,initialFilterValues(page.filters!));
 const preview=createIocBusinessPreview(page.id,'partial');expect(await preview.dataGateway.fetchFilterCandidates!(request,{signal:new AbortController().signal})).toEqual({kind:'unconfigured'});
});
