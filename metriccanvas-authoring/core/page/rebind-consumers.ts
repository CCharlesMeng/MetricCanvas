import { walkDocumentComponents } from '../../../packages/page/src/component-walk';
import {tableAlignedSlots,tablePinnedSlots} from '../../../packages/page/src/table-pinned';
import type {TableComponent} from '../../../packages/page/src/page';
import { issue, type Json, type AnalysisIssue, type AnalysisReport } from './analysis-types';

export function consumerRowKeys(document:Json,sourceId:string):string[] {
  const keys=new Set<string>();
  walkDocumentComponents(document,value=>{
    const component=value as Json;
    if(component.type==='table' && tableAlignedSlots(component as TableComponent).some(([,id])=>id===sourceId) && typeof component.props?.rowKey==='string')keys.add(component.props.rowKey);
  });
  return [...keys];
}

export function pinnedConsumerIssues(document:Json,sourceId:string,record:Json):AnalysisIssue[] {
  const locations:string[]=[];
  walkDocumentComponents(document,(value,path)=>{
    const component=value as Json;
    if(component.type==='table' && tablePinnedSlots(component.props).some(slot=>component.data?.[slot]===sourceId))locations.push(path+'/props/pinnedTop');
  });
  if(!locations.length)return [];
  const complete=Array.isArray(record.rows) && record.rows.length<=1 && record.totalCount===record.rows.length;
  return complete?[]:locations.map(path=>issue('REBIND_PINNED_EVIDENCE_INVALID',path,'An independent pinned source requires explicit complete zero/one-row evidence; it does not inherit the main rowKey'));
}

export function nestedConsumerIssues(document:Json,sourceId:string):AnalysisIssue[] {
  const issues:AnalysisIssue[]=[];
  walkDocumentComponents(document,(value,path)=>{
    const component=value as Json;
    if(component.props?.rowExpansion?.data?.source===sourceId)issues.push(issue('REBIND_CONTEXT_UNSUPPORTED',path+'/props/rowExpansion/data','A row-expansion source needs per-parent context evidence; one ordinary record cannot attest every parent'));
  });
  return issues;
}

export function rowKeyIssues(document:Json,sourceId:string,record:Json,fieldMap:Record<string,string>):AnalysisIssue[] {
  const fields=consumerRowKeys(document,sourceId);
  if(!fields.length)return [];
  if(!Array.isArray(record.rows) || record.totalCount!==record.rows.length)return [issue('REBIND_ROW_KEY_UNPROVEN','/resultRef','Row identity needs complete supplied result evidence; unknown/partial counts do not prove uniqueness')];
  const issues:AnalysisIssue[]=[];
  for(const field of fields)issues.push(...oneRowKeyIssues(field,record,fieldMap));
  return issues;
}

function oneRowKeyIssues(field:string,record:Json,fieldMap:Record<string,string>):AnalysisIssue[] {
  const definition=record.source.fields[fieldMap[field]!];
  if(!definition)return [issue('REBIND_ROW_KEY_UNPROVEN','/fieldMap','The rowKey must map to an explicit result field')];
  const key=definition.queryField ?? fieldMap[field];
  const seen=new Set<string>();
  for(const [i,row] of record.rows.entries()) {
    const value=row?.[key],encoded=JSON.stringify(value);
    if(!validRowKey(value))return [issue('REBIND_ROW_KEY_INVALID',`/resultRecords/${record.resultRef}/rows/${i}`,'The preserved rowKey has a missing or invalid scalar result value')];
    if(seen.has(encoded))return [issue('REBIND_ROW_KEY_DUPLICATE',`/resultRecords/${record.resultRef}/rows/${i}`,'The replacement result duplicates a preserved rowKey')];
    seen.add(encoded);
  }
  return [];
}

function validRowKey(value:unknown):boolean {
  return typeof value==='string'?value.length>0:typeof value==='number' && Number.isFinite(value);
}

/** Every consumer is checked, including consumers outside a selected reading scope. */
export function mappedConsumerIssues(report:AnalysisReport,sourceId:string,resultRef:string,fieldMap:Record<string,string>):AnalysisIssue[] {
  const uses=report.uses.filter(use=>use.source===sourceId && use.field);
  return uses.filter(use=>!report.links.some(link=>link.useId===use.useId && link.resultRef===resultRef && link.outputField===fieldMap[use.field!]))
    .map(use=>issue('REBIND_CONSUMER_UNMAPPED',use.path,'A shared data use has no exact requirement/request/result/output-field association'));
}
