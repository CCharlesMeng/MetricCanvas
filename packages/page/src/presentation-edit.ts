import { walkDocumentComponents } from './component-walk';
export type PresentationTarget =
 | {kind:'section';id:string} | {kind:'filter';id:string} | {kind:'sectionGroup';id:string}
 | {kind:'component';id:string} | {kind:'row';id:string}
 | {kind:'tab';id:string;tabId:string} | {kind:'part';id:string;partId:string}
 | {kind:'action';id:string;action:'navigate'|'openDetail'|'writeFilter';filterId?:string}
 | {kind:'link';id:string;href:string}
 | {kind:'toolbar';id:string;slot:'search'|'export'}
 | {kind:'column';id:string;field:string;slot:'navigate'|'openDetail'|'selection'};
type Node=Record<string,any>;
export function presentationTarget(document:unknown,target:PresentationTarget):Node|undefined {
 const page=document as Node;
 if(target.kind==='section'||target.kind==='filter'||target.kind==='sectionGroup'){
  const key={section:'sections',filter:'filters',sectionGroup:'sectionGroups'}[target.kind];return page[key]?.find((node:Node)=>node.id===target.id);
 }
 let component:Node|undefined;
 walkDocumentComponents(document,node=>{if(node.id===target.id)component=node;});
 if(!component)return;
 const props=component.props as Node;
 switch(target.kind){
  case 'component':return component;
  case 'row':return component.type==='table'?props:undefined;
  case 'tab':return component.type==='tabContainer'?props.tabs.find((tab:Node)=>tab.id===target.tabId):undefined;
  case 'part':return component.type==='text'?props.parts?.find((part:Node)=>part.id===target.partId):undefined;
  case 'link':{const matches=(props.links??[]).filter((link:Node)=>link.href===target.href);return matches.length===1?matches[0]:undefined;}
  case 'toolbar':return component.type==='table'?props.toolbar?.[target.slot]:undefined;
  case 'action':{
   const actions=component.type==='button'?[props.action]:props.actions??[];
   const matches=actions.filter((action:Node)=>target.action in action&&(target.action!=='writeFilter'||!target.filterId||action.writeFilter===target.filterId));
   return matches.length===1?matches[0]:undefined;
  }
  case 'column':{
   function columns(nodes:Node[]):Node[]{return nodes.flatMap(node=>node.kind==='group'?columns(node.children):[node]);}
   const matches=columns(props.columns??[]).filter(node=>(typeof node.field==='string'?node.field:node.field?.field)===target.field);
   return matches.length===1?matches[0]?.[target.slot]:undefined;
  }
 }
}
export function presentationTargets(document:unknown):Array<{target:PresentationTarget;label:string;enabled:boolean}>{
 const page=document as Node;const items:Array<{target:PresentationTarget;label:string;enabled:boolean}>=[];
 const add=(target:PresentationTarget,label:string,enabled=false)=>items.push({target,label,enabled});
 for(const [key,kind] of [['sections','section'],['filters','filter'],['sectionGroups','sectionGroup']] as const)for(const node of page[key]??[])add({kind,id:node.id},`${kind} · ${node.id}`);
 walkDocumentComponents(document,node=>{
  const id=node.id as string,props=node.props as Node;
  add({kind:'component',id},`${node.type} · ${id}`,node.type==='button');
  if(node.type==='table'){
   add({kind:'row',id},`表格行 · ${id}`);
   for(const slot of ['search','export'] as const)if(props.toolbar?.[slot])add({kind:'toolbar',id,slot},`${id} · ${slot}`,true);
   const columns=(nodes:Node[]):void=>nodes.forEach(col=>{
    if(col.kind==='group'){columns(col.children);return;}
    for(const slot of ['navigate','openDetail','selection'] as const)if(col[slot])add({kind:'column',id,field:typeof col.field==='string'?col.field:col.field.field,slot},`${id} · ${typeof col.field==='string'?col.field:col.field.field} · ${slot}`,true);
   });columns(props.columns??[]);
  }
  if(node.type==='text')for(const link of props.links??[])add({kind:'link',id,href:link.href},`${id} · 链接 ${link.href}`,true);
  for(const tab of props.tabs??[])add({kind:'tab',id,tabId:tab.id},`${id} · Tab ${tab.id}`);
  if(node.type==='text')for(const part of props.parts??[])add({kind:'part',id,partId:part.id},`${id} · 片段 ${part.id}`);
  for(const action of node.type==='button'?[props.action]:props.actions??[])for(const kind of ['navigate','openDetail','writeFilter'] as const)if(kind in action)add({kind:'action',id,action:kind,...(kind==='writeFilter'?{filterId:action.writeFilter}:{})},`${id} · ${kind}`,true);
 });
 return items;
}
