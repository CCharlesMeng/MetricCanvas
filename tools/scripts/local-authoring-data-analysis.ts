import { createHash } from 'node:crypto';
import { scanPageData } from '../../metriccanvas-authoring/core/page/data-scan';
export { scanPageData, projectDataSources } from '../../metriccanvas-authoring/core/page/data-scan';
export type { DataUse } from '../../metriccanvas-authoring/core/page/data-scan';

type Json=Record<string,any>;
export const hashBytes=(content:string)=>createHash('sha256').update(content).digest('hex');
export const pointerToken=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
import {draftDataAnalysis} from '../../metriccanvas-authoring/core/page/data-analysis';
import type {DocumentBlock} from '../../metriccanvas-authoring/core/page/data-analysis';
export {findBlocks,checkAnalysis} from '../../metriccanvas-authoring/core/page/data-analysis';
export type {DocumentBlock} from '../../metriccanvas-authoring/core/page/data-analysis';

/** Index boundaries only: free-form Markdown semantics remain the author's job. */
export function markdownBlocks(content:string):DocumentBlock[] {
  const lines=content.split('\n');
  const starts=[0]; let fenced=false;
  lines.forEach((line,i)=>{
    if(/^\s*(```|~~~)/.test(line)) fenced=!fenced;
    if(!fenced && i>0 && (/^#{1,6}\s/.test(line) || i-starts.at(-1)!>=40 || (!line.trim() && i-starts.at(-1)!>=16))) starts.push(i);
  });
  let heading='document';
  return starts.map((from,i)=>{
    const to=starts[i+1] ?? lines.length;
    if(/^#{1,6}\s/.test(lines[from])) heading=lines[from].replace(/^#+\s*/,'');
    const text=lines.slice(from,to).join('\n');
    return {id:hashBytes(`${from+1}:${to}:${text}`).slice(0,16),heading,from:from+1,to,text};
  }).filter(b=>b.text.trim());
}

export function draftAnalysis(page:Json,schema:Json,pageHash:string,md:string):Json {
  return draftDataAnalysis(scanPageData(page,schema),markdownBlocks(md),{
    pageSha256:pageHash,mdSha256:hashBytes(md),schemaSha256:hashBytes(JSON.stringify(schema))});
}
