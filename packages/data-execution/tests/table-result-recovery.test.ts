import { describe, expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, Page } from '@metriccanvas/page/internal';
import unionFixture from '../../page/fixtures/contract-valid/paged-union-page.json';
import joinFixture from '../../page/fixtures/contract-valid/paged-join-page.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { officeGateway } from './fixtures/office-gateway';
import { createSourceProgram, defaultSourceView } from '../src/runtime';
import type { DataGateway } from '../src/ports';

function parsed(value: unknown): Page {
  const result = parsePage(value);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.page;
}
async function read(page: Page, id: string, gateway: DataGateway, purpose: 'screen' | 'complete') {
  const program = createSourceProgram(page, { gateway });
  let result: DataSnapshot | undefined;
  try {
    for await (const update of program.read({ roots: [id], conditions: new Map(), purpose,
      views: new Map([[id, { ...defaultSourceView(page, id), pageSize: 20 }]]) })) result = update.snapshot;
    return result;
  } finally { program.dispose(); }
}

describe('composed table result recovery', () => {
  it('deduplicates across 200-row batches before counting and paging', async () => {
    const page = parsed(unionFixture), base = createUnionPreview({generatedCount:230}).dataGateway;
    const program = createSourceProgram(page,{gateway:{async fetchData(query){
      const result = await base.fetchData(query);
      if('commercial-localRowId' in query.fieldMappings)result.rows[0]['commercial-localRowId']='SAME-IDENTITY';
      return result;
    }}});
    let complete: DataSnapshot | undefined, window: DataSnapshot | undefined;
    try {
      for await(const update of program.read({roots:['opinions'],conditions:new Map(),purpose:'complete'}))complete=update.snapshot;
      expect(complete).toMatchObject({status:'ready',totalCount:467,warnings:expect.any(Array)});
      for await(const update of program.read({roots:['opinions'],conditions:new Map(),views:new Map([['opinions',{...defaultSourceView(page,'opinions'),pageIndex:21,pageSize:20}]])}))window=update.snapshot;
      expect(window).toMatchObject({status:'ready',totalCount:467});
      if(complete?.status==='ready'&&window?.status==='ready')expect(window.rows).toEqual(complete.rows.slice(420,440));
    }finally{program.dispose();}
  });
  it('does not persist a recovered initial and refreshes into a clean snapshot after data preparation', async () => {
    const page = parsed(unionFixture), normal = createUnionPreview({generatedCount:0}), faulty = createUnionPreview({generatedCount:0,rowFailure:'duplicate'});
    let healthy = false;
    const program = createSourceProgram(page,{gateway:{fetchData:(...args)=>(healthy?normal:faulty).dataGateway.fetchData(...args)}});
    const request = {roots:['opinions'],conditions:new Map(),views:new Map([['opinions',defaultSourceView(page,'opinions')]])};
    try {
      for await (const update of program.read(request)) {
        expect(update.snapshot).toMatchObject({status:'ready',totalCount:7,warnings:expect.any(Array)});
        expect(update.initial).toBeUndefined();
      }
      healthy = true;
      for await (const update of program.read({...request,freshness:'refresh'})) {
        expect(update.snapshot).toMatchObject({status:'ready',totalCount:8});
        expect('warnings' in update.snapshot && update.snapshot.warnings?.length).toBeFalsy();
        expect(update.initial).toBeDefined();
      }
    } finally {program.dispose();}
  });
  it('cancels recovery without publishing a successful partial result', async () => {
    const page = parsed(unionFixture), base = createUnionPreview({generatedCount:0,rowFailure:'duplicate'}).dataGateway;
    const controller = new AbortController();
    const program = createSourceProgram(page,{gateway:{async fetchData(query,diagnostics,signal){
      if(query.resultPolicy==='display')controller.abort();
      return base.fetchData(query,diagnostics,signal);
    }}});
    const pending = (async()=>{for await(const update of program.read({roots:['opinions'],conditions:new Map(),signal:controller.signal}))expect(update.snapshot.status).not.toBe('ready');})();
    try {await expect(pending).rejects.toBeDefined();}finally{program.dispose();}
  });
  for (const purpose of ['screen', 'complete'] as const) {
    it(`retains first duplicate union key and reports a warning for ${purpose}`, async () => {
      const preview = createUnionPreview({ generatedCount: 0, rowFailure: 'duplicate' });
      const result = await read(parsed(unionFixture), 'opinions', preview.dataGateway, purpose);
      expect(result).toMatchObject({ status: 'ready', totalCount: 7, warnings: expect.any(Array) });
      if (result?.status === 'ready') expect(new Set(result.rows.map(row => row.rowKey)).size).toBe(7);
    });
    it(`fills missing cells and skips malformed union rows for ${purpose}`, async () => {
      const base = createUnionPreview({ generatedCount: 0 }).dataGateway;
      const gateway: DataGateway = { async fetchData(query) {
        const result = await base.fetchData(query);
        if ('contract-localRowId' in query.fieldMappings) {
          delete result.rows[0]['contract-approver'];
          result.rows[1] = null as never;
        }
        return result;
      } };
      const result = await read(parsed(unionFixture), 'opinions', gateway, purpose);
      expect(result).toMatchObject({ status: 'ready', totalCount: 7, warnings: expect.any(Array) });
      if (result?.status === 'ready') expect(result.rows.some(row => row.approver === null)).toBe(true);
    });
    it(`retains domain rows when join supplements contain duplicates or extra keys for ${purpose}`, async () => {
      const base = officeGateway();
      const gateway: DataGateway = { async fetchData(query) {
        const result = await base.fetchData(query);
        if ('bidding-amount' in query.fieldMappings) {
          result.rows.push(result.rows[0], { ...result.rows[0], 'rep-office-code': 'OUTSIDE' });
          result.totalCount = result.rows.length;
        }
        return result;
      } };
      const result = await read(parsed(joinFixture), 'office-overview', gateway, purpose);
      expect(result).toMatchObject({ status: 'ready', totalCount: 8, warnings: expect.any(Array) });
    });
  }
});
