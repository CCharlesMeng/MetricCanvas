import { describe, expect, it, vi } from 'vitest';
import { parsePage, resolvePageParams } from '@metriccanvas/page';
import type { DataSnapshot, Page, TableQueryView } from '@metriccanvas/page/internal';
import fixture from '../../page/fixtures/contract-valid/paged-union-generated-key.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';
import { createPageDataExecutor } from '../src/execute';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function page():Page {const result=parsePage(fixture);if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;}
async function read(program:ReturnType<typeof createSourceProgram>,p:Page,view:Partial<TableQueryView>={},purpose:'screen'|'complete'='screen') {
  let snapshot:DataSnapshot|undefined;
  for await(const update of program.read({roots:['opinions'],conditions:new Map(),views:new Map([['opinions',{...defaultSourceView(p,'opinions'),...view}]]),purpose}))snapshot=update.snapshot;
  if(snapshot?.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot;
}
describe('generated UUID rows through shared SourceProgram',()=>{
  it('selects identity independently per member', async () => {
    const document = structuredClone(fixture);
    const member = document.dataSources.opinions.source.members.commercial;
    Reflect.deleteProperty(member, 'rowKeyGeneration');
    Object.assign(member, { rowKeyFields: ['commercial-approver', 'commercial-office'] });
    document.dataSources.commercial.fields['commercial-approver'].nullable = false;
    document.dataSources.commercial.fields['commercial-office'].nullable = false;
    const parsed = parsePage(document);
    if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const preview = createUnionPreview({ generatedCount: 0 });
    preview.data.contract[0].approver = null;
    const program = createSourceProgram(parsed.page, { gateway: preview.dataGateway });
    try {
      const result = await read(program, parsed.page);
      for (const row of result.rows) {
        const [id, key] = JSON.parse(String(row.rowKey));
        if (id === 'contract') expect(key).toMatch(uuid);
        else expect(key).toEqual([row.approver, row.office]);
      }
    } finally { program.dispose(); }
  });
  it('still rejects upstream ordering errors in UUID mode', async () => {
    const p = page(), preview = createUnionPreview({ rowFailure: 'order' });
    const program = createSourceProgram(p, { gateway: preview.dataGateway });
    try { await expect(read(program, p)).rejects.toThrow('顺序不符合'); }
    finally { program.dispose(); }
  });
  it('keeps null dimensions and duplicate business records without changing the row count or sorting',async()=>{
    const p=page(),preview=createUnionPreview({generatedCount:0});
    Object.assign(preview.data.commercial[0],{approver:null,office:null});
    Object.assign(preview.data.commercial[1],{approver:null,office:null});
    const program=createSourceProgram(p,{gateway:preview.dataGateway});
    try {const result=await read(program,p);expect(result.totalCount).toBe(8);expect(result.rows).toHaveLength(8);expect(result.rows.filter(row=>row.approver===null)).toHaveLength(2);expect(new Set(result.rows.map(row=>row.rowKey)).size).toBe(8);for(const row of result.rows){const [member,key]=JSON.parse(String(row.rowKey));expect(member).toBe(row.memberId);expect(key).toMatch(uuid);}expect(preview.requests.every(query=>query.sort?.length===1)).toBe(true);}finally{program.dispose();}
  });
  it('resumes buffered pages without requerying and performs a fresh complete export',async()=>{
    const p=page(),preview=createUnionPreview({generatedCount:230}),program=createSourceProgram(p,{gateway:preview.dataGateway});
    try {const first=await read(program,p,{pageSize:3});const calls=preview.requests.length;const second=await read(program,p,{pageSize:3,pageIndex:1});expect(preview.requests).toHaveLength(calls);expect(new Set([...first.rows,...second.rows].map(row=>row.rowKey)).size).toBe(6);const all=await read(program,p,{},'complete');expect(all.rows).toHaveLength(468);expect(new Set(all.rows.map(row=>row.rowKey)).size).toBe(468);expect(all.rows[0].rowKey).not.toBe(first.rows[0].rowKey);}finally{program.dispose();}
  });
  it('captures reusable UUID initial rows and rejects non-UUID or duplicated saved identities',async()=>{
    const preview=createUnionPreview({generatedCount:0}), resolved=resolvePageParams(fixture);if(!resolved.ok)throw Error('fixture');
    const output=await createPageDataExecutor({gateway:preview.dataGateway}).execute(resolved.document);
    expect(parsePage(output).errors).toEqual([]);
    const source=output.dataSources.opinions.source;if(source.type!=='pagedUnion'||!source.initial)throw Error('initial');
    source.initial.rows[0].rowKey='["commercial","not-a-uuid"]';
    expect(parsePage(output).ok).toBe(false);
    source.initial.rows[0].rowKey=source.initial.rows[1].rowKey;
    source.initial.rows[0].memberId=source.initial.rows[1].memberId;
    expect(parsePage(output).ok).toBe(false);
  });
  it('reports missing UUID entropy as a configuration error',async()=>{
    const p=page(),preview=createUnionPreview({generatedCount:0}),program=createSourceProgram(p,{gateway:preview.dataGateway});
    vi.stubGlobal('crypto',undefined);
    try {await expect(read(program,p)).rejects.toThrow('DQE_CONFIG_ERROR');}finally{program.dispose();vi.unstubAllGlobals();}
  });
});
