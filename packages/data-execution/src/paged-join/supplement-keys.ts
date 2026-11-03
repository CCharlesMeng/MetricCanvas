import {rowCellFallback,type DataWarning,type Row} from '@metriccanvas/page/internal';
import type {PagedJoinPlan} from './plan';
import {mergeJoinWarnings} from './warnings';

/** Only an optional supplement can lose rows; selected and domain identities remain strict. */
export function withoutEmptySupplementKeys(plan:PagedJoinPlan,id:string,rows:Row[],warnings?:DataWarning[]):Row[]{
  if(!warnings||plan.strategy!=='queryPage'||id===plan.source.source.domainMember)return rows;
  const field=plan.source.source.members[id].key.field;
  const usable=rows.filter(row=>{
    const key=row[field];
    return Boolean(rowCellFallback(row,field))||!(key==null||(typeof key==='string'&&!key.trim()));
  });
  const count=rows.length-usable.length;
  if(count)mergeJoinWarnings(warnings,[{
    code:'TABLE_RESULT_RECOVERED',sourceId:plan.source.source.members[id].source,fields:[field],
    message:'已忽略关联编号为空的补充记录，缺少匹配的补充字段按缺项策略显示',count
  }]);
  return usable;
}
