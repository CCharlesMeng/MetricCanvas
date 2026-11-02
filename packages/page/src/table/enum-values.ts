import type {Page,TableColumnNode} from '../page';
import type {TypedError} from '../errors';
import {walkPageComponents} from '../component-walk';
import {visitTableColumns} from './columns';

/** Equal raw values with conflicting labels are ambiguous; number and string stay distinct. */
export function tableEnumErrors(page:Page):TypedError[]{
  const errors:TypedError[]=[];
  function check(columns:readonly TableColumnNode[],path:string):void{
    visitTableColumns(columns,path,(column,own)=>{
      if(column.kind==='group'||!column.enumValues)return;
      const keys=column.enumValues.map(option=>JSON.stringify([typeof option.value,option.value]));
      if(new Set(keys).size!==keys.length)errors.push({type:'SCHEMA_ERROR',path:own+'/enumValues',message:'列枚举的原始值不得重复'});
    });
  }
  walkPageComponents(page,(component,path)=>{
    if(component.type!=='table')return;
    check(component.props.columns,path+'/props/columns');
    if(component.props.rowExpansion)check(component.props.rowExpansion.table.columns,path+'/props/rowExpansion/table/columns');
  });
  return errors;
}
