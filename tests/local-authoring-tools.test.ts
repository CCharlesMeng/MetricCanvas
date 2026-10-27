import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scanPageData, markdownBlocks, findBlocks, draftAnalysis, checkAnalysis, hashBytes } from '../tools/scripts/local-authoring-data-analysis';
import { scopePageData } from '../tools/scripts/local-authoring-data-scope';
import { knowledgeSelection, topicClosure, validateSemanticHeadings } from '../tools/scripts/local-authoring-knowledge';
import { decodeKnowledge, encodeKnowledge } from '../tools/scripts/local-authoring-knowledge-core';

const source='metriccanvas-authoring/skill/metriccanvas-local-authoring';
const model=decodeKnowledge(readFileSync(`${source}/references/authoring-knowledge/model.json`,'utf8'));
const page=JSON.parse(readFileSync('pages/capabilities/layout/local-authoring-knowledge-demo.json','utf8'));
const md=readFileSync('tools/fixtures/local-authoring-data/metrics.md','utf8');
const pageText=JSON.stringify(page);
const isolated=mkdtempSync(path.join(tmpdir(),'local-authoring-tools-'));
const run=(script:string,args:string[])=>spawnSync(process.execPath,[path.join(isolated,'skill/scripts',script+'.mjs'),...args],{cwd:tmpdir(),encoding:'utf8',timeout:10_000,env:{PATH:process.env.PATH}});
beforeAll(()=>cpSync(source,path.join(isolated,'skill'),{recursive:true}));
afterAll(()=>rmSync(isolated,{recursive:true,force:true}));

const scopedPage=()=>JSON.parse(readFileSync('pages/capabilities/layout/local-authoring-scoped-data-demo.json','utf8'));
const scopedScan=(document:any,ids:string[])=>scopePageData(document,scanPageData(document,model.schema),ids);

