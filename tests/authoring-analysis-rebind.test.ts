import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import Ajv from 'ajv';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {draftAnalysis,checkAnalysis,hashBytes} from '../tools/scripts/local-authoring-data-analysis';
import {runAnalysisOperation} from '../tools/scripts/authoring-analysis-program';
import {authoringPageProgramOutputs,localAssociationOutputs} from '../tools/scripts/build-authoring-page-program';
import {identifyDataUses} from '../metriccanvas-authoring/core/page/use-identity';
import {scanPageData} from '../metriccanvas-authoring/core/page/data-scan';
import {OPERATIONS} from '../metriccanvas-authoring/core/page/product-contract';
import {EXTENSION_OPERATIONS} from '../metriccanvas-authoring/core/page/extension-contract';
import {extensionSelfTests} from '../tools/scripts/authoring-extension-self-tests';
import {pageSchema} from '../packages/page/src/schema';
import {ordinaryPage,rawInput,linkedFixture,auxiliaryFixture,pinnedFixture,dependentFixture} from './authoring-association-fixtures';

const parity=JSON.parse(readFileSync('tools/fixtures/local-authoring-data/analysis-parity.json','utf8'));
const frozenSchemaText=readFileSync('tools/fixtures/local-authoring-data/analysis-schema-6.82.json','utf8');
const frozenSchema=JSON.parse(frozenSchemaText);
const frozenSchemaProvenance=JSON.parse(readFileSync('tools/fixtures/local-authoring-data/analysis-schema-6.82.provenance.json','utf8'));
const adopted=JSON.parse(readFileSync('tests/fixtures/authoring-first-release-page-operations.json','utf8'));
const root=mkdtempSync(path.join(tmpdir(),'authoring-association-'));
beforeAll(async()=>{
  for(const [file,text] of [...await authoringPageProgramOutputs(process.cwd()),...await localAssociationOutputs(process.cwd())]) {
    mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),text);
  }
  writeFileSync(path.join(root,'deny-network.mjs'),`import net from 'node:net';import http from 'node:http';import https from 'node:https';const deny=()=>{throw Error('network forbidden')};globalThis.fetch=deny;net.connect=deny;net.createConnection=deny;http.request=deny;https.request=deny;`);
});
afterAll(()=>rmSync(root,{recursive:true,force:true}));

function invoke(operation:string,input:unknown) {
  const run=spawnSync(process.execPath,['--import',path.join(root,'deny-network.mjs'),path.join(root,'scripts/authoring-page-program.mjs')],
    {cwd:root,env:{PATH:process.env.PATH},input:JSON.stringify({operation,input}),encoding:'utf8',timeout:20_000});
  expect(run.stderr).toBe('');
  const receipt=JSON.parse(run.stdout);expect(run.status).toBe(receipt.status==='error'?2:0);return receipt;
}
function codes(receipt:any):string[] {return receipt.diagnostics.map((entry:any)=>entry.code ?? entry.type);}

function analyze(input:any) {return runAnalysisOperation('page.analyze',input) as any;}
function rebind(input:any) {return runAnalysisOperation('page.rebind',input) as any;}

