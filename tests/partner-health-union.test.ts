import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import {flattenPageComponents,resolveDataSourceFields,tableColumnLeaves,type DataSnapshot,type TableComponent} from '../packages/page/src/internal';
import {createSourceProgram,initialFilterValues} from '../packages/data-execution/src/runtime';
import {normalizeQueryRows} from '../packages/page/src/query-rows';
import {applyComputation} from '../packages/data-execution/src/compute';
import {projectTableRows,alignedCellText} from '../packages/engine/widgets/src/components/table/rows';
import {createPartnerHealthUnionPreview,partnerHealthUnionGateway} from '../apps/playground/fixtures/organization-union/gateway';
import {pageExternalInputs} from '../apps/playground/fixtures/preview-inputs';
import mock from '../apps/playground/fixtures/organization-union/mock.json';

const document=JSON.parse(readFileSync('pages/temporary/partner-health.json','utf8'));
const parsed=parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;

async function readScores(grain:string,state='ready') {
  const table=flattenPageComponents(page).find(c=>c.id===`${grain}-table`) as TableComponent;
  const sourceId=table.data.main;
  const program=createSourceProgram(page,{gateway:createPartnerHealthUnionPreview(state).dataGateway});
  let snapshot:DataSnapshot|undefined;
  try {
    for await (const update of program.read({roots:[sourceId],conditions:initialFilterValues(page.filters??[]),freshness:'refresh'})) {
      if (update.sourceId===sourceId) snapshot=update.snapshot;
    }
  } finally {program.dispose();}
  return {table,sourceId,snapshot};
}

describe('partner-health 正式页面使用完整组织并集',()=>{
  it.each(['region','representative'])('%s：1/10/13 => 15，缺项 --、真实0和负数保留',async grain=>{
    const {table,sourceId,snapshot}=await readScores(grain);
    const fixture=grain==='representative'?mock.representative:mock;
    const prefix=grain==='representative'?'REP':'ORG';
    expect(snapshot?.status).toBe('ready');
    if (snapshot?.status!=='ready') throw Error(JSON.stringify(snapshot));
    expect(snapshot.rows.map(r=>r.region).sort()).toEqual(fixture.expectedOrganizations);
    expect(snapshot.totalCount).toBe(15);
    const rows=new Map(snapshot.rows.map(row=>[row.region,row]));
    for (const [id,total] of Object.entries(fixture.expectedSelectedTotals)) expect(rows.get(id)?.['total-score']).toBe(total);
    expect(rows.get(`${prefix}-03`)).toMatchObject({'perception-willingness':null,'satisfaction-evaluation':null,'total-score':0});
    expect(rows.get(`${prefix}-01`)?.['perception-feedback']).toBe(0);
    expect(rows.get(`${prefix}-06`)?.['risk-control']).toBeNull();
    const data={main:{fields:resolveDataSourceFields(page.dataSources[sourceId]),snapshot}};
    const aligned=projectTableRows(data,table.props);
    const columns=tableColumnLeaves(table.props.columns);
    const total=columns.find(c=>typeof c.field==='object'&&'field' in c.field&&c.field.field==='total-score')!;
    expect(alignedCellText(total.field,data,aligned.find(r=>r.main.region===`${prefix}-03`)!)).toBe('0.0');
    const missing=columns.find(c=>typeof c.field==='object'&&'field' in c.field&&c.field.field==='satisfaction-evaluation')!;
    expect(alignedCellText(missing.field,data,aligned.find(r=>r.main.region===`${prefix}-04`)!)).toBe('--');
  });
  it.each([['emptyMain',14],['empty',0]])('%s 不依赖主查询构造行集合',async(state,count)=>{
    const {snapshot}=await readScores('region',state);
    expect(snapshot?.status).toBe(count?'ready':'empty');
    expect(snapshot&&'totalCount' in snapshot?snapshot.totalCount:undefined).toBe(count);
  });
  it.each(['error','truncated','duplicate'])('%s 保持错误，不冒充缺项零分',async state=>{
    expect((await readScores('region',state)).snapshot?.status).toBe('error');
  });
  it('Mock 入口明确隔离；正式查询不被模拟网关接管',()=>{
    expect(pageExternalInputs('partner-health')).toBeUndefined();
    expect(pageExternalInputs('partner-health-union-null-probe')).toBe('organization-union');
    const real={async fetchData(){return {rows:[]};}};
    expect(partnerHealthUnionGateway('partner-health',real)).toBe(real);
    const preview=JSON.parse(readFileSync('pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json','utf8'));
    for (const [id, source] of Object.entries(document.dataSources)) {
      if (id !== 'health-overview') expect(preview.dataSources[id]).toEqual(source);
    }
    expect(document.dataSources['health-overview'].compute[0]).toMatchObject({op:'unionKeys',keys:['china-overseas']});
    expect(preview.dataSources).toEqual(document.dataSources);
    expect(preview.sections).toEqual(document.sections);
  });
});

describe('DQE 数字归一化与展示',()=>{
  it.each([[0,'0.0',5],[null,'--',5],['','--',5],['   ','--',5],['0','0.0',5],[-2,'-2.0',3],['坏值','坏值',5]])('%s 的显示和求和', (input,text,total)=>{
    const fields={score:{type:'number',role:'measure',queryField:'得分'}} as const;
    const result=normalizeQueryRows([{得分:input}],fields);
    if(!result.ok) throw Error(JSON.stringify(result.issues));
    const snapshot={status:'ready' as const,rows:result.rows,...(result.cellFallbacks?{cellFallbacks:result.cellFallbacks}:{})};
    const data={main:{fields,snapshot}};
    const aligned=projectTableRows(data,{columns:[{field:'score'}]});
    expect(alignedCellText({data:'main',field:'score',format:'number-1',missingText:'--'},data,aligned[0])).toBe(text);
    const computed=applyComputation([{op:'sumFields',fields:['score','other'],output:'total',onMissing:'zero'}],result.rows.map(row=>({...row,other:5})));
    expect(computed[0].total).toBe(total);
    if(input==='坏值')expect(result.warnings?.[0].code).toBe('INVALID_NUMERIC_VALUE');
  });
  it('省略数值属性保留空值，省略维度属性仍是映射错误',()=>{
    expect(normalizeQueryRows([{}],{score:{type:'number',role:'measure',queryField:'得分'}})).toMatchObject({
      ok:true,rows:[{score:null}],warnings:[{code:'MISSING_NUMERIC_QUERY_FIELD',fieldId:'score',count:1}]
    });
    expect(normalizeQueryRows([{}],{region:{type:'string',role:'dimension',queryField:'地区部'}})).toMatchObject({
      ok:false,issues:[{code:'MISSING_QUERY_FIELD',fieldId:'region'}]
    });
  });
});
