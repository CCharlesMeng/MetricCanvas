import { conditionSourceIds, sourceFilterIds } from './data-source-references';
import { candidateDependencies } from './filter-dependencies';
import { resolveDataSourceFields } from './data-source';
import type { Page } from './page';
import type { DimensionFilterDeclaration } from './filter';
import type { TypedError } from './errors';

/** Candidate source predicates must be explicit dependencies, never the target selection itself. */
export function sourceCandidateErrors(page:Page):TypedError[] {
  return (page.filters??[]).flatMap((filter,index)=>filter.type==='dimension'&&filter.candidates?candidateErrors(page,filter,`/filters/${index}/candidates`):[]);
}
function candidateErrors(page:Page,filter:DimensionFilterDeclaration,path:string):TypedError[] {
  const errors:TypedError[]=[];
  const error=(suffix:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path:path+suffix,message});
  const spec=filter.candidates!,source=page.dataSources[spec.dataSource];
  if(!source){error('/dataSource','候选必须引用已声明的页面数据源');return errors;}
  if(!['inline','query'].includes(source.source.type))error('/dataSource','候选来源支持 inline 或 query 页面数据源');
  checkShape(filter,error);
  checkFields();
  const dependencies=new Set(candidateDependencies(filter));
  const used=new Set([...conditionSourceIds(page,spec.dataSource)].flatMap(id=>sourceFilterIds(page.dataSources[id])));
  if(used.has(filter.id))error('/dataSource','候选来源不能直接或间接消费自身筛选');
  for(const id of used)if(!dependencies.has(id)&&id!==filter.id)error('/dataSource',`候选来源消费的筛选 ${id} 必须声明在 candidateContext.filterIds`);
  return errors;
  function checkFields():void {
    const fields=resolveDataSourceFields(source!);
    for(const key of ['valueField','labelField','parentField'] as const){
      const name=spec[key];if(!name)continue;
      const field=fields[name];
      if(!field||!['string','number','boolean'].includes(field.type))error('/'+key,'候选字段必须引用已声明的标量输出');
    }
  }
}

function checkShape(filter:DimensionFilterDeclaration,error:(suffix:string,message:string)=>unknown):void {
  const spec=filter.candidates!;
  if(filter.options||filter.hierarchy||filter.dependsOn||filter.candidateWindow)error('','数据源候选不能同时声明固定选项、层级、dependsOn 或候选窗口');
  if(filter.treeSelection&&filter.treeSelection!=='independent')error('','数据源树的节点按自身值独立选择，treeSelection 必须为 independent');
  if(filter.display==='tree'&&!spec.parentField)error('/parentField','树形候选必须显式引用父节点字段');
  if(spec.parentField&&filter.display!=='tree')error('/parentField','父节点字段仅用于 tree 展示');
}
