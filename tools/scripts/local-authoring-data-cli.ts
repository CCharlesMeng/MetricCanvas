import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAnalysis, draftAnalysis, findBlocks, hashBytes, markdownBlocks, scanPageData } from './local-authoring-data-analysis';
import { parsePage } from '../../packages/page/src/validate';
import { versionPolicy } from '../../packages/page/src/version';

function options(args:string[]):Record<string,string[]> {
  const result:Record<string,string[]>={};
  if(args.length%2) throw new TypeError('Arguments must be --name value pairs');
  for(let i=0;i<args.length;i+=2) {
    if(!['--page','--md','--report','--search','--limit','--proposals'].includes(args[i])) throw new TypeError(`Unknown argument ${args[i]}`);
    (result[args[i]]??=[]).push(args[i+1]);
  }
  return result;
}
function required(options:Record<string,string[]>,key:string):string {
  if(options[key]?.length!==1) throw new TypeError(`Exactly one ${key} is required`);
  return options[key][0];
}
function run(args:string[]):unknown {
  if(args.length===1 && args[0]==='--help') return {commands:['scan --page file','index --md file','find --md file --search text [--search text] [--limit 1..30]',
    'draft --page file --md file','check --page file --md file --report file','prepare --page file --md file --report file --proposals file'],
    output:'JSON; draft is a report template; matched entries require metricName/reason/evidence; execution remains not-run',
    evidence:'{from:1-based line,to:inclusive line,quote:verbatim text}',sideEffects:'reads only; outputs stdout; never writes input pages',errors:'1 report/candidate; 2 usage/file'};
  const [command,...rest]=args,opt=options(rest);
  if(command==='index') {const text=readFileSync(required(opt,'--md'),'utf8');return {mdSha256:hashBytes(text),blocks:markdownBlocks(text).map(({text,...b})=>({...b,bytes:Buffer.byteLength(text)}))};}
  if(command==='find') {
    const text=readFileSync(required(opt,'--md'),'utf8'),limit=Number(opt['--limit']?.[0]??5);
    if(!Number.isInteger(limit)||limit<1||limit>30||!opt['--search']?.length) throw new TypeError('find requires --search and limit 1..30');
    return {mdSha256:hashBytes(text),...findBlocks(markdownBlocks(text),opt['--search'],limit)};
  }
  if(!['scan','draft','check','prepare'].includes(command)) throw new TypeError('Usage: analyze-data.mjs scan --page file | index/find --md file [--search text] | draft --page file --md file | check/prepare --page file --md file --report file [--proposals file]');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const schemaText=readFileSync(path.join(root,'references/page-metadata/schema.json'),'utf8');
  const manifest=JSON.parse(readFileSync(path.join(root,'references/knowledge.json'),'utf8'));
  if(manifest.schemaVersion!==versionPolicy.current) throw new Error('Validator version mismatch; replace the complete Skill');
  if(manifest.schemaSha256!==hashBytes(schemaText)) throw new Error('Schema hash mismatch; replace the complete Skill');
  const schema=JSON.parse(schemaText),pageText=readFileSync(required(opt,'--page'),'utf8'),page=JSON.parse(pageText);
  if(command==='scan') return {pageSha256:hashBytes(pageText),...scanPageData(page,schema)};
  const md=readFileSync(required(opt,'--md'),'utf8'),draft=draftAnalysis(page,schema,hashBytes(pageText),md);
  draft.inputs={page:required(opt,'--page'),md:required(opt,'--md')};
  if(command==='draft') return draft;
  const report=JSON.parse(readFileSync(required(opt,'--report'),'utf8'));
  const errors=checkAnalysis(report,draft,md);
  if(command==='prepare' && !errors.length) return prepareCandidates(JSON.parse(readFileSync(required(opt,'--proposals'),'utf8')),page,report,md);
  if(errors.length) process.exitCode=1;
  return {errors,execution:'not-run',pageUnchanged:true};
}

function prepareCandidates(proposals:Record<string,any>,page:Record<string,any>,report:Record<string,any>,md:string):unknown {
  const errors:string[]=[];
  if(!proposals || Array.isArray(proposals) || !Object.keys(proposals).length) throw new TypeError('proposals must be a nonempty dataSources object');
  for(const [id,definition] of Object.entries(proposals)) {
    const entries=report.entries.filter((entry:any)=>entry.use.source===id);
    if(!entries.length||entries.some((entry:any)=>entry.matching!=='matched'||entry.missing?.length)) errors.push(`${id}: all affected data uses must be matched without unresolved gaps`);
    if(definition?.source?.type!=='query') errors.push(`${id}: expected a query source proposal`);
    if(definition?.source?.initial || definition?.initial) errors.push(`${id}: unexecuted proposals cannot include initial rows`);
    for(const [fieldId,field] of Object.entries(definition?.fields ?? {}) as Array<[string,any]>) {
      const evidence=entries.filter((entry:any)=>entry.use.field===fieldId).flatMap((entry:any)=>entry.evidence);
      if(typeof field.queryField!=='string'||!evidence.some((item:any)=>md.split('\n').slice(item.from-1,item.to).join('\n').includes(field.queryField))) errors.push(`${id}/${fieldId}: queryField requires cited document evidence`);
    }
  }
  const candidate=structuredClone(page);candidate.dataSources={...candidate.dataSources,...proposals};
  const parsed=parsePage(candidate);
  if(!parsed.ok) errors.push(...parsed.errors.map(error=>`${error.type} ${error.path} ${error.message}`));
  if(errors.length) process.exitCode=1;
  return {errors,execution:'not-run',pageUnchanged:true,pageSha256:report.pageSha256,mdSha256:report.mdSha256,dataSources:errors.length?undefined:proposals,
    next:'真实执行并核对字段/粒度/条件/完整性后，才可写回目标页面；静态候选不是执行回执。'};
}
try {console.log(JSON.stringify(run(process.argv.slice(2))));}
catch(error) {console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)}));process.exitCode=2;}
