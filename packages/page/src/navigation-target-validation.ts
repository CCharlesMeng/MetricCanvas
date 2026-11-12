import { staticFieldBinding } from './field';
import { resolveDataSourceFields } from './data-source';
import type { Component, Page } from './page';
import type { TypedError } from './errors';
import type { NavigationBinding, NavigationTarget } from './schema/navigation';

/** 静态地址边界；不请求目标，也不以本仓页面集合推断部署路径。 */
export function isNavigationHref(href: string): boolean {
  if (!href || href !== href.trim() || /[\u0000-\u001f\u007f\\]/.test(href)) return false;
  if (/^https?:(?!\/\/)/i.test(href)) return false;
  try {
    const url = new URL(href, 'https://metriccanvas.invalid/');
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
}

const error = (path:string,message:string):TypedError => ({type:'SCHEMA_ERROR',path,message});

/** Shared URL and binding checks; headers and text links have no row context. */
export function navigationTargetErrors(page:Page,target:NavigationTarget,path:string,component?:Component):TypedError[] {
  const errors:TypedError[]=[];
  if(!isNavigationHref(target.href))errors.push(error(`${path}/href`,'导航只允许 HTTP(S) 或相对 URL'));
  for(const [key,binding] of Object.entries(target.query??{})) {
    const at=`${path}/query/${key.replaceAll('~','~0').replaceAll('/','~1')}`;
    errors.push(...bindingErrors(page,binding,at,component));
  }
  return errors;
}

function bindingErrors(page:Page,binding:NavigationBinding,path:string,component?:Component):TypedError[] {
  if(binding.source==='param')return page.params?.some(param=>param.id===binding.id)?[]:[error(`${path}/id`,`未声明的页面参数:${binding.id}`)];
  if(binding.source==='filter')return filterBindingErrors(page,binding,path);
  return validRowBinding(page,component,binding.field)?[]:[error(`${path}/field`,`当前行缺少可传参的标量字段:${binding.field}`)];
}

function filterBindingErrors(page:Page,binding:Extract<NavigationBinding,{source:'filter'}>,path:string):TypedError[] {
  const filter=page.filters?.find(filter=>filter.id===binding.id);
  if(!filter)return [error(`${path}/id`,`未声明的筛选器:${binding.id}`)];
  const part=binding.part??'value';
  if(filter.type==='timeRange'||filter.type==='numberRange') {
    const parts=['from','to'];
    if(filter.type==='timeRange'&&filter.display==='period')parts.push('value');
    if(filter.type==='timeRange'&&filter.display==='modes')parts.push('mode');
    if(parts.includes(part))return [];
  } else if(part==='value'||part==='level'&&filter.type==='dimension'&&filter.hierarchy)return [];
  return [error(`${path}/part`,`筛选器 ${binding.id} 不支持分量 ${part}`)];
}

function validRowBinding(page:Page,component:Component|undefined,fieldName:string):boolean {
  if(!component)return false;
  const linked=component.type==='metricCard'?[...component.props.rows,...(component.props.secondaryRows??[])].filter(row=>row.link):[];
  const slots=linked.length?linked.map(row=>{const binding=staticFieldBinding(row.valueField);return typeof binding==='string'?'main':binding.data;}):['main'];
  const dataSlots:Readonly<Record<string,string|undefined>>=component.data??{};
  return slots.every(slot=>{
    const sourceId=dataSlots[slot];
    const source=sourceId?page.dataSources[sourceId]:undefined;
    const field=source&&resolveDataSourceFields(source)[fieldName];
    return !!field&&['string','number','money','boolean','date','datetime'].includes(field.type);
  });
}
