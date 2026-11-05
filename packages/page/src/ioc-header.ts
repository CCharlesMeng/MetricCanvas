import {iocHeaderFilterIds} from './ioc-header-controls';
import { iocHeaderDeclaration, resolveHeaderBinding, headerDeclarations } from './header-binding';
import type { Page } from './page';
import type { DimensionFilterDeclaration } from './filter';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';

/** Root placement is validated once for every serialized consumer. */
export function iocHeaderErrors(page: Page): TypedError[] {
  const header = iocHeaderDeclaration(page);
  if (!header) return componentPlacementErrors(page);
  const base=resolveHeaderBinding(page)!.path;
  const errors: TypedError[] = componentPlacementErrors(page);
  const issue = (path: string, message: string) => errors.push({type:'SCHEMA_ERROR', path, message});
  const identity = header.identity;
  if (base==='/iocHeader' && page.layout === 'dashboard' && page.dashboardToolbar !== undefined && page.dashboardToolbar !== 'hidden') issue('/dashboardToolbar', 'IOC 看板必须显式关闭通用工具栏');
  for (const key of ['tags', 'facts'] as const) {
    const ids = new Set<string>();
    identity?.[key]?.forEach((item, index) => {
      if (ids.has(item.id)) issue(`${base}/identity/${key}/${index}/id`, '身份项 id 重复');
      ids.add(item.id);
    });
  }
  errors.push(...iocRegionErrors(page,base));
  const placed = new Set(header.filterIds ?? []);
  header.filterIds?.forEach((id, index) => {
    const filter = page.filters?.find(f => f.id === id);
    if (!filter || filter.visible === false) issue(header.components?`${base}/components/${index}`:`${base}/filterIds/${index}`, 'IOC 页头只能认领静态可见的页级筛选');
  });
  walkPageComponents(page, (component, path) => {
    if (component.type === 'filterGroup' && placed.has(component.props.filterId)) issue(`${base}/filterIds`, '筛选按钮组不能被 IOC 页头重复认领');
    if (component.type !== 'reportHeader') return;
    if (component.props.variant === 'projectDetail' || path === '/sections/0/components/0') issue(path, 'IOC 页头不能与首个业务 reportHeader 重复承担页面身份');
    if (component.props.filterIds?.some(id => placed.has(id))) issue(`${path}/props/filterIds`, '筛选不能被多个页头认领');
  });
  return errors;
}

/** IOC business Region is a reserved public input; ordinary dimension filters are unchanged. */
function iocRegionErrors(page:Page,base:string):TypedError[] {
  const index=page.filters?.findIndex(filter=>filter.id==='region')??-1;
  if(index<0)return [];
  const filter=page.filters![index]!,path=`/filters/${index}`,errors:TypedError[]=[];
  const fail=(suffix:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path:path+suffix,message});
  if(!iocHeaderDeclaration(page)?.filterIds?.includes('region'))fail('/id',base==='/iocHeader'?'IOC Region 必须由 iocHeader.filterIds 认领':`IOC Region 必须由 ${base}/filterIds 认领`);
  if(filter.type!=='dimension'){fail('/type','IOC Region 必须是层级维度筛选器');return errors;}
  if(!filter.hierarchy?.length)fail('/hierarchy','IOC Region 必须声明地区部与代表处等真实层级');
  if(filter.display!=='tree')fail('/display','IOC Region 只允许 display:tree 的单个树形下拉框');
  if(filter.selection?.mode!=='single')fail('/selection/mode','IOC Region 只允许单选树节点');
  if(filter.treeSelection!=='level')fail('/treeSelection','IOC Region 必须使用 treeSelection:level 在树内选择层级和值');
  if(filter.hierarchyPicker!==undefined)fail('/hierarchyPicker','IOC Region 不再允许外部层级切换或隐藏切层写法');
  if(filter.searchable===false)fail('/searchable','IOC Region 必须支持树内搜索');
  if(duplicatedRegionLevel(page,filter))fail('/hierarchy','IOC Region 的组织层级不能再拆成独立筛选');
  return errors;
}

function duplicatedRegionLevel(page:Page,region:DimensionFilterDeclaration):boolean {
  const dimensions=new Set(region.hierarchy?.map(level=>level.dimension));
  return page.filters?.some(other=>other.id!=='region'&&other.visible!==false&&other.type==='dimension'&&dimensions.has(other.dimension))??false;
}

/** Count the declaration tree, not the currently visible projection. */
function componentPlacementErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  let count=0;
  const fail=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
  walkPageComponents(page,(component,path)=>{
    if(component.type!=='iocHeader')return;
    count++;
    if(path!=='/sections/0/components/0')fail(path,'IOC 页头只允许位于首分区的第一个组件');
    if(component.layout.span!==12 || component.layout.layer!==undefined)fail(path+'/layout','IOC 页头必须占满分区，span 为12且不能作为背景');
    if(page.iocHeader || page.dashboardToolbar!==undefined)fail(path,'组件页头不能与旧根级 iocHeader 或 dashboardToolbar 混写');
    if(count>1)fail(path,'每页最多声明一个 IOC 页头');
  });
  return errors;
}

/** Runs before text resolution, preserving declaration intent and raw error paths. */
export function emptyIocHeaderErrors(document:unknown):TypedError[] {
  return headerDeclarations(document).flatMap(({props,path})=>{
    const header=props as import('./schema/ioc-header').IocHeaderDeclaration;
    const identity=header.identity;
    const populated=identity?.title || identity?.code || identity?.description || identity?.tags?.length || identity?.facts?.length || iocHeaderFilterIds(header).length || header.back;
    return populated?[]:[{type:'SCHEMA_ERROR' as const,path,message:'IOC 页头需要身份、筛选或返回意图'}];
  });
}
