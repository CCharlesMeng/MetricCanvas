import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json';
import { createSourceProgram, defaultSourceView, initialFilterValues, type ScreenProgress } from '../src/runtime';
import { createPagedJoinPreview } from '../../../apps/playground/fixtures/query-join-gateway';
import type { DataGateway } from '../src';
import type { DataSnapshot } from '@metriccanvas/page/internal';
import recordDocument from '../../../pages/capabilities/table/record-join-on-demand.json';
import { createRejectionPreview } from '../../../apps/playground/fixtures/rejection-details/gateway';

const turn = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture() { const parsed = parsePage(document); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors)); return parsed.page; }

it('publishes selected rows and each validated batch without completing the execution receipt', async () => {
  const page = fixture(), source = page.dataSources.projects.source;
  if (source.type !== 'pagedJoin' || !('batchSize' in source.pagination)) throw Error('query page');
  source.pagination.batchSize = 5;
  source.projection['contract-amount'].onMissing = 'zero';
  page.dataSources.projects.fields['completion'] = {type:'number',role:'measure',nullable:true};
  page.dataSources.projects.compute = [{op:'ratio',numerator:'approval-count',denominator:'contract-amount',output:'completion',onZeroDenominator:'zero'}];
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const preview = createPagedJoinPreview();
  let batches = 0;
  const gateway: DataGateway = { async fetchData(query) {
    if ('project-status' in query.fieldMappings && ++batches === 2) await held;
    return preview.dataGateway.fetchData(query);
  } };
  const program = createSourceProgram(page, {gateway}), progress: ScreenProgress[] = [];
  let finished = false, result: DataSnapshot | undefined;
  const task = (async () => { for await (const update of program.read({roots:['projects'],conditions:initialFilterValues(page.filters ?? []),onProgress(_id,value){progress.push(value);}})) if (update.sourceId === 'projects') result = update.snapshot; finished = true; })();
  await turn();
  expect(finished).toBe(false);
  expect(progress[0].snapshot.rows[0]['project-name']).toBe('测试项目1');
  expect(progress[0].snapshot.rows[0]['contract-amount']).toBeNull();
  expect(progress[0].snapshot.rows[0]['completion']).toBeNull();
  expect(progress.at(-1)!.snapshot.rows[0]['contract-amount']).toBe(1000);
  expect(progress.at(-1)!.snapshot.rows[5]['contract-amount']).toBeNull();
  release(); await task;
  expect(result?.status).toBe('ready');
  program.dispose();
});

it('keeps selected columns when a supplement fails; execution and complete reads still fail', async () => {
  const page = fixture(), preview = createPagedJoinPreview(80, 'failure');
  const program = createSourceProgram(page, {gateway:preview.dataGateway}), progress: ScreenProgress[] = [];
  let result: DataSnapshot | undefined;
  const request = {roots:['projects'],conditions:initialFilterValues(page.filters ?? [])};
  for await (const update of program.read({...request,onProgress(_id,value){progress.push(value);}})) if (update.sourceId === 'projects') result = update.snapshot;
  expect(result?.status).toBe('error');
  expect(progress.at(-1)?.snapshot.rows[0]['project-name']).toBe('测试项目1');
  expect(progress.at(-1)?.snapshot.rows[0]['contract-amount']).toBeNull();
  await expect((async()=>{for await(const _ of program.read({...request,purpose:'complete',onProgress(){throw Error('export must not publish display progress');}}))void _;})()).rejects.toThrow();
  program.dispose();
});

it('a supplemental sort selects the correct rows before publishing any display progress', async () => {
  const page=fixture(), preview=createPagedJoinPreview(), progress:ScreenProgress[]=[];
  const program=createSourceProgram(page,{gateway:preview.dataGateway});
  const view={...defaultSourceView(page,'projects'),sort:[{field:'contract-amount',direction:'desc' as const}]};
  for await(const _ of program.read({roots:['projects'],conditions:initialFilterValues(page.filters??[]),views:new Map([['projects',view]]),onProgress(_id,value){progress.push(value);}}))void _;
  expect(progress[0].snapshot.rows[0]['project-id']).toBe('P000080');
  expect(progress[0].snapshot.rows[0]['contract-amount']).toBe(80000);
  expect(progress[0].snapshot.rows[0]['project-name']).toBeNull();
  expect(progress.at(-1)?.snapshot.rows.map(row=>row['project-id'])).toEqual(progress[0].snapshot.rows.map(row=>row['project-id']));
  program.dispose();
});

it('a failed member does not hide another member that finishes later',async()=>{
  const page=fixture(), source=page.dataSources.projects.source;
  if(source.type!=='pagedJoin')throw Error('join');
  page.dataSources.third=structuredClone(page.dataSources['project-information']);
  const query=page.dataSources.third.source;if(query.type!=='query')throw Error('query');query.query.body!.dsl_list[0].schema_id='THIRD_SYNTHETIC_MEMBER';
  source.members.c={...source.members.b,source:'third'};source.projection.extra={member:'c',field:'contract-amount'};
  page.dataSources.projects.fields.extra={type:'number',role:'measure',nullable:true};
  let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
  const preview=createPagedJoinPreview();
  const gateway:DataGateway={async fetchData(query,context){
    if(context?.dataSourceIds?.includes('project-information'))throw Object.assign(new Error('synthetic failure'),{code:'DQE_FORBIDDEN'});
    if(context?.dataSourceIds?.includes('third'))await held;
    return preview.dataGateway.fetchData(query);
  }};
  const program=createSourceProgram(page,{gateway}),progress:ScreenProgress[]=[];let result:DataSnapshot|undefined;
  const task=(async()=>{for await(const update of program.read({roots:['projects'],conditions:initialFilterValues(page.filters??[]),onProgress(_id,value){progress.push(value);}}))if(update.sourceId==='projects')result=update.snapshot;})();
  await turn();release();await task;
  expect(result?.status).toBe('error');
  expect(progress.at(-1)?.snapshot.rows[0]).toMatchObject({'project-name':'测试项目1','contract-amount':null,extra:1000});
  program.dispose();
});

it('record pages keep separate row identities when selected records share the same supplemental key',async()=>{
  const parsed=parsePage(recordDocument);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const preview=createRejectionPreview({rows:30}),program=createSourceProgram(parsed.page,{gateway:preview.dataGateway});
  const progress:ScreenProgress[]=[];
  for await(const _ of program.read({roots:['rejection-overview'],conditions:initialFilterValues(parsed.page.filters??[]),onProgress(_id,value){progress.push(value);}}))void _;
  const rows=progress[0].snapshot.rows;
  expect(rows).toHaveLength(10);
  expect(new Set(rows.map(row=>row['record-id'])).size).toBe(10);
  expect(rows[0]['biz-owner-name']).toBeNull();
  expect(progress.at(-1)?.snapshot.rows.every(row=>row['biz-owner-name']!==null)).toBe(true);
  program.dispose();
});
