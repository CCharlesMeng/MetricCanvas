import {periodFact,calendarEndpoint,type FilterDeclaration,type DisplayInputsSnapshot,type TimeRangeValue} from '@metriccanvas/page/internal';
export interface TimeControlContext {snapshot?:DisplayInputsSnapshot;revision?:number}
/** Display limits are projections of trusted inputs, never copied into Page metadata. */
export function timeControlLimits(filter:FilterDeclaration,context:TimeControlContext={}) :{max?:string;blockedRanges:readonly TimeRangeValue[];reason?:string} {
 if(filter.type!=='timeRange'&&filter.type!=='timePoint')return {blockedRanges:[]};
 const result:{max?:string;blockedRanges:readonly TimeRangeValue[];reason?:string}={max:filter.max,blockedRanges:filter.blockedRanges??[]};
 if(result.max&&filter.min&&calendarEndpoint(result.max,true)<calendarEndpoint(filter.min))return {...result,reason:'日期约束没有可选期间'};
 if(!filter.availability)return result;
 const fact=periodFact(context.snapshot,filter.availability.fact,context.revision);
 if(fact.status!=='ready')return {...result,reason:fact.status==='loading'?'等待期间事实':fact.status==='empty'?'暂无期间数据':'期间事实不可用'};
 const maximum=fact[filter.availability.max];if(!maximum)return {...result,reason:'完成期间事实未提供'};
 if(!result.max||calendarEndpoint(maximum,true)<calendarEndpoint(result.max,true))result.max=maximum;
 if(filter.availability.blockMissing)result.blockedRanges=[...result.blockedRanges,...fact.missingRanges??[]];
 if(result.max&&filter.min&&calendarEndpoint(result.max,true)<calendarEndpoint(filter.min))result.reason='日期约束没有可选期间';
 return result;
}
