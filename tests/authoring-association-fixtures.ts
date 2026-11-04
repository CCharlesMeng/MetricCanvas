import {rawSha256} from '../tools/scripts/authoring-analysis-adapter';
import {runAnalysisOperation} from '../tools/scripts/authoring-analysis-program';

export function ordinaryPage() {
  const fields={region:{type:'string',role:'dimension',queryField:'地区',nullable:false},value:{type:'number',role:'measure',queryField:'金额',unit:'元',nullable:true,defaultFormat:'number-grouped'}};
  const query={language:'dqe',body:{dsl_list:[{output_dims:['地区'],output_metrics:['金额'],filter:{dims:[],metrics:[],time:{period:'month',start:'2026-01',end:'2026-06',is_aggregate:true}},order:{offset:0,limit:20}}]}};
  const source={fields,source:{type:'query',query,initial:{capturedAt:'2026-07-01T00:00:00Z',rows:[{'地区':'CN','金额':10},{'地区':'EU','金额':20}],totalCount:2}}};
  const component={id:'table-a',type:'table',layout:{span:12},data:{main:'sales'},props:{rowKey:'region',columns:[{field:'region',width:180},{field:{data:'main',field:'value',format:'number-2'}}]}};
  return {schemaVersion:'6.82',id:'analysis-rebind-demo',layout:'dashboard',meta:{title:'共享用数与换源（合成）'},dataSources:{sales:source,unrelated:structuredClone(source)},
    sections:[{id:'main',container:'card',components:[component,{...structuredClone(component),id:'table-b'},{...structuredClone(component),id:'unrelated-table',data:{main:'unrelated'}}]}]};
}

export function rawInput(document:unknown=ordinaryPage()):Record<string,any> {
  const documentJson=JSON.stringify(document,null,2)+'\n';
  return {documentJson,baseline:{documentSha256:rawSha256(documentJson),source:'file'}};
}

export function linkedFixture() {
  const input=rawInput();
  const request={dataSourceId:'new-sales',businessDomain:'合成销售',metrics:[{kind:'metric',name:'成交额'}],groupBy:['区域编码'],filters:[],time:{granularity:'month',start:'2026-01',end:'2026-06',providedBy:'user'}};
  const context={binding:{sessionId:'synthetic-session',turnId:'synthetic-turn',pageId:'analysis-rebind-demo'},dataContextVersion:'synthetic-v1',validationPolicy:'synthetic-policy-v1'};
  const record={resultRef:'result-synthetic-new-sales',status:'ready',...context,request,
    source:{fields:{'region-output':{type:'string',role:'dimension',queryField:'区域编码',nullable:false},'value-output':{type:'number',role:'measure',queryField:'成交额',unit:'元',nullable:true}},
      source:{type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['区域编码'],output_metrics:['成交额'],filter:{dims:[],metrics:[],time:{period:'month',start:'2026-01',end:'2026-06',is_aggregate:true}},order:{offset:0,limit:20}}]}},
        initial:{capturedAt:'2026-07-01T00:00:00Z',rows:[{'区域编码':'CN','成交额':30}]}}},
    rows:[{'区域编码':'CN','成交额':30},{'区域编码':'EU','成交额':40}],returnedCount:2,totalCount:2,capturedAt:'2026-07-01T00:00:00Z'};
  const draft=runAnalysisOperation('page.analyze',input).data as Record<string,any>;
  const fieldMap={region:'region-output',value:'value-output'};
  const links=draft.uses.filter((use:any)=>use.source==='sales'&&use.field).map((use:any)=>({requirementId:'sales-report',dataRequestId:request.dataSourceId,useId:use.useId,outputField:fieldMap[use.field as keyof typeof fieldMap],resultRef:record.resultRef}));
  const analyze:Record<string,any>={...input,context,requirements:[{id:'sales-report',text:'保留共享表格呈现，以相同月份粒度接入成交额结果'}],dataRequests:[request],links,resultRecords:{[record.resultRef]:record},componentIds:['table-a']};
  const report=runAnalysisOperation('page.analyze',analyze).data;
  return {input,analyze,report,record,request,context,fieldMap,rebind:{...input,report,context,resultRecords:{[record.resultRef]:record},sourceId:'sales',resultRef:record.resultRef,fieldMap}};
}

