/** Run only with an already verified business PageDocument and trusted real transport config. */
import {readFileSync} from 'node:fs';
import {resolvePageParams} from '../../packages/page/src';
import {tableHeaders,type DataSnapshot,type Row,type TableQueryView} from '../../packages/page/src/internal';
import {createDqeGateway} from '../../packages/data-execution/src/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues,evaluateTableView} from '../../packages/data-execution/src/runtime';

async function main(){
 const endpoint=process.env.METRICCANVAS_DQE_ENDPOINT;
 if(!endpoint||!URL.canParse(endpoint)){console.log(JSON.stringify({status:'NOT_RUN',reason:'NO_TRUSTED_REAL_DQE_ENDPOINT'}));process.exitCode=2;return;}
 const file=process.argv[2];if(!file)throw Error('请传入已验真的 6.22 业务页面文件');
 const resolution=resolvePageParams(JSON.parse(readFileSync(file,'utf8')));if(!resolution.ok)throw Error('页面或参数不合法');
 const page=resolution.resolvedPage;
 const id=process.argv[3]??Object.keys(page.dataSources).find(id=>page.dataSources[id].source.type==='pagedJoin');
 if(!id)throw Error('页面没有组合查询源');const source=page.dataSources[id];if(source.source.type!=='pagedJoin')throw Error('指定源不是组合查询源');
 const definition=source.source;
 const headers:unknown=JSON.parse(process.env.METRICCANVAS_DQE_HEADERS??'{}');
 if(!headers||typeof headers!=='object'||Array.isArray(headers)||Object.values(headers).some(v=>typeof v!=='string'))throw Error('可信请求头配置不合法');
 const program=createSourceProgram(page,{gateway:createDqeGateway({endpoint,headers:headers as Record<string,string>})});
 const conditions=initialFilterValues(page.filters??[]),raw=new Map<string,Row[]>();
 const roots=[...new Set(Object.values(definition.members).map(member=>member.source))];
 try{
  for await(const update of program.read({roots,conditions,freshness:'refresh',signal:AbortSignal.timeout(60_000)})){
   if(update.snapshot.status!=='ready'&&update.snapshot.status!=='empty')throw Error('普通成员真实读取失败');
   raw.set(update.sourceId,update.snapshot.status==='ready'?update.snapshot.rows:[]);
  }
  const indexes=new Map<string,Map<string|number,Row>>();
  for(const [name,member] of Object.entries(definition.members)){
   const rows=raw.get(member.source)!;const index=new Map<string|number,Row>();
   for(const row of rows){const key=row[member.key.field];if((typeof key!=='string'&&typeof key!=='number')||key===''||index.has(key))throw Error('真实成员粒度或业务键不合法');index.set(key,row);}
   indexes.set(name,index);
  }
  const domain=indexes.get(definition.domainMember)!;
  for(const [name,member] of Object.entries(definition.members))if(member.canSelectPage){const keys=indexes.get(name)!;if(keys.size!==domain.size||[...domain.keys()].some(key=>!keys.has(key)))throw Error('选页成员与业务行域不一致');}
  const completeRows=[...domain.keys()].map(key=>{
   const row:Row={};for(const [field,projection] of Object.entries(definition.projection))row[field]=indexes.get(projection.member)?.get(key)?.[projection.field]??null;return row;
  });
  const cases:Array<{name:string;view:TableQueryView;purpose?:'complete'}>=[];
  const initial=defaultSourceView(page,id);cases.push({name:'default',view:initial});
  for(const field of definition.ordering.sortableFields)for(const direction of ['asc','desc'] as const){
   const view={...initial,sort:[{field,direction}]};cases.push({name:`sort:${field}:${direction}`,view});if(domain.size>view.pageSize)cases.push({name:`page2:${field}:${direction}`,view:{...view,pageIndex:1}});
  }
  const sortField=definition.ordering.sortableFields[0];
  const other=definition.ordering.sortableFields.find(field=>definition.projection[field].member!==definition.projection[sortField].member&&['number','money'].includes(source.fields[field].type));
  if(other&&domain.size<=definition.fallback.maxRows){const values=completeRows.map(r=>r[other]).filter((v):v is number=>typeof v==='number').sort((a,b)=>a-b);if(values.length)cases.push({name:'cross-source-filter',view:{...initial,predicates:[{field:other,op:'gte',value:values[Math.floor(values.length/2)]}]}});}
  cases.push({name:'complete-export',view:initial,purpose:'complete'});
  const results=[];
  for(const item of cases){
   const sort=[...(item.view.sort.length?item.view.sort:definition.ordering.default)];if(!sort.some(rule=>rule.field===definition.rowKey))sort.push({field:definition.rowKey,direction:'asc'});
   const expected=evaluateTableView(completeRows,{...item.view,sort},item.purpose==='complete');let snapshot:DataSnapshot|undefined;
   for await(const update of program.read({roots:[id],conditions,views:new Map([[id,item.view]]),purpose:item.purpose,freshness:'refresh'}))snapshot=update.snapshot;
   if(snapshot?.status!=='ready'&&snapshot?.status!=='empty')throw Error('真实组合执行失败');
   const rows=snapshot.status==='ready'?snapshot.rows:[];
   if(snapshot.totalCount!==expected.totalCount||JSON.stringify(rows.map(r=>r[definition.rowKey]))!==JSON.stringify(expected.rows.map(r=>r[definition.rowKey])))throw Error('真实排序、窗口、补列或总数与完整行域不一致');
   for(let index=0;index<rows.length;index++)for(const field of Object.keys(definition.projection))if(JSON.stringify(rows[index][field])!==JSON.stringify(expected.rows[index][field]))throw Error('真实补列投影不一致');
   results.push({case:item.name,rows:rows.length,totalCount:snapshot.totalCount,passed:true});
  }
  console.log(JSON.stringify({status:'PASS',pageId:page.id,sourceId:id,domainRows:domain.size,results,limitations:['多次读取无事务快照令牌；同总数内容变化仍需上游保障','本程序只能证明运行所在环境，Relay 需在实际部署中执行并留回执']},null,2));
 }finally{program.dispose();}
}
try{await main();}catch{console.log(JSON.stringify({status:'FAIL',reason:'REAL_ACCEPTANCE_FAILED_CHECK_TRANSPORT_CONTRACT_AND_DATA_DOMAIN'}));process.exitCode=1;}
