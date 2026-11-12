import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import document from '../../../../pages/capabilities/table/paged-join-on-demand.json';
import { createPagedJoinPreview } from '../../../../apps/playground/fixtures/query-join-gateway';
import { orchestrate } from '../src/orchestrator';
import type { DataGateway, DataGatewayResult } from '../src/ports';
import type { PageDataSnapshots } from '../src/orchestrator';
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));

it('keeps partial rows out of execution snapshots and discards a late prior-page supplement',async()=>{
  const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const pending:{resolve(result:DataGatewayResult):void;result:Promise<DataGatewayResult>}[]=[];
  const preview=createPagedJoinPreview();
  const gateway:DataGateway={fetchData(query){
    if(!('project-status' in query.fieldMappings))return preview.dataGateway.fetchData(query);
    return new Promise(resolve=>pending.push({resolve,result:preview.dataGateway.fetchData(query)}));
  }};
  const stream=orchestrate(parsed.page,gateway);let snapshots:PageDataSnapshots=new Map();
  const stop=stream.subscribe(value=>snapshots=value);
  await turn();
  expect(snapshots.get('projects')?.status).toBe('loading');
  expect(stream.captureRawSnapshots().get('projects')?.status).toBe('loading');
  expect(stream.captureProgress?.().get('projects')?.snapshot.rows[0]['project-name']).toBe('测试项目1');
  stream.setQueryPage('projects',1);await turn();
  expect(stream.captureProgress?.().get('projects')?.snapshot.rows[0]['project-name']).toBe('测试项目11');
  pending[0].resolve(await pending[0].result);await turn();
  expect(stream.captureProgress?.().get('projects')?.snapshot.rows[0]['project-name']).toBe('测试项目11');
  expect(snapshots.get('projects')?.status).toBe('loading');
  pending[1].resolve(await pending[1].result);await turn();
  expect(snapshots.get('projects')?.status).toBe('ready');
  expect(stream.captureProgress?.().has('projects')).toBe(false);
  stop();
});

it('displays raw main columns while a bound aggregate is pending, with zero fallbacks still masked',async()=>{
  const raw=JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-cascade-page.json',import.meta.url),'utf8'));
  const parsed=parsePage(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const calls:{id:string;resolve(result:DataGatewayResult):void}[]=[];
  const gateway:DataGateway={fetchData(_query,context){return new Promise(resolve=>calls.push({id:context!.dataSourceIds![0],resolve}));}};
  const stream=orchestrate(parsed.page,gateway);let snapshots:PageDataSnapshots=new Map();const stop=stream.subscribe(value=>snapshots=value);
  const main='project-efficiency-bottom5';
  calls[0].resolve({rows:[{'commerce-id':'A','customer-name':'客户','project-name':'项目','decision-time':0}],totalCount:1});await turn();
  const partial=stream.captureProgress?.().get(main);
  expect(snapshots.get(main)?.status).toBe('loading');
  expect(partial?.snapshot.rows[0]['project-name']).toBe('项目');
  expect(partial?.snapshot.rows[0]['rep-office-count']).toBeNull();
  expect(partial?.pendingFields).toContain('rep-office-count');
  calls.find(call=>call.id!==main)!.resolve({rows:[{'commerce-id':'A','stage-name':'代表处SDT','decision-time':0,'decision-count':10}],totalCount:1});await turn();
  expect(snapshots.get(main)?.status).toBe('ready');stop();
});