describe('局部读取保持共享消费者与完整验收边界',()=>{
  it('只读相关源及两表用数，剔除独立内容与所有数据行',()=>{
    const document=scopedPage(),before=JSON.stringify(document),scan=scopedScan(document,['region-table']);
    expect(Object.keys(scan.sources)).toEqual(['voice-closure']);
    expect(scan.selectedComponents.map(c=>c.id)).toEqual(['region-table']);
    expect(scan.consumers.map(c=>c.id)).toEqual(['region-table','review-table']);
    expect(scan.uses.filter(use=>use.field==='rate').map(use=>use.componentId)).toEqual(['region-table','review-table']);
    expect(JSON.stringify(scan)).not.toContain('东区');
    expect(JSON.stringify(scan)).not.toContain('999');
    expect(JSON.stringify(document)).toBe(before);
  });
  it('重复选择去重，容器选中其子项，保留祖先条件与全页诊断',()=>{
    const document=scopedPage(),children=document.sections[0].components;
    document.sections[0].components=[{id:'group',type:'compositeCard',visibleWhen:{filter:'region',op:'eq',value:'east'},props:{components:children}}];
    document.sections[1].components[0].type='unknown';
    document.filters=[{id:'region',type:'select',dimension:'region'}];
    document.params=[{id:'year',value:2026}];
    const scan=scopedScan(document,['group','group']);
    expect(scan.selectedComponents.map(c=>c.id)).toEqual(['group','region-table','review-table']);
    expect(scan.scope.requestedComponents).toEqual(['group']);
    expect(scan.filters).toEqual(document.filters);
    expect(scan.params).toEqual(document.params);
    expect(scan.diagnostics.some(d=>d.type==='UNKNOWN_COMPONENT')).toBe(true);
    expect(scopedScan(document,['region-table']).uses.some(use=>use.componentId==='group' && use.kind==='filter-reference')).toBe(true);
  });
  it('沿查询结果、计算和组合源引用展开，循环终止并保留缺失源诊断',()=>{
    const document=scopedPage();
    document.dataSources['voice-closure'].compute=[{op:'joinAggregate',source:'upstream'}];
    document.dataSources.upstream={source:{type:'inline',rows:[{hidden:'secret'}]},fields:{}};
    document.dataSources.dependent={fields:{},source:{type:'query',query:{resultBindings:[{source:'voice-closure'}],initial:[{hidden:'secret'}]}}};
    document.dataSources.combined={fields:{},source:{type:'pagedJoin',members:{a:{source:'dependent'},b:{source:'missing'}}}};
    document.dataSources.upstream.compute=[{op:'joinAggregate',source:'voice-closure'}];
    const scan=scopedScan(document,['region-table']);
    expect(scan.scope.sourceIds).toEqual(expect.arrayContaining(['voice-closure','upstream','dependent','combined','missing']));
    expect(Object.keys(scan.sources)).not.toContain('independent-summary');
    expect(scan.diagnostics).toContainEqual({type:'UNKNOWN_SOURCE',source:'missing'});
    expect(JSON.stringify(scan)).not.toContain('secret');
  });
  it('静态组件不拉入无关源，详情视图中的共享消费者仍被找到',()=>{
    const document=scopedPage();
    document.sections.push({id:'notes',components:[{id:'note',type:'text',props:{content:'说明'}}]});
    document.detailViews=[{id:'detail',components:[{...document.sections[0].components[1],id:'detail-table'}]}];
    expect(Object.keys(scopedScan(document,['note']).sources)).toEqual([]);
    expect(scopedScan(document,['region-table']).consumers.map(c=>c.id)).toContain('detail-table');
    expect(scopedScan(document,['detail-table']).selectedComponents[0].path).toBe('/detailViews/0/components/0');
  });
  it('未知或重复组件身份明确失败，不能返回假成功的空范围',()=>{
    const document=scopedPage();
    expect(()=>scopedScan(document,['missing'])).toThrow('expected one component, found 0');
    document.sections[0].components[1].id='region-table';
    expect(()=>scopedScan(document,['region-table'])).toThrow('expected one component, found 2');
  });
  it('新增共享消费者携带其比较槽、祖先条件和其他引用的完整上下文',()=>{
    const document=scopedPage();
    const shared={id:'shared-card',type:'metricCard',data:{main:'voice-closure',compare:'independent-summary'},props:{rows:[
      {label:'闭环率',valueField:'rate'},
      {label:'比较',valueField:{data:'compare',field:'count'}}
    ]}};
    document.sections.push({id:'shared',components:[{id:'shared-parent',type:'compositeCard',visibleWhen:{filter:'region',op:'eq',value:'east'},props:{components:[shared]}}]});
    const scan=scopedScan(document,['region-table']);
    expect(Object.keys(scan.sources)).toEqual(['voice-closure','independent-summary']);
    expect(scan.uses.some(use=>use.componentId==='shared-card' && use.slot==='compare' && use.field==='count')).toBe(true);
    expect(scan.uses.some(use=>use.componentId==='shared-parent' && use.kind==='filter-reference')).toBe(true);
    expect(scan.consumers.map(c=>c.id)).toContain('other-card');
  });
  it('仓外支持多组件扫描，报告命令拒绝范围参数，原文件保持不变',()=>{
    const file=path.join(isolated,'scope.json'),content=JSON.stringify(scopedPage());
    writeFileSync(file,content);
    const result=run('analyze-data',['scan','--page',file,'--component','region-table','--component','review-table']);
    expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).selectedComponents.map((c:any)=>c.id)).toEqual(['region-table','review-table']);
    for(const command of ['draft','check','prepare']) {
      const rejected=run('analyze-data',[command,'--page',file,'--component','region-table']);
      expect(rejected.status).toBe(2);
      expect(rejected.stderr).toContain('full-page coverage');
    }
    expect(readFileSync(file,'utf8')).toBe(content);
  });
});

