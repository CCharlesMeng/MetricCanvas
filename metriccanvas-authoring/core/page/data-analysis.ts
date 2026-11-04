import {useFieldContract,type scanPageData} from './data-scan';
type Json=Record<string,any>;
export interface DocumentBlock {id:string;heading:string;from:number;to:number;text:string}

export function findBlocks(blocks:DocumentBlock[],terms:string[],limit:number):{blocks:DocumentBlock[];searchedBlocks:number;omittedMatches:number} {
  const needles=terms.map(s=>s.trim().toLocaleLowerCase()).filter(Boolean);
  const scored=blocks.map(block=>({block,score:needles.reduce((n,term)=>n+(block.text.toLocaleLowerCase().includes(term)?1:0),0)})).filter(b=>b.score>0).sort((a,b)=>b.score-a.score || a.block.from-b.block.from);
  return {blocks:scored.slice(0,limit).map(b=>b.block),searchedBlocks:blocks.length,omittedMatches:Math.max(0,scored.length-limit)};
}

export function draftDataAnalysis(scan:ReturnType<typeof scanPageData>,blocks:DocumentBlock[],identity:{pageSha256:string;mdSha256:string;schemaSha256:string}):Json {
  const gaps=new Map<string,Json>();
  const entries=scan.uses.filter(use=>use.field).map(use=>{
    const field=useFieldContract(use,scan.sources);
    const terms=[use.field,field?.label,field?.queryField,use.label].filter((s):s is string=>typeof s==='string');
    const candidates=findBlocks(blocks,terms,3);
    const group=`${use.source ?? 'unknown'}:${use.recordListField?use.recordListField+':':''}${use.field}`;
    gaps.set(group,{id:group,blocks:'matching',question:`确认 ${field?.label ?? use.label ?? use.field} 的指标口径、时间范围/粒度、过滤编码及查询标识；区分原文依据与建议。`,paths:[...(gaps.get(group)?.paths ?? []),use.path]});
    return {use,fieldContract:field ?? null,matching:'unresolved',execution:'not-run',evidence:[],candidates:candidates.blocks.map(b=>({id:b.id,heading:b.heading,from:b.from,to:b.to})),omittedMatches:candidates.omittedMatches,conditions:scan.sources[use.source ?? '']?.source ?? null,missing:[group]};
  });
  return {formatVersion:1,pageSha256:identity.pageSha256,mdSha256:identity.mdSha256,schemaSha256:identity.schemaSha256,entries,gaps:[...gaps.values()],diagnostics:scan.diagnostics,
    context:{filters:scan.filters,params:scan.params},coverage:{dataUses:entries.length,indexedBlocks:blocks.length},
    note:'名称检索仅给候选；语义提取与匹配由模型核对原文。无真实查询执行证据，不修改页面。'};
}

function checkEvidence(evidence:Json,lines:string[],errors:string[],location:string):void {
  if(!Number.isInteger(evidence.from)||!Number.isInteger(evidence.to)||evidence.from<1||evidence.to<evidence.from||evidence.to>lines.length) {errors.push(`${location}: invalid evidence range`);return;}
  if(typeof evidence.quote!=='string'||!evidence.quote.trim()||!lines.slice(evidence.from-1,evidence.to).join('\n').includes(evidence.quote)) errors.push(`${location}: quote is not present in source`);
}
export function checkAnalysis(report:Json,draft:Json,md:string):string[] {
  const errors:string[]=[];
  if(report.formatVersion!==1||report.pageSha256!==draft.pageSha256||report.mdSha256!==draft.mdSha256||report.schemaSha256!==draft.schemaSha256) errors.push('Input identity mismatch; rerun analysis');
  if(!Array.isArray(report.entries)||!Array.isArray(report.gaps)) return [...errors,'entries/gaps must be arrays'];
  const originals=new Map<string,Json>(draft.entries.map((e:Json)=>[`${e.use.path}:${e.use.field}`,e]));
  const expected=new Set(originals.keys()),seen=new Set<string>();
  report.entries.forEach((entry:Json,i:number)=>{
    const key=`${entry.use?.path}:${entry.use?.field}`;seen.add(key);
    if(!expected.has(key)) errors.push(`entries/${i}: unknown data use`);
    for(const prop of ['source','slot','componentId','componentType','kind','recordListField']) if(entry.use?.[prop]!==originals.get(key)?.use[prop]) errors.push(`entries/${i}: changed use identity ${prop}`);
    if(!['unresolved','matched','ambiguous','not-found','conflict'].includes(entry.matching)) errors.push(`entries/${i}: invalid matching state`);
    if(entry.execution!=='not-run') errors.push(`entries/${i}: analysis cannot attest execution; use external request/response evidence separately`);
    checkEntryEvidence(entry,i,md,errors);
    checkEntryGaps(entry,i,report.gaps,errors);
  });
  if(seen.size!==report.entries.length) errors.push('Duplicate data uses');
  for(const key of expected) if(!seen.has(key)) errors.push(`Missing data use: ${key}`);
  return errors;
}

function checkEntryEvidence(entry:Json,i:number,md:string,errors:string[]):void {
  if(!Array.isArray(entry.evidence)) {errors.push(`entries/${i}: evidence must be an array`);return;}
  entry.evidence.forEach((e:Json,j:number)=>checkEvidence(e,md.split('\n'),errors,`entries/${i}/evidence/${j}`));
  if(entry.matching==='matched' && (!entry.evidence.length||typeof entry.reason!=='string'||!entry.reason.trim()||typeof entry.metricName!=='string'||!entry.metricName.trim())) errors.push(`entries/${i}: matched requires metricName, evidence and reasoning`);
}

function checkEntryGaps(entry:Json,i:number,gaps:Json[],errors:string[]):void {
  if(entry.matching!=='matched' && (!Array.isArray(entry.missing)||!entry.missing.length)) errors.push(`entries/${i}: unresolved use needs a gap`);
  for(const gap of entry.missing ?? []) if(!gaps.some((g:Json)=>g.id===gap && g.paths?.includes(entry.use.path))) errors.push(`entries/${i}: missing gap ${gap}`);
}
