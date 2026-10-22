import { presentationTarget,type PresentationTarget } from './presentation-edit';
import { parsePage } from './validate';
import { versionPolicy } from './version';
import type { Condition } from './schema/condition';
import type { TypedError } from './errors';
export type PresentationOperation=
 | {type:'set_presentation_condition';target:PresentationTarget;field:'visibleWhen'|'enabledWhen';condition:Condition|null}
 | {type:'add_button';sectionId:string;componentId:string;label:unknown;action:unknown;span?:number}
 | {type:'set_text_parts';componentId:string;parts:unknown[]};
/** Controlled edits shared by the workbench and bundled Node Bridge. No arbitrary paths. */
export function applyPresentationOperation(document:unknown,operation:PresentationOperation):{ok:boolean;document?:Record<string,unknown>;errors:TypedError[]}{
 const next=JSON.parse(JSON.stringify(document)) as Record<string,any>;
 const invalid=(message:string)=>({ok:false,errors:[{type:'SCHEMA_ERROR' as const,path:'/operation',message}]});
 if(operation.type==='set_presentation_condition'){
  const node=presentationTarget(next,operation.target);
  if(!node)return invalid('条件目标不存在或定位不唯一');
  if(!['visibleWhen','enabledWhen'].includes(operation.field))return invalid('条件字段非法');
  if(operation.target.kind==='row'&&operation.field!=='visibleWhen')return invalid('行条件不支持禁用');
  const field=operation.target.kind==='row'?'rowVisibleWhen':operation.field;
  if(operation.condition===null)delete node[field];else node[field]=operation.condition;
 }else if(operation.type==='add_button'){
  const section=next.sections?.find((section:Record<string,unknown>)=>section.id===operation.sectionId);
  if(!section)return invalid('内容分区不存在');
  section.components.push({id:operation.componentId,type:'button',layout:{span:operation.span??3},props:{label:operation.label,action:operation.action}});
 }else if(operation.type==='set_text_parts'){
  const node=presentationTarget(next,{kind:'component',id:operation.componentId});
  if(node?.type!=='text')return invalid('条件片段要求文本组件');
  delete node.props.body;delete node.props.bodyFormat;node.props.parts=operation.parts;
 }else return invalid('不支持的条件编辑操作');
 next.schemaVersion=versionPolicy.current;
 const parsed=parsePage(next);
 return parsed.ok?{ok:true,document:next,errors:[]}:{ok:false,errors:parsed.errors};
}
