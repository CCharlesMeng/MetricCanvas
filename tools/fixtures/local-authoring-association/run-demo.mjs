/** Node-only synthetic scenario. --tools and --page are explicit local caller paths. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

function options(args) {
  const values={};
  for(let i=0;i<args.length;i+=2) {
    if(!['--tools','--page','--out-dir'].includes(args[i]) || !args[i+1])throw Error('Expected --tools scripts-directory --page page.json --out-dir new-directory');
    values[args[i]]=resolve(args[i+1]);
  }
  if(!values['--tools'] || !values['--page'] || !values['--out-dir'])throw Error('Missing required local path');
  return values;
}
function invoke(config,operation,input,name) {
  const inputFile=join(config['--out-dir'],name+'-input.json');
  writeFileSync(inputFile,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
  const result=spawnSync(process.execPath,[join(config['--tools'],'associate-data.mjs'),operation,'--page',config['--page'],'--input',inputFile],{cwd:config['--out-dir'],encoding:'utf8',timeout:20_000});
  if(![0,2].includes(result.status))throw Error(result.stderr || 'Product program failed');
  const receipt=JSON.parse(result.stdout);
  writeFileSync(join(config['--out-dir'],name+'-result.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return receipt;
}
function resultRecord() {
  const request={dataSourceId:'new-sales',businessDomain:'合成销售',metrics:[{kind:'metric',name:'成交额'}],groupBy:['区域编码'],filters:[],time:null};
  return {resultRef:'result-synthetic-sales',status:'ready',binding:{sessionId:'synthetic-session',turnId:'synthetic-turn'},dataContextVersion:'synthetic-v1',validationPolicy:'synthetic-policy',request,
    source:{fields:{'region-output':{type:'string',role:'dimension',queryField:'区域编码',nullable:false},'value-output':{type:'number',role:'measure',queryField:'成交额',unit:'元',nullable:true}},
      source:{type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['区域编码'],output_metrics:['成交额'],filter:{dims:[],metrics:[]},order:{}}]}}}},
    rows:[{'区域编码':'CN','成交额':30.5},{'区域编码':'EU','成交额':40.25}],returnedCount:2,totalCount:2,capturedAt:'2026-07-01T00:00:00Z'};
}
function main(args) {
  const config=options(args),original=readFileSync(config['--page'],'utf8'),document=JSON.parse(original);
  mkdirSync(config['--out-dir']);
  const draft=invoke(config,'page.analyze',{componentIds:['sales-main']},'draft');
  if(draft.status==='error')throw Error(JSON.stringify(draft.diagnostics));
  const record=resultRecord(),fieldMap={region:'region-output',value:'value-output'};
  const links=draft.data.uses.filter(use=>use.source==='sales' && use.field).map(use=>({requirementId:'sales-requirement',dataRequestId:record.request.dataSourceId,useId:use.useId,outputField:fieldMap[use.field],resultRef:record.resultRef}));
  const context={binding:record.binding,dataContextVersion:record.dataContextVersion,validationPolicy:record.validationPolicy};
  const association={context,requirements:[{id:'sales-requirement',text:'保留两张表、字段、列、格式与布局，接入同区域粒度的合成结果'}],dataRequests:[record.request],links,resultRecords:{[record.resultRef]:record},componentIds:['sales-main']};
  const linked=invoke(config,'page.analyze',association,'linked');
  if(linked.status==='error')throw Error(JSON.stringify(linked.diagnostics));
  const baselineScope={groupBy:['region'],time:null,provenance:{documentSha256:createHash('sha256').update(original).digest('hex'),sourceId:'sales',reference:'synthetic-scene-region-grain'}};
  const rebind={report:linked.data,sourceId:'sales',resultRef:record.resultRef,fieldMap,resultRecords:association.resultRecords,context,baselineScope};
  const candidate=invoke(config,'page.rebind',rebind,'candidate');
  if(candidate.status!=='ok')throw Error(JSON.stringify(candidate.diagnostics));
  if(JSON.stringify(candidate.data.document.sections)!==JSON.stringify(document.sections))throw Error('Existing sections changed');
  if(JSON.stringify(candidate.data.document.dataSources.control)!==JSON.stringify(document.dataSources.control))throw Error('Unrelated source changed');
  writeFileSync(join(config['--out-dir'],'candidate-page.json'),JSON.stringify(candidate.data.document,null,2)+'\n',{flag:'wx'});
  const invalid=structuredClone(rebind);invalid.resultRecords[record.resultRef].rows[1]['区域编码']='CN';
  const rejected=invoke(config,'page.rebind',invalid,'duplicate-key');
  if(rejected.status!=='error' || rejected.data.document!==null)throw Error('Duplicate row key was not atomically refused');
  if(readFileSync(config['--page'],'utf8')!==original)throw Error('The original page file was changed');
  process.stdout.write(JSON.stringify({candidate:'not-saved',execution:'not-run',sourceUnchanged:true,output:config['--out-dir'],diagnostics:rejected.diagnostics})+'\n');
}
main(process.argv.slice(2));