describe('report core and exact baseline identity',()=>{
  it('preserves the frozen draft bytes and full ordered legacy rejection list',()=>{
    const pageText=readFileSync(parity.page,'utf8'),page=JSON.parse(pageText),schema=frozenSchema,md=readFileSync(parity.md,'utf8');
    expect(hashBytes(frozenSchemaText)).toBe(frozenSchemaProvenance.fileSha256);
    expect(hashBytes(JSON.stringify(schema))).toBe(frozenSchemaProvenance.serializedSchemaSha256);
    const before=JSON.stringify({page,schema,report:parity.badReport});
    const draft=draftAnalysis(page,schema,hashBytes(pageText),md);
    expect(hashBytes(JSON.stringify(draft))).toBe(parity.draftSha256);
    expect(checkAnalysis(parity.badReport,draft,md)).toEqual(parity.errors);
    expect(JSON.stringify({page,schema,report:parity.badReport})).toBe(before);
  });

  it('uses the current product Schema identity while preserving the legacy draft semantics',()=>{
    const pageText=readFileSync(parity.page,'utf8'),page=JSON.parse(pageText),md=readFileSync(parity.md,'utf8');
    const frozen=draftAnalysis(page,frozenSchema,hashBytes(pageText),md);
    const current=draftAnalysis(page,pageSchema,hashBytes(pageText),md);
    expect(current.schemaSha256).toBe(hashBytes(JSON.stringify(pageSchema)));
    expect({...current,schemaSha256:frozen.schemaSha256}).toEqual(frozen);
    expect(checkAnalysis(parity.badReport,current,md)).toEqual(parity.errors);
  });

  it('has no Node/engine dependency in pure analysis, association or replacement rules',()=>{
    const built=buildSync({entryPoints:['metriccanvas-authoring/core/page/analysis-report.ts','metriccanvas-authoring/core/page/source-rebind.ts'],bundle:true,platform:'neutral',mainFields:['module','main'],format:'esm',write:false,outdir:'/unused',metafile:true});
    expect(Object.keys(built.metafile.inputs).some(file=>file.startsWith('tools/')||file.includes('packages/engine/'))).toBe(false);
  });

  it('keeps stable semantic uses across component and column reorder, with current pointers',()=>{
    const document=ordinaryPage(),first=analyze(rawInput(document));
    document.sections[0]!.components.reverse();
    document.sections[0]!.components.forEach(component=>component.props.columns.reverse());
    const second=analyze(rawInput(document));
    expect(second.data.uses.map((u:any)=>u.useId).sort()).toEqual(first.data.uses.map((u:any)=>u.useId).sort());
    expect(second.data.uses.find((u:any)=>u.componentId==='table-a'&&u.field==='value').pointers).not.toEqual(first.data.uses.find((u:any)=>u.componentId==='table-a'&&u.field==='value').pointers);
    expect(codes(second)).not.toContain('ANALYSIS_USE_AMBIGUOUS');
  });

  it('aggregates legitimate repeated field references and refuses truly ambiguous component identities',()=>{
    const document=ordinaryPage();(document.sections[0]!.components[0]!.props.columns[1] as any).secondaryField='region';
    const result=analyze(rawInput(document));
    const use=result.data.uses.find((u:any)=>u.componentId==='table-a'&&u.field==='region'&&u.kind==='field');
    expect(use.pointers.length).toBeGreaterThanOrEqual(3);expect(use.identityAmbiguous).toBe(false);
    const duplicate=structuredClone(document);duplicate.sections[0]!.components[1]!.id='table-a';
    const scan=scanPageData(duplicate,pageSchema);const identified=identifyDataUses(duplicate,scan.uses);
    expect(identified.diagnostics.some(entry=>entry.code==='ANALYSIS_USE_AMBIGUOUS')).toBe(true);
  });

  it('anchors raw whitespace, unsaved changes, Schema, binding, work version and material independently',()=>{
    const input=rawInput();const first=analyze(input);
    const compact={...input,documentJson:JSON.stringify(JSON.parse(input.documentJson))};
    expect(codes(analyze(compact))).toContain('ANALYSIS_BASELINE_MISMATCH');
    const current=rawInput({...JSON.parse(input.documentJson),meta:{title:'未保存的新标题'}});
    expect(codes(analyze({...current,priorReport:first.data}))).toContain('ANALYSIS_BASELINE_STALE');
    const fake=structuredClone(first.data);fake.baseline.schemaSha256='0'.repeat(64);
    expect(codes(analyze({...input,priorReport:fake}))).toContain('ANALYSIS_BASELINE_STALE');
    const working={...input,baseline:{...input.baseline,source:'working-copy',workVersion:2,binding:{page:'p',turn:'t'}}};
    const workReport=analyze(working).data;
    expect(codes(analyze({...working,baseline:{...working.baseline,workVersion:3},priorReport:workReport}))).toContain('ANALYSIS_BASELINE_STALE');
    expect(codes(analyze({...working,context:{binding:{page:'p',turn:'different'},dataContextVersion:'v',validationPolicy:'p'}}))).toContain('RESULT_SCOPE_MISMATCH');
    expect(codes(analyze({...input,materialText:'new material',priorReport:first.data}))).toContain('ANALYSIS_BASELINE_STALE');
  });

  it('retains complete coverage under reading scope and never copies record/initial rows into report',()=>{
    const fixture=linkedFixture();fixture.record.rows[0]!['成交额']=987654321;
    const result=analyze(fixture.analyze);
    expect(result.data.reading.sourceIds).toEqual(['sales']);
    expect(result.data.uses.some((use:any)=>use.componentId==='table-b')).toBe(true);
    expect(result.data.uses.some((use:any)=>use.componentId==='unrelated-table')).toBe(true);
    expect(result.data.indexes.byRequirement['sales-report']).toHaveLength(fixture.analyze.links.length);
    expect(result.data.indexes.byDataRequest['new-sales']).toHaveLength(fixture.analyze.links.length);
    expect(result.data.indexes.byResult[fixture.record.resultRef]).toHaveLength(fixture.analyze.links.length);
    expect(result.data.execution).toBe('not-run');
    expect(JSON.stringify(result.data)).not.toContain('987654321');
    expect(JSON.stringify(result.data.results)).not.toContain('rows');
    expect(result.data.gaps.some((gap:any)=>gap.code==='ANALYSIS_USE_UNMAPPED')).toBe(true);
  });

  it.each(['binding','dataContextVersion','validationPolicy','request','status','resultRef'])('rejects a supplied wrong or stale result %s',field=>{
    const fixture=linkedFixture();const record=fixture.analyze.resultRecords[fixture.record.resultRef];
    if(field==='binding')record.binding={...record.binding,turnId:'other'};
    else if(field==='request')record.request={...record.request,groupBy:[]};
    else if(field==='status')record.status='pending';
    else (record as any)[field]='other';
    expect(analyze(fixture.analyze).status).toBe('error');
  });

  it('preserves material quotes and refuses absent or stale source evidence',()=>{
    const input={...rawInput(),requirements:[{id:'r',text:'保持口径',evidence:[{from:1,to:1,quote:'可信原文'}]}],materialText:'可信原文\n第二行'};
    expect(codes(analyze(input))).not.toContain('ANALYSIS_MATERIAL_EVIDENCE_INVALID');
    expect(codes(analyze({...input,materialText:'不同的原文'}))).toContain('ANALYSIS_MATERIAL_EVIDENCE_INVALID');
  });

  it('projects grouped result field declarations through the same product contract',()=>{
    const fixture=linkedFixture(),record=fixture.analyze.resultRecords[fixture.record.resultRef];
    const fields=record.source.fields;
    record.source.fields={dimensions:{'region-output':fields['region-output']},measures:{'value-output':fields['value-output']}};
    delete fields['region-output'].role;delete fields['value-output'].role;
    const output=analyze(fixture.analyze);expect(output.status).not.toBe('error');
    expect(output.data.results[0].fields['region-output']).toMatchObject({type:'string',role:'dimension',queryField:'区域编码'});
    expect(output.data.results[0].fields['value-output']).toMatchObject({type:'number',role:'measure',unit:'元'});
    expect(output.data.results[0].fields.dimensions).toBeUndefined();
    expect(rebind({...fixture.rebind,report:output.data}).status).toBe('ok');
  });
});

