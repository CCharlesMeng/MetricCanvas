import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
const runs=[];
for(const name of fs.readdirSync(root,{recursive:true}).filter(n=>n.endsWith('result.json')).sort()){
 const folder=path.dirname(path.join(root,name));
 const r=JSON.parse(fs.readFileSync(path.join(folder,'result.json')));
 const calls=r.turns.flatMap(t=>t.calls), tools=calls.flatMap(c=>c.tools??[]);
 let p,origin;
 if(fs.existsSync(path.join(folder,'after.json'))){p=JSON.parse(fs.readFileSync(path.join(folder,'after.json')));origin='completed';}
 else {const t=tools.filter(t=>t.artifactSha256).at(-1);if(t){p=JSON.parse(fs.readFileSync(path.join(folder,t.programFile.replace('program-tool-','candidate-')))).document;origin='unfinished-last-candidate';}}
 const topics={scale:[],growth:[],target:[],risk:[],targetProxy:[]};
 const sections=(p?.sections??[]).filter(s=>s.id!=='header').map(s=>({id:s.id,title:s.title,components:s.components.map(c=>{
  const d=p.dataSources[c.data?.main],serial=JSON.stringify(c.props);
  const fields=Object.entries(d?.fields??{}).filter(([id])=>serial.includes(id)).map(([id,f])=>f.queryField??id);
  const has=(...names)=>names.every(n=>fields.includes(n));
  if(has('annual-total')||has('current-month'))topics.scale.push(c.id);
  if(has('customer-name','amount','change'))topics.growth.push(c.id);
  if(has('annual-target','annual-projection'))topics.target.push(c.id);
  if(has('customer-name','current-month-amount')&&(has('previous-month-amount')||has('january-amount')))topics.risk.push(c.id);
  if(has('target-support-rate'))topics.targetProxy.push(c.id);
  return {id:c.id,type:c.type,title:c.props.title,body:c.type==='text'?c.props.body:undefined,source:c.data?.main,fields};
 })}));
 const issues=tools.flatMap(t=>[...(t.summary.issues??[]),...(t.summary.operations??[]).flatMap(o=>o.issues??[])]);
 runs.push({id:r.id,repeat:r.repeat,status:r.status,error:r.error,origin,requests:r.modelRequests,toolCalls:r.toolCalls,
  tokens:calls.reduce((n,c)=>n+(c.usage?.total_tokens??0),0),seconds:r.seconds,
  createCalls:tools.filter(t=>t.name==='create_content_page').length,
  sourceCount:Object.keys(p?.dataSources??{}).length,sectionCount:sections.length,
  componentCount:sections.reduce((n,s)=>n+s.components.length,0),topics,sections,issues});
}
console.log(JSON.stringify({evidenceKind:'bound-field-coverage-not-semantic-or-visual-pass',runs},null,2));
