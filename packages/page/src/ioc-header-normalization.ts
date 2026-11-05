import type {TypedError} from './errors';
import {documentIocHeader,headerDeclarations,mapIocHeader} from './header-binding';
import type {Page} from './page';
import {walkDocumentComponents} from './component-walk';
import {standardIocRegionFilter,iocHeaderFilterIds} from './ioc-header-controls';

type RecordValue=Record<string,unknown>;
function record(value:unknown):RecordValue|undefined {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:undefined;
}
function regionControls(header:RecordValue):boolean {
  return Array.isArray(header.components)&&header.components.some(control=>record(control)?.type==='regionFilter');
}

/** Expand only the runtime projection; retain the compact source and its version. */
export function expandIocHeaderRegion(document:unknown):unknown {
  const page=record(document),header=documentIocHeader(document);
  if(!page||!header||!regionControls(header))return document;
  if(page.filters!==undefined&&!Array.isArray(page.filters))return document;
  const filters=(page.filters??[]) as unknown[];
  if(filters.some(filter=>record(filter)?.id==='region'))return document;
  return {...page,filters:[...filters,standardIocRegionFilter()]};
}

/** Existing execution consumers receive the same canonical filter projection as before. */
export function canonicalIocHeaderControls(page:Page):Page {
  return mapIocHeader(page,header=>{
    if(!header.components)return header;
    const {components,...rest}=header;
    return {...rest,filterIds:iocHeaderFilterIds(header)};
  });
}

function controlIdentityErrors(controls:unknown[],base:string,ids:Set<unknown>):TypedError[] {
  const errors:TypedError[]=[],filters=new Set<unknown>();
  controls.forEach((value,index)=>{
    const control=record(value);if(!control)return;
    const path=`${base}/components/${index}`;
    if(ids.has(control.id))errors.push({type:'SCHEMA_ERROR',path:path+'/id',message:'页头子组件 id 不能与其他组件重复'});
    ids.add(control.id);
    const filterId=control.type==='regionFilter'?'region':record(control.props)?.filterId;
    if(filterId===undefined)return;
    if(filters.has(filterId))errors.push({type:'SCHEMA_ERROR',path,message:'页头筛选不能重复认领'});
    filters.add(filterId);
  });
  return errors;
}

/** Source-only checks run before expansion, so authored duplicates remain observable. */
export function iocHeaderControlErrors(document:unknown):TypedError[] {
  const errors:TypedError[]=[],ids=new Set<unknown>();
  walkDocumentComponents(document,component=>ids.add(component.id));
  const filters=record(document)?.filters;
  for(const {props,path} of headerDeclarations(document)){
    if(props.components===undefined)continue;
    if(path==='/iocHeader')errors.push({type:'SCHEMA_ERROR',path:path+'/components',message:'页头子组件必须声明在首 section 的 iocHeader 组件中'});
    if(props.filterIds!==undefined)errors.push({type:'SCHEMA_ERROR',path:path+'/components',message:'components 与 filterIds 不能同时声明'});
    if(!Array.isArray(props.components))continue;
    errors.push(...controlIdentityErrors(props.components,path,ids));
    if(regionControls(props)&&Array.isArray(filters)&&filters.some(filter=>record(filter)?.id==='region'))errors.push({type:'SCHEMA_ERROR',path:'/filters',message:'RegionFilter 已拥有 region 筛选，不能再声明 filters.region'});
  }
  return errors;
}
