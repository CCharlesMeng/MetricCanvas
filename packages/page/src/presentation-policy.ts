import {sourceFilterIds} from './data-source-references';
import {expandedColumnFilterIds} from './table/condition-scope';
import {visitTableColumns} from './table/columns';
import {queryFilterIds} from './amount-filter';
import { conditionDepth, conditionLeaves, conditionTestTypeError, type ConditionValue } from './condition';
import type { Condition } from './schema/condition';
import type { Page, Component } from './page';
import { resolveDataSourceFields } from './data-source';
import type { FieldDefinition } from './field';
import type { TypedError } from './errors';

export interface PolicyNode { visibleWhen?: Condition; enabledWhen?: Condition }
export interface PolicySite {
  node: PolicyNode; path: string; fields?: Record<string, FieldDefinition>;
}
/** Closed traversal: never interpret query bodies, raw rows or opaque presentation extensions. */
export function presentationPolicies(page: Page): PolicySite[] {
  const sites: PolicySite[] = [];
  const add = (node: PolicyNode | undefined, path: string, fields?: Record<string, FieldDefinition>) => { if (node) sites.push({node,path,fields}); };
  function component(node: Component, path: string) {
    add(node,path);
    const source = node.data?.main ? page.dataSources[node.data.main] : undefined;
    const fields = source ? resolveDataSourceFields(source) : undefined;
    const props = node.props as unknown as Record<string, any>;
    for (const key of ['actions','links']) (props[key] ?? []).forEach((item: any,i:number) => entry(item,`${path}/props/${key}/${i}`,fields));
    if (props.action) entry(props.action,`${path}/props/action`);
    (props.parts ?? []).forEach((item:any,i:number)=> { if(typeof item==='object') add(item,`${path}/props/parts/${i}`); });
    if(node.type==='tabContainer') node.props.tabs.forEach((tab,i)=>{
      const p=`${path}/props/tabs/${i}`; add(tab,p);
      ('components' in tab ? tab.components : [tab.component]).forEach((child,j)=>component(child,`${p}/${'components' in tab ? `components/${j}` : 'component'}`));
    });
    if(node.type==='compositeCard') node.props.components.forEach((child,i)=>component(child,`${path}/props/components/${i}`));
    if(node.type==='table') {
      if(node.props.rowVisibleWhen) add({visibleWhen:node.props.rowVisibleWhen},`${path}/props/row`,fields);
      visitTableColumns(node.props.columns,`${path}/props/columns`,(col,p)=>{
        add(col,p);
        if(col.kind!=='group'){
          for(const key of ['navigate','openDetail','selection'] as const)add(col[key],`${p}/${key}`,fields);
          for(const [id,target] of Object.entries(col.navigateBySource?.cases??{}))add(target,`${p}/navigateBySource/cases/${id}`,fields);
        }
      });
      for(const key of ['search','export']) add(props.toolbar?.[key],`${path}/props/toolbar/${key}`);
    }
  }
  function entry(node:any,path:string,fields?:Record<string,FieldDefinition>) {
    add(node,path,fields);
    if(node.navigate)add(node.navigate,`${path}/navigate`,fields);
    if(node.openDetail)add(node.openDetail,`${path}/openDetail`,fields);
  }
  page.filters?.forEach((node,i)=>add(node,`/filters/${i}`));
  page.sectionGroups?.forEach((node,i)=>add(node,`/sectionGroups/${i}`));
  page.sections.forEach((section,i)=>{ add(section,`/sections/${i}`); section.components.forEach((node,j)=>component(node,`/sections/${i}/components/${j}`)); });
  page.detailViews?.forEach((view,i)=>view.components.forEach((node,j)=>component(node,`/detailViews/${i}/components/${j}`)));
  return sites;
}
function sampleForField(field: FieldDefinition): ConditionValue | undefined {
  if(field.type==='string' || field.type==='date')return '';
  if(field.type==='number' || field.type==='money')return 0;
  if(field.type==='boolean')return false;
  return undefined;
}
function filterSample(page:Page,leaf:Extract<Condition,{filter:string}>):ConditionValue|undefined {
  const f=page.filters?.find(f=>f.id===leaf.filter);if(!f)return undefined;
  if(leaf.part==='level')return f.type==='dimension' && f.hierarchy ? '' : undefined;
  if(leaf.part==='values')return f.type==='dimension' ? [''] : undefined;
  if(leaf.part==='from'||leaf.part==='to')return f.type==='timeRange' ? '' : f.type==='numberRange' ? 0 : undefined;
  if(f.type==='boolean')return false;
  return f.type==='timePoint'||f.type==='search' ? '' : undefined;
}
export function presentationPolicyErrors(page: Page): TypedError[] {
  const errors:TypedError[]=[];
  const policies=presentationPolicies(page);
  const consumedFilters=new Set([...expandedColumnFilterIds(page),...policies.flatMap(site=>[site.node.visibleWhen,site.node.enabledWhen].flatMap(condition=>condition?conditionLeaves(condition).flatMap(leaf=>'filter' in leaf?[leaf.filter]:[]):[]))]);
  for(const site of policies){
    const action=site.node as PolicyNode & {writeFilter?:string;field?:unknown;value?:string;level?:string};
    if(action.writeFilter){
      const target=page.filters?.find(f=>f.id===action.writeFilter);
      if(target?.type!=='dimension')errors.push({type:'SCHEMA_ERROR',path:`${site.path}/writeFilter`,message:'动作必须写入已声明维度筛选器'});
      else if(action.level && !target.hierarchy?.some(level=>level.id===action.level))errors.push({type:'SCHEMA_ERROR',path:`${site.path}/level`,message:'动作引用了未声明的层级'});
      if(!consumedFilters.has(action.writeFilter)&&!Object.values(page.dataSources).some(source=>sourceFilterIds(source).includes(action.writeFilter!)))errors.push({type:'SCHEMA_ERROR',path:site.path,message:'筛选写入必须有查询绑定或显隐消费方'});
      if(action.field&&!site.fields)errors.push({type:'SCHEMA_ERROR',path:`${site.path}/field`,message:'当前动作没有行上下文'});
    }
  }

  function fail(path:string,message:string){errors.push({type:'SCHEMA_ERROR',path,message});}
  for(const site of presentationPolicies(page))for(const key of ['visibleWhen','enabledWhen'] as const){
    const condition=site.node[key];if(!condition)continue;
    const path=`${site.path}/${key}`;
    if(conditionDepth(condition)>4||conditionLeaves(condition).length>64)fail(path,'条件超过4层或64个叶子');
    for(const leaf of conditionLeaves(condition)){
      if('permission' in leaf||'fact' in leaf)continue;
      const sample='filter' in leaf?filterSample(page,leaf):site.fields?.[leaf.row] ? sampleForField(site.fields[leaf.row]!) : undefined;
      if(sample===undefined){fail(path,'条件引用了不存在的来源、非法筛选部分或缺少行上下文');continue;}
      if(conditionTestTypeError(leaf,sample))fail(path,'条件操作或字面量与来源类型不匹配');
      if('filter' in leaf && leaf.part==='level' && ('value' in leaf || 'values' in leaf)){
        const f=page.filters?.find(f=>f.id===leaf.filter);
        const values='values' in leaf?leaf.values:[leaf.value];
        if(f?.type==='dimension'&&values.some(value=>!f.hierarchy?.some(level=>level.id===value)))fail(path,'条件引用了未声明的层级');
      }
    }
  }
  function checkComponent(c:Component,path:string){
    if(c.type==='text' && c.props.parts && new Set(c.props.parts.map(part=>part.id)).size!==c.props.parts.length)fail(`${path}/props/parts`,'条件正文片段id必须唯一');
    if(c.type==='text' && c.props.parts && (c.props.body!==undefined||c.props.bodyFormat!==undefined))fail(`${path}/props/parts`,'条件正文片段与body/bodyFormat互斥');
    if(c.type==='table'){
      const source=page.dataSources[c.data.main];
      if(c.props.rowVisibleWhen && source && (source.source.type!=='inline' && (source.source.type==='pagedJoin'||c.props.pagination?.mode==='query'||source.source.type==='query' && source.source.resultScope!=='complete')))fail(`${path}/props/rowVisibleWhen`,'行展示条件只支持完整本地结果；远程窗口请使用查询绑定');
      const interaction=!!c.props.actions?.length||JSON.stringify(c.props.columns).includes('selection')||JSON.stringify(c.props.columns).includes('openDetail')||JSON.stringify(c.props.columns).includes('navigate');
      const conditionalRows=!!c.props.rowVisibleWhen||policies.some(site=>site.path.startsWith(`${path}/props/`)&&[site.node.visibleWhen,site.node.enabledWhen].some(condition=>condition&&conditionLeaves(condition).some(leaf=>'row' in leaf)));
      if(conditionalRows&&interaction&&!c.props.rowKey)fail(`${path}/props/rowKey`,'条件行的选择、动作与详情需要稳定rowKey');
      if(conditionalRows&&interaction&&c.props.rowKey&&source){
        const key=resolveDataSourceFields(source)[c.props.rowKey];
        if(!key||key.role!=='dimension'||!['string','number'].includes(key.type))fail(`${path}/props/rowKey`,'条件行键必须引用已声明的string/number维度');
      }
    }
    if(c.type==='button' && 'openDetail' in c.props.action){
      if('fields' in c.props.action.openDetail)fail(`${path}/props/action`,'独立按钮没有行上下文，不能打开行字段详情');
      else if(!page.detailViews?.some(view=>view.id===('openDetail' in c.props.action&&'view' in c.props.action.openDetail?c.props.action.openDetail.view:undefined)))fail(`${path}/props/action/openDetail/view`,'详情视图不存在');
    }
  }
  // Reuse the canonical component traversal, including snapshot/query details.
  walkPageComponents(page,checkComponent);
  return errors;
}
import { walkPageComponents } from './component-walk';

export function filterHasPresentationConsumer(page:Page,id:string):boolean {
 return expandedColumnFilterIds(page).has(id)||presentationPolicies(page).some(site=>[site.node.visibleWhen,site.node.enabledWhen].some(condition=>condition&&conditionLeaves(condition).some(leaf=>'filter' in leaf&&leaf.filter===id)));
}
export function filterHasObservableConsumer(page:Page,id:string):boolean {
 return filterHasPresentationConsumer(page,id)||Object.values(page.dataSources).some(source=>sourceFilterIds(source).includes(id));
}