describe('按需协议知识',()=>{
  it('压缩知识可无损还原，损坏的编码明确失败',()=>{
    expect(decodeKnowledge(encodeKnowledge(model))).toEqual(model);
    expect(()=>decodeKnowledge('{"encoding":"unknown","data":""}')).toThrow('Invalid knowledge encoding');
    expect(()=>decodeKnowledge('{"encoding":"gzip-base64","data":"broken"}')).toThrow();
  });
  it('新增或重命名语义章节要求显式复核路由，而不是悄悄漏读',()=>{
    expect(()=>validateSemanticHeadings('x.md',['# X','## New\nrule'],[])).toThrow('page/reference/x.md');
    expect(()=>validateSemanticHeadings('x.md',['# X','## New\nrule'],['Old'])).toThrow('semantic headings changed');
    expect(()=>validateSemanticHeadings('x.md',['# X','## New\nrule'],['New'])).not.toThrow();
  });
  it('接口帮助无需加载全部知识或阅读压缩脚本',()=>{
    expect(JSON.parse(run('read-knowledge',['--help']).stdout).commands.length).toBeGreaterThan(0);
    expect(JSON.parse(run('analyze-data',['--help']).stdout).sideEffects).toContain('never writes');
  });
  it('窄属性保留父约束、语义与未展开引用，避免整册加载',()=>{
    const result=knowledgeSelection(model,['table.width']) as any;
    expect(result.nodes.find((n:any)=>n.pointer.endsWith('/properties/width')).facts.minimum).toBe(1);
    expect(result.nodes.some((n:any)=>n.pointer.endsWith('/properties/pagination'))).toBe(false);
    expect(result.semantics[0].blocks.join('\n')).toContain('columns');
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(16384);
    expect(result.scope).toContain('partial');
  });
  it('多主题去重，循环和未知主题明确失败',()=>{
    expect(topicClosure(model,['table.width','table.width'])).toEqual(['table.width']);
    expect(()=>topicClosure(model,['missing'])).toThrow('Unknown topic');
    const changed=structuredClone(model);changed.topics['table.width'].dependencies=['table.width'];
    expect(()=>topicClosure(changed,['table.width'])).toThrow('Cyclic');
  });
  it('常用主题没有截断且受输出预算约束，全部模块可发现语义',()=>{
    const map=JSON.parse(readFileSync('docs/page-metadata/reference-map.json','utf8'));
    for(const id of Object.keys(map.authoringTopics)) expect(Buffer.byteLength(JSON.stringify(knowledgeSelection(model,[id]))),id).toBeLessThanOrEqual(16384);
    for(const [id,module] of Object.entries(model.modules)) {
      const sections=new Set(Object.values(model.topics).filter(t=>t.module===id).flatMap(t=>t.sections));
      expect(sections.size,id).toBe(module.semantics.length);
    }
  });
  it('仓外脚本可查阅，混装哈希失败且不输出全量知识',()=>{
    const result=run('read-knowledge',['show','--topic','table.width']);
    expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).topics).toEqual(['table.width']);
    expect(run('read-knowledge',['show','--topic','unknown']).status).toBe(1);
    const file=path.join(isolated,'skill/references/authoring-knowledge/model.json');
    const original=readFileSync(file);writeFileSync(file,Buffer.concat([original,Buffer.from(' ')]));
    try {expect(run('read-knowledge',['show','--topic','table.width']).status).toBe(2);} finally {writeFileSync(file,original);}
  });
});

