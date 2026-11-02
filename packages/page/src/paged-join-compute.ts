import {computeOutputFields} from './compute';
import {hasPeriodComparison} from './period-comparison';
import {isPagedJoinQuery} from './paged-join-view';
import {walkPageComponents} from './component-walk';
import {fieldName} from './field';
import type {Page, Component} from './page';
import type {PagedJoinDataSource} from './paged-join';

type ErrorReporter=(path:string,message:string)=>void;

/** The raw join receipt contains projected inputs; row calculations run afterwards. */
export function pagedJoinProjectionFields(data:PagedJoinDataSource):PagedJoinDataSource['fields'] {
  const outputs=new Set(computeOutputFields(data.compute??[]));
  return Object.fromEntries(Object.entries(data.fields).filter(([id])=>!outputs.has(id)));
}

export function pagedJoinHasComparison(page:Page,data:PagedJoinDataSource):boolean {
  return Object.values(data.source.members).some(member=>{
    const source=page.dataSources[member.source];
    return source?.source.type==='query'&&hasPeriodComparison(source.source.query);
  });
}

export function pagedJoinComputeErrors(page:Page,id:string,data:PagedJoinDataSource,path:string,error:ErrorReporter):void {
  const operators=data.compute??[];
  if(!operators.length)return;
  if(!isPagedJoinQuery(data.source)||data.source.records)error(`${path}/compute`,'组合逐行计算只支持无 records 的查询分页分支');
  const available=new Set(Object.keys(data.source.projection));
  operators.forEach((op,index)=>{
    const location=`${path}/compute/${index}`;
    const inputs=op.op==='delta'?[op.minuend,op.subtrahend]:[op.numerator,op.denominator];
    for(const field of inputs)if(!available.has(field))error(location,'计算输入必须来自已投影字段或前序计算产出');
    if(available.has(op.output)||op.output===data.source.ordinalField)error(`${location}/output`,'计算产出不能覆盖投影、行键、序号或前序产出');
    const field=data.fields[op.output];
    if(field&&(!['number','money'].includes(field.type)||field.nullable===false))error(`${location}/output`,'组合计算产出必须为允许空值的数值度量');
    available.add(op.output);
  });
  const outputs=new Set(computeOutputFields(operators));
  walkPageComponents(page,(component,location)=>{
    if(component.type==='table'&&component.data.main===id)computedColumnErrors(component.props.columns,outputs,location,error);
  });
}

function computedColumnErrors(columns:Extract<Component,{type:'table'}>['props']['columns'],outputs:ReadonlySet<string>,path:string,error:ErrorReporter):void {
  columns.forEach((column,index)=>{
    const location=`${path}/props/columns/${index}`;
    if(column.kind==='group'){computedColumnErrors(column.children,outputs,location,error);return;}
    if(outputs.has(fieldName(column.field))&&(column.sortable||column.filterable))error(location,'页内计算列不能声明全局排序或表头筛选');
  });
}

export function projectionMissingErrors(data:PagedJoinDataSource,path:string,error:ErrorReporter):void {
  for(const [id,projection] of Object.entries(data.source.projection)) {
    if(projection.onMissing===undefined)continue;
    const location=`${path}/source/projection/${id}/onMissing`,field=data.fields[id];
    if(!isPagedJoinQuery(data.source)||data.source.records)error(location,'投影缺记录策略只支持无 records 的查询分页分支');
    if(projection.onMissing==='zero'&&(!field||field.role!=='measure'||!['number','money'].includes(field.type)))error(location,'仅数值度量可对缺记录补零');
  }
}