export function auxiliaryFixture() {
  const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson);
  document.dataSources.previous=structuredClone(document.dataSources.sales);
  for(const component of document.sections[0].components.slice(0,2)) {
    component.data.previous='previous';
    component.props.columns.push({field:{data:'previous',field:'value'},title:'对照金额'});
  }
  const base=rawInput(document),draft=runAnalysisOperation('page.analyze',base).data as any;
  const links=draft.uses.filter((use:any)=>use.source==='previous'&&use.field).map((use:any)=>({requirementId:'sales-report',dataRequestId:fixture.request.dataSourceId,useId:use.useId,outputField:(fixture.fieldMap as Record<string,string>)[use.field],resultRef:fixture.record.resultRef}));
  const analyze:Record<string,any>={...fixture.analyze,...base,links};
  const report=runAnalysisOperation('page.analyze',analyze).data;
  return {...fixture,analyze,rebind:{...fixture.rebind,...base,report,sourceId:'previous'}};
}

export function dependentFixture() {
  const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson),record=structuredClone(fixture.record) as any;
  document.dataSources.sales.source.resultScope='complete';document.dataSources.sales.source.query.body.dsl_list[0].order={};
  record.source.source.resultScope='complete';record.source.source.query.body.dsl_list[0].order={};
  document.dataSources.dependent=structuredClone(document.dataSources.sales);
  document.dataSources.dependent.source.query.resultBindings=[{source:'sales',field:'region',target:'dimension',queryField:'地区',maxValues:100}];
  document.sections[0].components.push({...structuredClone(document.sections[0].components[0]),id:'dependent-table',data:{main:'dependent'}});
  const base=rawInput(document),analyze={...fixture.analyze,...base,resultRecords:{[record.resultRef]:record}};
  const report=runAnalysisOperation('page.analyze',analyze).data;
  return {...fixture,input:base,record,analyze,rebind:{...fixture.rebind,...base,report,resultRecords:{[record.resultRef]:record}}};
}

export function pinnedFixture() {
  const fixture=linkedFixture(),document=JSON.parse(fixture.input.documentJson),record=structuredClone(fixture.record) as any;
  const summary=structuredClone(document.dataSources.sales);
  delete summary.fields.region;summary.source.resultScope='complete';
  summary.source.query.body.dsl_list[0].output_dims=[];summary.source.query.body.dsl_list[0].order={};
  summary.source.initial.rows=[{'金额':100}];summary.source.initial.totalCount=1;document.dataSources.summary=summary;
  for(const component of document.sections[0].components.slice(0,2)) {
    component.data.summary='summary';component.props.pinnedTop={data:'summary'};
    component.props.columns[0].pinnedTop={text:'合计'};
    component.props.columns[1].pinnedTop={field:{data:'summary',field:'value'}};
  }
  delete record.source.fields['region-output'];record.source.source.resultScope='complete';
  record.source.source.query.body.dsl_list[0].output_dims=[];record.source.source.query.body.dsl_list[0].order={};
  record.request.groupBy=[];record.rows=[{'成交额':200}];record.totalCount=1;record.returnedCount=1;
  const base=rawInput(document),draft=runAnalysisOperation('page.analyze',base).data as any;
  const links=draft.uses.filter((use:any)=>use.source==='summary'&&use.field).map((use:any)=>({requirementId:'sales-report',dataRequestId:record.request.dataSourceId,useId:use.useId,outputField:'value-output',resultRef:record.resultRef}));
  const analyze:Record<string,any>={...fixture.analyze,...base,dataRequests:[record.request],links,resultRecords:{[record.resultRef]:record}};
  const report=runAnalysisOperation('page.analyze',analyze).data;
  return {...fixture,record,analyze,rebind:{...fixture.rebind,...base,report,sourceId:'summary',fieldMap:{value:'value-output'},resultRecords:{[record.resultRef]:record}}};
}