describe('页面用数和指标材料',()=>{
  it('嵌套图例与表格同名时仍识别真实组件及其字段',()=>{
    const fixture=JSON.parse(readFileSync('pages/capabilities/chart/pie-table-legend.json','utf8'));
    const component=fixture.sections[0].components[0];
    const category=component.props.categoryField;
    const value=component.props.valueField;
    component.type='table';
    component.props={columns:[{field:category},{field:value}]};
    fixture.sections=[{id:'table',components:[component]}];
    const scan=scanPageData(fixture,model.schema);
    expect(scan.diagnostics).toEqual([]);
    expect(scan.uses.filter(use=>use.kind==='field').map(use=>use.field)).toEqual([category,value]);
  });

  it('合流后的独立筛选按钮组可查阅，卡内与正文绑定均被发现',()=>{
    const result=knowledgeSelection(model,['filterGroup.core']) as any;
    expect(result.semantics[0].blocks.join('\n')).toContain('旧图表 `props.filter` 已移除');
    const fixture=JSON.parse(readFileSync('pages/capabilities/filters/filter-group-state-page.json','utf8'));
    const scan=scanPageData(fixture,model.schema);
    expect(scan.diagnostics).toEqual([]);
    const filterIds=scan.uses.filter(use=>use.componentType==='filterGroup').map(use=>use.declaration?.filterId);
    expect(filterIds).toContain('channel');
    expect(filterIds).toContain('card-region');
  });
  it('递归覆盖容器，保留字段标签，不把初始行或演示行传给模型',()=>{
    const scan=scanPageData(page,model.schema);
    expect(scan.uses.filter(use=>use.field).map(use=>use.field)).toContain('amount');
    expect(scan.uses.find(use=>use.field==='amount' && use.componentId==='amount-card')?.label).toBe('签约金额');
    expect(scan.diagnostics).toEqual([]);
    expect(JSON.stringify(scan)).not.toContain('华东示范区');
    const nested=structuredClone(page);
    const table=nested.sections[0].components.pop();
    nested.sections[0].components.push({id:'tabs',type:'tabContainer',layout:{span:12},props:{tabs:[{id:'one',label:'明细',component:table}]}});
    expect(scanPageData(nested,model.schema).uses.some(use=>use.path.includes('/tabs/0/component/'))).toBe(true);
  });
  it('多槽、筛选分支、行条件、动态文字及关联数据保留各自来源',()=>{
    const document=structuredClone(page),card=document.sections[0].components[0];
    card.data.compare='other';document.dataSources.other=structuredClone(document.dataSources['business-summary']);
    card.props.rows[0].valueField={byFilter:{filterId:'currency',cases:{CNY:'amount',USD:{data:'compare',field:'amount'}}}};
    card.visibleWhen={filter:'region',part:'value',op:'eq',value:'CN'};
    document.sections[0].components.push({id:'ai',type:'aiSummary',layout:{span:12},props:{promptTemplate:'summary',relatedDataSources:['other']}});
    const scan=scanPageData(document,model.schema);
    expect(scan.uses.some(use=>use.slot==='compare' && use.source==='other' && use.field==='amount')).toBe(true);
    expect(scan.uses.some(use=>use.kind==='related-data' && use.source==='other')).toBe(true);
    expect(scan.uses.some(use=>use.kind==='filter-reference')).toBe(true);
  });
  it('未知组件与损坏引用给出诊断，不静默忽略',()=>{
    const changed=structuredClone(page);changed.sections[0].components[0].type='unknown';
    expect(scanPageData(changed,model.schema).diagnostics[0].type).toBe('UNKNOWN_COMPONENT');
    changed.sections[0].components[0].type='metricCard';changed.sections[0].components[0].data.main='missing';
    expect(scanPageData(changed,model.schema).diagnostics.some(d=>d.type==='UNKNOWN_FIELD')).toBe(true);
  });
  it('MD 分块保留行号，代码块中的标题不是新章节；检索不把同名候选消歧',()=>{
    const blocks=markdownBlocks(md);
    for(const block of blocks) expect(md.split('\n').slice(block.from-1,block.to).join('\n')).toBe(block.text);
    expect(findBlocks(blocks,['签约金额'],30).blocks.length).toBeGreaterThan(1);
    expect(markdownBlocks('# A\n```\n# code\n```\n## B').some(b=>b.heading==='code')).toBe(false);
    expect(findBlocks(blocks,['签约金额'],1).omittedMatches).toBeGreaterThan(0);
  });
  it('草稿覆盖全部字段位置、去重共性问题；同名命中仍未匹配/未执行',()=>{
    const draft=draftAnalysis(page,model.schema,hashBytes(pageText),md);
    expect(draft.entries.every((e:any)=>e.matching==='unresolved' && e.execution==='not-run')).toBe(true);
    expect(draft.gaps.length).toBeLessThan(draft.entries.length);
    expect(checkAnalysis(draft,draft,md)).toEqual([]);
  });
  it.each(['stale','missing-use','quote','range','attest','gap','duplicate','identity'])('拒绝错误报告：%s',mode=>{
    const draft=draftAnalysis(page,model.schema,hashBytes(pageText),md),report=structuredClone(draft);
    if(mode==='stale')report.mdSha256='old';
    if(mode==='missing-use')report.entries.pop();
    if(mode==='quote')report.entries[0].evidence=[{from:1,to:2,quote:'不存在的原文'}];
    if(mode==='range')report.entries[0].evidence=[{from:0,to:9999,quote:'fake'}];
    if(mode==='attest')report.entries[0].execution='verified';
    if(mode==='gap')report.gaps=[];
    if(mode==='duplicate')report.entries.push(report.entries[0]);
    if(mode==='identity')report.entries[0].use.source='other';
    expect(checkAnalysis(report,draft,md).length).toBeGreaterThan(0);
  });
  it('有据匹配可形成静态查询候选，仍不冒充执行；无据 queryField 被拒绝',()=>{
    const single=structuredClone(page);single.sections[0].components=single.sections[0].components.slice(0,1);
    const data=single.dataSources['business-summary'];data.fields={amount:data.fields.amount};
    const file=path.join(isolated,'single.json'),doc=path.join(isolated,'candidate.md'),reportFile=path.join(isolated,'matched.json'),proposals=path.join(isolated,'query.json');
    const content=JSON.stringify(single);writeFileSync(file,content);writeFileSync(doc,md);
    const report=draftAnalysis(single,model.schema,hashBytes(content),md);
    for(const entry of report.entries) {entry.matching='matched';entry.metricName='当期签约金额';entry.reason='本夹具指定当期口径，引用已声明的 DQE 标识';entry.missing=[];entry.evidence=[{from:3,to:10,quote:'DQE 指标：contract_amount'}];}
    report.gaps=[];writeFileSync(reportFile,JSON.stringify(report));
    const definition={fields:{amount:{...data.fields.amount,queryField:'contract_amount'}},source:{type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:[],output_metrics:['contract_amount'],filter:{dims:[],metrics:[]}}]}}}};
    writeFileSync(proposals,JSON.stringify({'business-summary':definition}));
    const args=['prepare','--page',file,'--md',doc,'--report',reportFile,'--proposals',proposals];
    const result=run('analyze-data',args);expect(result.status,result.stdout+result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).execution).toBe('not-run');
    definition.fields.amount.queryField='invented';writeFileSync(proposals,JSON.stringify({'business-summary':definition}));
    expect(run('analyze-data',args).status).toBe(1);
    expect(readFileSync(file,'utf8')).toBe(content);
  });
  it('仓外 draft/check/prepare 不修改页面；未解决匹配阻止候选',()=>{
    const file=path.join(isolated,`${page.id}.json`),doc=path.join(isolated,'metrics.md'),reportFile=path.join(isolated,'report.json'),proposals=path.join(isolated,'proposals.json');
    writeFileSync(file,pageText);writeFileSync(doc,md);
    const args=['--page',file,'--md',doc];
    const result=run('analyze-data',['draft',...args]);expect(result.status,result.stderr).toBe(0);writeFileSync(reportFile,result.stdout);
    expect(run('analyze-data',['check',...args,'--report',reportFile]).status).toBe(0);
    writeFileSync(proposals,JSON.stringify({'business-summary':page.dataSources['business-summary']}));
    const candidate=run('analyze-data',['prepare',...args,'--report',reportFile,'--proposals',proposals]);
    expect(candidate.status,candidate.stderr).toBe(1);
    expect(JSON.parse(candidate.stdout).pageUnchanged).toBe(true);
    expect(readFileSync(file,'utf8')).toBe(pageText);
  });
});
