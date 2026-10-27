import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parsePage } from '../packages/page/src/validate';
import { checkAnalysis, draftAnalysis, hashBytes, scanPageData } from '../tools/scripts/local-authoring-data-analysis';
import { scopePageData } from '../tools/scripts/local-authoring-data-scope';

const schema=JSON.parse(readFileSync('metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/schema.json','utf8'));
const fixture=(kind:string)=>JSON.parse(readFileSync(`pages/capabilities/table/table-row-expansion-${kind}.json`,'utf8'));
const expansionPath='/sections/0/components/0/props/rowExpansion';
const isolated=mkdtempSync(path.join(tmpdir(),'local-authoring-row-expansion-'));
beforeAll(()=>cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring',path.join(isolated,'skill'),{recursive:true}));
afterAll(()=>rmSync(isolated,{recursive:true,force:true}));
const aliases:Record<string,string>={'customer-id':'customer_id','customer-name':'customer_name',amount:'parent_total',orders:'orders','order-id':'order_id',product:'product'};
const mappingText=['customer_id','customer_name','parent_total','orders','nested_total','order_id','product'].join('\n');

function matchedReport(page:any) {
  const report=draftAnalysis(page,schema,hashBytes(JSON.stringify(page)),mappingText);
  for(const entry of report.entries) {
    const alias=entry.use.recordListField && entry.use.field==='amount'?'nested_total':aliases[entry.use.field];
    const line=mappingText.split('\n').indexOf(alias)+1;
    Object.assign(entry,{matching:'matched',metricName:entry.use.field,reason:'引用该字段上下文的显式映射',evidence:[{from:line,to:line,quote:alias}],missing:[]});
  }
  report.gaps=[];
  expect(checkAnalysis(report,report,mappingText)).toEqual([]);
  return report;
}

function queryCandidate(page:any) {
  const candidate=structuredClone(page.dataSources.customers);
  for(const id of Object.keys(candidate.fields)) candidate.fields[id].queryField=aliases[id];
  for(const id of Object.keys(candidate.fields.orders.items.fields)) candidate.fields.orders.items.fields[id].queryField=id==='amount'?'nested_total':aliases[id];
  candidate.source={type:'query',resultScope:'complete',query:{language:'dqe',body:{dsl_list:[{
    output_dims:['customer_id','customer_name','orders'],output_metrics:['parent_total'],filter:{dims:[],metrics:[]}
  }]}}};
  return candidate;
}

function runPrepare(page:any,definition:any) {
  const directory=mkdtempSync(path.join(isolated,'case-'));
  const pageFile=path.join(directory,`${page.id}.json`),mdFile=path.join(directory,'metrics.md');
  const reportFile=path.join(directory,'report.json'),proposalsFile=path.join(directory,'proposals.json');
  const content=JSON.stringify(page);
  writeFileSync(pageFile,content);writeFileSync(mdFile,mappingText);
  writeFileSync(reportFile,JSON.stringify(matchedReport(page)));
  writeFileSync(proposalsFile,JSON.stringify({customers:definition}));
  expect(parsePage({...page,dataSources:{customers:definition}}).ok).toBe(true);
  const result=spawnSync(process.execPath,[path.join(isolated,'skill/scripts/analyze-data.mjs'),'prepare','--page',pageFile,'--md',mdFile,'--report',reportFile,'--proposals',proposalsFile],{cwd:directory,encoding:'utf8',timeout:10_000,env:{PATH:process.env.PATH}});
  expect(result.error,result.stderr).toBeUndefined();
  expect(readFileSync(pageFile,'utf8')).toBe(content);
  return {status:result.status,receipt:JSON.parse(result.stdout)};
}

describe('行展开用数保留父行与子表的独立字段上下文',()=>{
  it('真实查询示例保留模板源、父行绑定和子表字段，局部读取能找到模板源',()=>{
    const page=fixture('query'),before=JSON.stringify(page);
    expect(parsePage(page).ok).toBe(true);
    const scan=scanPageData(page,schema);
    expect(scan.diagnostics).toEqual([]);
    expect(scan.uses.filter(use=>use.kind==='row-expansion-source').map(use=>use.source)).toEqual(['orders-default','orders-optional']);
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/data/bindings/customer-default',kind:'row-input',source:'customers',field:'customer-id'}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/table/rowKey',source:'orders-default',field:'order-id'}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/table/columns/1/field',source:'orders-default',field:'product'}));
    expect(scan.uses.some(use=>use.source==='row')).toBe(false);
    const scoped=scopePageData(page,scan,['customers-default']);
    expect(scoped.sources).toHaveProperty('orders-default');
    expect(scoped.diagnostics).toEqual([]);
    expect(JSON.stringify(scan)).not.toContain('北辰科技');
    expect(JSON.stringify(page)).toBe(before);
  });

  it('真实 recordList 示例按项契约解析分组列、行键和搜索，不输出嵌套数据行',()=>{
    const page=fixture('inline');
    const table=page.sections[1].components[0].props.rowExpansion.table;
    table.columns=[{kind:'group',id:'details',title:'明细',children:table.columns}];
    expect(parsePage(page).ok).toBe(true);
    const before=JSON.stringify(page),scan=scanPageData(page,schema);
    expect(scan.diagnostics).toEqual([]);
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/data/field',source:'customers',field:'orders'}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/table/rowKey',source:'customers',recordListField:'orders',field:'order-id'}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:'/sections/1/components/0/props/rowExpansion/table/columns/0/children/1/field',source:'customers',recordListField:'orders',field:'product'}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:'/sections/1/components/0/props/rowExpansion/table/toolbar/search/fields/1',source:'customers',recordListField:'orders',field:'product'}));
    expect(Object.keys(scan.sources)).toEqual(['customers']);
    expect(JSON.stringify(scan)).not.toContain('C01-001');
    expect(JSON.stringify(page)).toBe(before);
  });

  it('报告区分父子同名字段契约和缺口，检查拒绝篡改 recordList 上下文',()=>{
    const page=fixture('inline'),fields=page.dataSources.customers.fields;
    fields.amount.label='父行金额';fields.orders.items.fields.amount.label='订单金额';
    const md='# 金额\n父行金额与订单金额使用各自粒度。';
    const report=draftAnalysis(page,schema,hashBytes(JSON.stringify(page)),md);
    const parent=report.entries.find((entry:any)=>entry.use.field==='amount' && !entry.use.recordListField);
    const child=report.entries.find((entry:any)=>entry.use.field==='amount' && entry.use.recordListField==='orders');
    expect(parent.fieldContract).toEqual(fields.amount);
    expect(child.fieldContract).toEqual(fields.orders.items.fields.amount);
    expect(parent.missing).toEqual(['customers:amount']);
    expect(child.missing).toEqual(['customers:orders:amount']);
    expect(checkAnalysis(report,report,md)).toEqual([]);
    const changed=structuredClone(report);
    changed.entries.find((entry:any)=>entry.use.recordListField==='orders').use.recordListField='other';
    expect(checkAnalysis(changed,report,md)).toContainEqual(expect.stringContaining('changed use identity recordListField'));
  });

  it('子表未知字段不会退回同名父字段，仍给出可定位的错误',()=>{
    const page=fixture('inline');
    page.dataSources.customers.fields.product={type:'string',role:'dimension'};
    delete page.dataSources.customers.fields.orders.items.fields.product;
    const scan=scanPageData(page,schema);
    expect(scan.diagnostics).toContainEqual({path:expansionPath+'/table/columns/1/field',type:'UNKNOWN_FIELD',source:'customers',field:'product'});
    const report=draftAnalysis(page,schema,hashBytes(JSON.stringify(page)),'');
    expect(report.entries.find((entry:any)=>entry.use.path===expansionPath+'/table/columns/1/field').fieldContract).toBeNull();
  });

  it('查询展开的筛选和参数输入保留引用，不把来源类别当页面数据源',()=>{
    const page=fixture('query'),input=page.sections[0].components[0].props.rowExpansion.data;
    input.bindings.region={source:'filter',id:'region'};
    input.bindings.year={source:'param',id:'year'};
    const scan=scanPageData(page,schema);
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/data/bindings/region',kind:'filter-reference',declaration:{filterId:'region'}}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/data/bindings/year',kind:'param-reference',declaration:{paramId:'year'}}));
    expect(scan.uses).toContainEqual(expect.objectContaining({path:expansionPath+'/data/filters/0',kind:'filter-reference',declaration:{filterId:'customer-default'}}));
    expect(scan.uses.some(use=>['row','filter','param'].includes(use.source ?? ''))).toBe(false);
  });

  it('损坏或无法识别的展开上下文给出诊断，不按父表字段静默解释',()=>{
    const page=fixture('query');
    page.sections[0].components[0].props.rowExpansion.data={type:'unknown'};
    const scan=scanPageData(page,schema);
    expect(scan.diagnostics).toContainEqual({path:expansionPath+'/data',type:'INVALID_ROW_EXPANSION_CONTEXT'});
    expect(scan.uses.some(use=>use.path.startsWith(expansionPath+'/table'))).toBe(false);
    const missingSchema=structuredClone(schema);
    delete missingSchema.definitions.rowExpansionTable;
    expect(scanPageData(fixture('query'),missingSchema).diagnostics).toContainEqual({path:expansionPath,type:'UNSUPPORTED_ROW_EXPANSION_CONTEXT'});
  });

  it.each([
    ['correct',0,undefined],
    ['parent-from-child',1,'customers/amount: queryField requires cited document evidence'],
    ['child-from-parent',1,'customers/orders/items/amount: queryField requires cited document evidence'],
    ['uncited-child',1,'customers/orders/items/amount: queryField requires cited document evidence']
  ] as const)('仓外 prepare 按字段上下文核验证据：%s',(mode,status,error)=>{
    const page=fixture('inline'),candidate=queryCandidate(page);
    if(mode==='parent-from-child') {
      candidate.fields.amount.queryField='nested_total';
      candidate.source.query.body.dsl_list[0].output_metrics=['nested_total'];
    }
    if(mode==='child-from-parent') candidate.fields.orders.items.fields.amount.queryField='parent_total';
    if(mode==='uncited-child') candidate.fields.orders.items.fields.amount.queryField='uncited';
    const result=runPrepare(page,candidate);
    expect(result.status).toBe(status);
    expect(result.receipt.errors).toEqual(error?[error]:[]);
    expect(result.receipt.execution).toBe('not-run');
    if(status) expect(result.receipt.dataSources).toBeUndefined();
    else expect(result.receipt.dataSources.customers).toEqual(candidate);
  });

  it('真实兼容分组字段页面不误报未知字段，保留 queryField 和原用数路径',()=>{
    const page=JSON.parse(readFileSync('pages/business/report/customer/customer-activity-risk-briefing.json','utf8'));
    const before=JSON.stringify(page),scan=scanPageData(page,schema);
    expect(parsePage(page).ok).toBe(true);
    expect(scan.diagnostics).toEqual([]);
    expect(scan.sources['overview-na'].fields['na-customer-count']).toMatchObject({queryField:'NA客户数',role:'measure'});
    for(const use of scan.uses.filter(use=>use.field)) {
      const value=use.path.slice(1).split('/').reduce((node:any,key:string)=>node[key.replaceAll('~1','/').replaceAll('~0','~')],page);
      expect(value).toBeDefined();
    }
    expect(JSON.stringify(page)).toBe(before);
  });

  it('仓外 prepare 接受产品兼容的分组字段声明，并保留原候选写法',()=>{
    const page=fixture('inline'),candidate=queryCandidate(page);
    for(const section of page.sections) for(const component of section.components) delete component.props.rowExpansion;
    candidate.fields={dimensions:{
      'customer-id':{type:'string',queryField:'customer_id'},
      'customer-name':{type:'string',queryField:'customer_name'}
    },measures:{amount:{type:'number',unit:'元',queryField:'parent_total'}}};
    candidate.source.query.body.dsl_list[0].output_dims=['customer_id','customer_name'];
    page.dataSources.customers=structuredClone(candidate);
    const result=runPrepare(page,candidate);
    expect(result.status).toBe(0);
    expect(result.receipt.errors).toEqual([]);
    expect(result.receipt.dataSources.customers.fields).toEqual(candidate.fields);
  });
});
