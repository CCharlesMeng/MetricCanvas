import { describe, expect, it } from 'vitest';
import { parsePage, resolvePageParams } from '@metriccanvas/page';
import type { DataSnapshot, Page, TableQueryView } from '@metriccanvas/page/internal';
import fixture from '../../page/fixtures/contract-valid/paged-union-composite-key.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';
import { createPageDataExecutor } from '../src/execute';
import type { DataGateway } from '../src/ports';

function page(): Page { const p = parsePage(fixture); if (!p.ok) throw Error(JSON.stringify(p.errors)); return p.page; }
async function read(program: ReturnType<typeof createSourceProgram>, p: Page, view: Partial<TableQueryView> = {}, purpose: 'screen' | 'complete' = 'screen') {
  let result: DataSnapshot | undefined;
  for await (const update of program.read({roots:['opinions'],conditions:new Map(),views:new Map([['opinions',{...defaultSourceView(p,'opinions'),...view}]]),purpose})) result=update.snapshot;
  return result;
}
function ready(snapshot: DataSnapshot | undefined) { if (snapshot?.status !== 'ready') throw Error(JSON.stringify(snapshot)); return snapshot; }

describe('pagedUnion composite keys through SourceProgram', () => {
  it('keeps repeated approvers across offices and identical tuples across sources, including export and captured initial', async () => {
    const p=page(), preview=createUnionPreview({generatedCount:0}), program=createSourceProgram(p,{gateway:preview.dataGateway});
    try {
      const result=ready(await read(program,p));
      expect(result.rows).toHaveLength(8);
      expect(new Set(result.rows.map(row=>row.rowKey)).size).toBe(8);
      expect(result.rows.filter(row=>row.memberId==='contract' && row.approver==='审批人甲').map(row=>row.office)).toEqual(['示例一处','示例二处']);
      expect(JSON.parse(String(result.rows[0].rowKey))).toEqual(['commercial',['审批人甲','示例一处']]);
      expect(ready(await read(program,p,{},'complete')).rows).toEqual(result.rows);
      const filtered=ready(await read(program,p,{predicates:[{field:'businessType',op:'in',values:['合同']}],search:{fields:['approver'],query:'审批人甲'}}));
      expect(filtered.totalCount).toBe(2);
    } finally {program.dispose();}
    expect(preview.requests.every(query=>query.sort?.length===1)).toBe(true);
    const resolved=resolvePageParams(fixture); if(!resolved.ok) throw Error('fixture');
    const captured=await createPageDataExecutor({gateway:preview.dataGateway}).execute(resolved.document);
    expect(parsePage(captured).errors).toEqual([]);
    expect(captured.dataSources.opinions.source).toHaveProperty('initial.rows');
  });
  it('uses checkpoint paging and complete export across 200-row batches without changing identities', async () => {
    const p=page(),preview=createUnionPreview({generatedCount:230}),program=createSourceProgram(p,{gateway:preview.dataGateway});
    try {
      const all=ready(await read(program,p,{},'complete')).rows;
      expect(all).toHaveLength(468);
      for (const pageIndex of [0,1,20,3]) expect(ready(await read(program,p,{pageIndex})).rows).toEqual(all.slice(pageIndex*20,pageIndex*20+20));
      expect(preview.requests.some(query=>(query.pagination?.offset??0)>=200)).toBe(true);
    } finally {program.dispose();}
  });
  it.each(['commercial-approver','commercial-office'])('skips null or blank %s and reports its source', async field => {
    for (const value of [null,'','  ']) {
      const p=page(),preview=createUnionPreview({generatedCount:0});
      const gateway:DataGateway={async fetchData(query){const result=await preview.dataGateway.fetchData(query);if (Object.hasOwn(query.fieldMappings,field)) result.rows[0][field]=value;return result;}};
      const program=createSourceProgram(p,{gateway});
      try {const result=await read(program,p);expect(result).toMatchObject({status:'ready',totalCount:7,warnings:expect.arrayContaining([expect.objectContaining({sourceId:'commercial'})])});}finally{program.dispose();}
    }
  });
  it.each([0,200])('keeps first repeated tuple at offset %s without echoing its values',async offset => {
    const p=page(),preview=createUnionPreview({generatedCount:230});
    const gateway:DataGateway={async fetchData(query){const result=await preview.dataGateway.fetchData(query);if (Object.hasOwn(query.fieldMappings,'commercial-approver')) {result.rows[0]['commercial-approver']='PRIVATE-APPROVER';result.rows[0]['commercial-office']='PRIVATE-OFFICE';if(offset===0){result.rows[1]['commercial-approver']='PRIVATE-APPROVER';result.rows[1]['commercial-office']='PRIVATE-OFFICE';}}return result;}};
    const program=createSourceProgram(p,{gateway});
    try {const result=await read(program,p,{pageSize:1000});expect(result?.status).toBe('ready');if(result?.status!=='ready')throw Error('expected recovered result');expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({sourceId:'commercial',message:'重复行标识仅保留第一条'})]));expect(JSON.stringify(result.warnings)).not.toContain('PRIVATE-');}finally{program.dispose();}
  });
  it('encodes string separators without collisions',async()=>{
    const p=page(),preview=createUnionPreview({generatedCount:0});
    Object.assign(preview.data.commercial[0],{approver:'a|b',office:'c'});
    Object.assign(preview.data.commercial[1],{approver:'a',office:'b|c'});
    const program=createSourceProgram(p,{gateway:preview.dataGateway});
    try {expect(ready(await read(program,p)).rows).toHaveLength(8);}finally{program.dispose();}
  });
  it('keeps numeric zero in a mixed-type tuple and preserves declaration order', async () => {
    const document=structuredClone(fixture), preview=createUnionPreview({generatedCount:0});
    Object.assign(document.dataSources.opinions.fields.officeId,{type:'number'});
    Object.assign(document.dataSources.contract.fields['contract-officeId'],{type:'number'});
    Object.assign(document.dataSources.commercial.fields['commercial-officeId'],{type:'number'});
    for (const id of ['contract','commercial'] as const) {
      document.dataSources.opinions.source.members[id].rowKeyFields=[`${id}-officeId`,`${id}-approver`];
      preview.data[id].forEach((row,index)=>{row.officeId=index;});
    }
    const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const program=createSourceProgram(parsed.page,{gateway:preview.dataGateway});
    try {const result=ready(await read(program,parsed.page));expect(JSON.parse(String(result.rows[0].rowKey))).toEqual(['commercial',[0,'审批人甲']]);}finally{program.dispose();}
  });
  it('mixes legacy scalar and composite members without changing old identities', async () => {
    const document=structuredClone(fixture), preview=createUnionPreview({generatedCount:0});
    const member=document.dataSources.opinions.source.members.commercial;
    Reflect.deleteProperty(member,'rowKeyFields');Object.assign(member,{rowKey:'commercial-localRowId'});
    const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const program=createSourceProgram(parsed.page,{gateway:preview.dataGateway});
    try {const result=ready(await read(program,parsed.page));expect(result.rows[0].rowKey).toBe('["commercial","001"]');expect(JSON.parse(String(result.rows[1].rowKey))).toEqual(['contract',['审批人甲','示例一处']]);}finally{program.dispose();}
  });
});
