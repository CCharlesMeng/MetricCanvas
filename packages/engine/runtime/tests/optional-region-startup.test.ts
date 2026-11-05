import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues} from '../src/filter-state';
import {orchestrate} from '../src/orchestrator';
import type {RuntimeDataGateway} from '../src';

function businessPage() {
  const parsed=parsePage(JSON.parse(readFileSync('pages/business/dashboard/ioc/approval/region-authorization-norms.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

it('starts Region-bound business queries without selecting an optional Region or loading its candidates',async()=>{
  const page=businessPage();
  const state=createFilterState(initialFilterValues(page.filters??[]),page.filters,new Map(),{candidates:true});
  const calls:EffectiveQuery[]=[];
  const gateway:RuntimeDataGateway={async fetchData(query){calls.push(query);return {rows:[],totalCount:0};}};
  const stop=orchestrate(page,gateway,state).subscribe(()=>{});
  try {
    await new Promise(resolve=>setTimeout(resolve,0));
    const dimensions=calls.map(query=>query.body.dsl_list[0].output_dims);
    expect(dimensions).toContainEqual(['地区部']);
    expect(dimensions).toContainEqual(['代表处']);
  } finally {stop();}
});

it('does not gate an empty optional tree on candidate availability, but still gates a selected node',()=>{
  const declaration=businessPage().filters!.find(filter=>filter.id==='region')!;
  const state=createFilterState(undefined,[declaration],new Map(),{candidates:true});
  for(const status of ['loading','empty','error','unavailable','denied'] as const){
    state.candidate('region',status);
    expect([...state.blocked()],status).toEqual([]);
  }
  state.write('region',{type:'dimension',dimension:'rep-office-name',level:'office',values:['示例代表处']});
  expect([...state.blocked()]).toEqual(['region']);
  state.candidate('region','ready',['示例代表处']);
  expect([...state.blocked()]).toEqual([]);
});