describe('atomic ordinary source replacement',()=>{
  it('reads the complete query dependency closure and clears only affected initial snapshots',()=>{
    const fixture=dependentFixture(),analysis=analyze(fixture.analyze);
    expect(analysis.status).not.toBe('error');
    expect(analysis.data.reading.sourceIds).toEqual(expect.arrayContaining(['sales','dependent']));
    expect(analysis.data.reading.componentIds).toEqual(expect.arrayContaining(['table-a','table-b','dependent-table']));
    const output=rebind(fixture.rebind);expect(output.status).toBe('ok');
    const original=JSON.parse(fixture.input.documentJson);
    expect(output.data.document.dataSources.dependent.source.query).toEqual(original.dataSources.dependent.source.query);
    expect(output.data.document.dataSources.dependent.source.initial).toBeUndefined();
    expect(output.data.document.dataSources.unrelated).toEqual(original.dataSources.unrelated);
    expect(output.data.impact.sourceIds).toEqual(expect.arrayContaining(['sales','dependent']));
  });

  it('refuses an affected computed consumer without shrinking the dependency closure',()=>{
    const fixture=dependentFixture(),document=JSON.parse(fixture.input.documentJson);
    document.dataSources.dependent.compute=[{op:'sumFields',fields:['value'],output:'sum',onMissing:'zero'}];
    document.dataSources.dependent.fields.sum={type:'number',role:'measure',unit:'元'};
    const base=rawInput(document),analysis=analyze({...fixture.analyze,...base});
    expect(analysis.status).not.toBe('error');
    const output=rebind({...fixture.rebind,...base,report:analysis.data});
    expect(output.status).toBe('error');expect(output.data.document).toBeNull();
    expect(codes(output)).toContain('REBIND_DEPENDENT_UNSUPPORTED');
  });

  it('preserves every component, column, format, source/field ID and unrelated initial while replacing only the selected source',()=>{
    const fixture=linkedFixture();const before=JSON.stringify(fixture.rebind);
    const output=rebind(fixture.rebind);expect(output.status).toBe('ok');
    const old=JSON.parse(fixture.input.documentJson),document=output.data.document;
    expect(document.sections).toEqual(old.sections);expect(document.meta).toEqual(old.meta);
    expect(Object.keys(document.dataSources)).toEqual(Object.keys(old.dataSources));
    expect(Object.keys(document.dataSources.sales.fields)).toEqual(Object.keys(old.dataSources.sales.fields));
    expect(document.dataSources.sales.fields.value.defaultFormat).toBe('number-grouped');
    expect(document.dataSources.sales.fields.value.queryField).toBe('成交额');
    expect(document.dataSources.sales.source.initial).toBeUndefined();
    expect(document.dataSources.unrelated).toEqual(old.dataSources.unrelated);
    expect(output.data.impact.componentIds).toEqual(expect.arrayContaining(['table-a','table-b']));
    expect(output.data.execution).toBe('not-run');expect(output.data.saveStatus).toBe('not_requested');
    expect(JSON.stringify(fixture.rebind)).toBe(before);
  });

  it.each(['missing-map','role','type','unit','currency','nullable','duplicate-key','missing-key','partial','unknown-count','missing-consumer','filter-binding','parameter-binding','period','aggregation'])('refuses %s without any partial candidate or input mutation',kind=>{
    const fixture=linkedFixture();const input:any=fixture.rebind,record=input.resultRecords[fixture.record.resultRef];
    if(kind==='missing-map')delete input.fieldMap.value;
    if(['role','type','unit','currency','nullable'].includes(kind))record.source.fields['value-output'][kind]=({role:'dimension',type:'string',unit:'美元',currency:'USD',nullable:false} as any)[kind];
    if(kind==='duplicate-key')record.rows[1]['区域编码']='CN';
    if(kind==='missing-key')delete record.rows[0]['区域编码'];
    if(kind==='partial')record.totalCount=20;
    if(kind==='unknown-count')record.totalCount=null;
    if(kind==='missing-consumer')input.report.links=input.report.links.filter((link:any)=>!input.report.uses.find((use:any)=>use.useId===link.useId&&use.componentId==='table-b'));
    if(kind==='filter-binding')record.source.source.query.filterBindings={region:{target:'dimension',queryField:'区域编码'}};
    if(kind==='parameter-binding')record.source.source.query.paramBindings={region:{target:'dimension',queryField:'区域编码'}};
    if(kind==='period'){record.request.time.end='2026-12';input.report.dataRequests[0].time.end='2026-12';record.source.source.query.body.dsl_list[0].filter.time.end='2026-12';}
    if(kind==='aggregation')record.source.source.query.body.dsl_list[0].filter.time.is_aggregate=false;
    const before=JSON.stringify(input),output=rebind(input);
    expect(output.status).toBe('error');expect(output.data.document ?? null).toBeNull();expect(output.diagnostics.length).toBeGreaterThan(0);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('preserves grouped field declarations while mapping every stable field through the shared product projection',()=>{
    const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson);
    const old=document.dataSources.sales.fields;
    const {role:dimensionRole,...dimension}=old.region;const {role:measureRole,...measure}=old.value;
    document.dataSources.sales.fields={dimensions:{region:dimension},measures:{value:measure}};
    const input=rawInput(document),report=analyze({...fixture.analyze,...input}).data;
    const output=rebind({...fixture.rebind,...input,report});
    expect(output.status).toBe('ok');
    expect(output.data.document.dataSources.sales.fields.dimensions.region).toEqual({...dimension,queryField:'区域编码'});
    expect(output.data.document.dataSources.sales.fields.measures.value).toEqual({...measure,queryField:'成交额'});
    expect(output.data.document.sections).toEqual(document.sections);
  });

  it('keeps declared filter consumers and interactions while checking their exact query bindings',()=>{
    const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson),record=structuredClone(fixture.record) as any;
    const binding={'region-filter':{target:'dimension',queryField:'地区'}};
    document.filters=[{id:'region-filter',type:'dimension',dimension:'region'}];
    document.dataSources.sales.source.query.filterBindings=binding;
    document.sections[0].components[0].props.actions=[{on:'click',writeFilter:'region-filter',field:'region'}];
    record.source.fields['region-output'].queryField='地区';record.request.groupBy=['地区'];
    record.source.source.query.filterBindings=structuredClone(binding);record.source.source.query.body.dsl_list[0].output_dims=['地区'];
    record.rows=record.rows.map((row:any)=>({'地区':row['区域编码'],'成交额':row['成交额']}));
    const base=rawInput(document),analyzed=analyze({...fixture.analyze,...base,dataRequests:[record.request],resultRecords:{[record.resultRef]:record}});
    const output=rebind({...fixture.rebind,...base,report:analyzed.data,resultRecords:{[record.resultRef]:record}});
    expect(output.status).toBe('ok');expect(output.data.document.filters).toEqual(document.filters);
    expect(output.data.document.sections).toEqual(document.sections);
    expect(output.data.impact.filterIds).toContain('region-filter');
  });

  it.each(['duplicate','null','missing','partial','unknown'])('checks row identity for an ordinary auxiliary slot shared by two tables: %s',kind=>{
    const fixture=auxiliaryFixture(),record=fixture.rebind.resultRecords[fixture.record.resultRef] as any;
    expect(rebind(fixture.rebind).status).toBe('ok');
    if(kind==='duplicate')record.rows[1]['区域编码']='CN';
    if(kind==='null')record.rows[0]['区域编码']=null;
    if(kind==='missing')delete record.rows[0]['区域编码'];
    if(kind==='partial')record.totalCount=3;
    if(kind==='unknown')record.totalCount=null;
    const before=JSON.stringify(fixture.rebind),output=rebind(fixture.rebind);
    expect(output.status).toBe('error');expect(output.data.document).toBeNull();
    expect(codes(output).some(code=>code.startsWith('REBIND_ROW_KEY_'))).toBe(true);
    expect(JSON.stringify(fixture.rebind)).toBe(before);
  });

  it('checks pinned zero/one-row evidence without imposing the main rowKey',()=>{
    const fixture=pinnedFixture(),record=fixture.rebind.resultRecords[fixture.record.resultRef] as any;
    const one=rebind(fixture.rebind);expect(one.status).toBe('ok');
    expect(record.rows[0]).not.toHaveProperty('区域编码');
    record.rows=[];record.totalCount=0;record.returnedCount=0;record.status='empty';
    expect(rebind(fixture.rebind).status).toBe('ok');
    record.rows=[{'成交额':200},{'成交额':300}];record.totalCount=2;record.returnedCount=2;record.status='ready';
    expect(codes(rebind(fixture.rebind))).toContain('REBIND_PINNED_EVIDENCE_INVALID');
  });

  it.each(['source','field','removed-use','removed-link'])('reconstructs all shared consumers and refuses forged report %s',kind=>{
    const fixture=linkedFixture();const report=fixture.rebind.report as any;
    const position=report.uses.find((use:any)=>use.source==='sales'&&use.componentId==='table-b'&&use.field==='value');
    if(kind==='source')position.source='unrelated';
    if(kind==='field')position.field='region';
    if(kind==='removed-use')report.uses=report.uses.filter((use:any)=>use!==position);
    if(kind==='removed-link')report.links=report.links.filter((link:any)=>link.useId!==position.useId);
    const output=rebind(fixture.rebind);expect(output.status).toBe('error');expect(output.data.document ?? null).toBeNull();
    expect(codes(output).some(code=>['ANALYSIS_POSITION_STALE','REBIND_CONSUMER_UNMAPPED'].includes(code))).toBe(true);
  });

  it.each(['uses-string','uses-null','requirements-null','source-fields-missing','filter-null'])('rejects malformed nested shape as a product refusal: %s',kind=>{
    const fixture=linkedFixture();const value:any=fixture.rebind;
    if(kind==='uses-string')value.report.uses='invalid';
    if(kind==='uses-null')value.report.uses=null;
    if(kind==='requirements-null')value.report.requirements=null;
    if(kind==='source-fields-missing')delete value.resultRecords[fixture.record.resultRef].source.fields;
    if(kind==='filter-null')value.resultRecords[fixture.record.resultRef].request.filters=[null];
    const output=invoke('page.rebind',value);expect(output.status).toBe('error');expect(codes(output)).toContain('ANALYSIS_INPUT_INVALID');
  });

  it('does not treat the same pageId or stable uses as permission to adopt a stale report',()=>{
    const fixture=linkedFixture(),changed=JSON.parse(fixture.input.documentJson);changed.meta.title='未保存修改';
    const input={...fixture.rebind,...rawInput(changed)};
    expect(codes(rebind(input))).toContain('ANALYSIS_BASELINE_STALE');
  });

  it('accepts explicitly empty complete results and does not infer readiness for a failed record',()=>{
    const fixture=linkedFixture(),record=fixture.rebind.resultRecords[fixture.record.resultRef] as any;
    record.status='empty';record.rows=[];record.returnedCount=0;record.totalCount=0;
    expect(rebind(fixture.rebind).status).toBe('ok');
    record.status='failed';expect(codes(rebind(fixture.rebind))).toContain('RESULT_NOT_READY');
  });

  it('requires attributed baseline scope for inline conversion and never overrides observable query scope',()=>{
    const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson);
    document.dataSources.sales.source={type:'inline',rows:[{region:'CN',value:10}]};
    for(const definition of Object.values(document.dataSources.sales.fields) as any[])delete definition.queryField;
    const base=rawInput(document),analyzed=analyze({...fixture.analyze,...base});
    const input:any={...fixture.rebind,...base,report:analyzed.data};
    expect(codes(rebind(input))).toContain('REBIND_SCOPE_UNPROVEN');
    input.baselineScope={groupBy:['region'],time:{granularity:'month',start:'2026-01',end:'2026-06'},provenance:{documentSha256:base.baseline.documentSha256,sourceId:'sales',reference:'synthetic-scope-fact'}};
    expect(rebind(input).status).toBe('ok');
    input.baselineScope.provenance.documentSha256='0'.repeat(64);
    expect(rebind(input).status).toBe('error');
  });
});

