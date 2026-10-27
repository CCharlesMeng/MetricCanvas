import fs from 'node:fs';
import {it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot} from '@metriccanvas/page/internal';
import {orchestrate,type PageDataSnapshots} from '../src/orchestrator';
import {createFilterState} from '../src/filter-state';
import {initialFilterValues} from '@metriccanvas/data-execution/runtime';
import {createRejectionPreview} from '../../../../apps/playground/fixtures/rejection-details/gateway';
const original=JSON.parse(fs.readFileSync(new URL('../../../../pages/business-rejection-details.json',import.meta.url),'utf8'));
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
it('invalidates the record source and resets paging when only a local time filter changes',async()=>{
  const parsed=parsePage(original);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,preview=createRejectionPreview({rows:25});
  const filters=createFilterState(initialFilterValues(page.filters??[]));
  let snapshots:PageDataSnapshots=new Map();
  const stream=orchestrate(page,preview.dataGateway,filters),stop=stream.subscribe(next=>snapshots=next);
  try{
    await flush();expect(snapshots.get('rejection-overview')).toMatchObject({status:'ready',totalCount:25});
    stream.setQueryPage('rejection-overview',1);await flush();
    expect(stream.getQueryView('rejection-overview')?.pageIndex).toBe(1);
    filters.write('mtime',{type:'timeRange',from:'2026-08',to:'2026-08'});await flush();
    expect(snapshots.get('rejection-overview')).toMatchObject({status:'empty',totalCount:0});
    expect(stream.getQueryView('rejection-overview')?.pageIndex).toBe(0);
    filters.write('mtime',{type:'timeRange',from:'2026-09',to:'2026-09'});await flush();
    const result:DataSnapshot|undefined=snapshots.get('rejection-overview');expect(result).toMatchObject({status:'ready',totalCount:25});
  }finally{stop();}
});