describe('standalone Node and adopted contract compatibility',()=>{
  it('replays fixed positive and negative release vectors against the standalone Node program',()=>{
    const ajv=new Ajv({strict:false,allErrors:true});
    for(const vector of extensionSelfTests()) {
      const result=invoke(vector.operation,vector.input);
      expect(result.status).toBe(vector.expectedStatus);
      if(vector.expectedDiagnostic)expect(codes(result)).toContain(vector.expectedDiagnostic);
      if(result.status!=='error') {
        const schema=EXTENSION_OPERATIONS[vector.operation as keyof typeof EXTENSION_OPERATIONS].outputSchema;
        const valid=ajv.compile(schema);expect(valid(result.data),JSON.stringify(valid.errors)).toBe(true);
      }
    }
  },20_000);

  it('keeps all five adopted page operation descriptions byte-equivalent as JSON values',()=>{
    for(const [id,description] of Object.entries(adopted.operations))expect(OPERATIONS[id as keyof typeof OPERATIONS]).toEqual(description);
  });

  it('runs analyze/rebind from a clean cwd under deny-network and the local wrapper uses the exact original file bytes',()=>{
    const fixture=linkedFixture();
    expect(invoke('page.analyze',fixture.analyze)).toEqual(JSON.parse(JSON.stringify(analyze(fixture.analyze))));
    expect(invoke('page.rebind',fixture.rebind)).toEqual(JSON.parse(JSON.stringify(rebind(fixture.rebind))));
    const file=path.join(root,'page.json'),request=path.join(root,'association.json');
    writeFileSync(file,fixture.input.documentJson);const {documentJson,baseline,...association}=fixture.analyze;writeFileSync(request,JSON.stringify(association));
    const local=spawnSync(process.execPath,[path.join(root,'scripts/associate-data.mjs'),'page.analyze','--page',file,'--input',request],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8',timeout:20_000});
    expect(local.status,local.stderr).toBe(0);expect(JSON.parse(local.stdout)).toEqual(JSON.parse(JSON.stringify(analyze(fixture.analyze))));
    expect(readFileSync(file,'utf8')).toBe(fixture.input.documentJson);
  },20_000);
});
