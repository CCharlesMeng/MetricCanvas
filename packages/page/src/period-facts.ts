import {daysInGregorianMonth,validateCalendarTimeRange,validateTimePointValue,type FilterDeclaration,type TimeRangeValue} from './filter';
export type DataPeriodFact=({status:'ready';granularity:'month'|'date';latest:string;latestComplete?:string;missingRanges?:TimeRangeValue[];refreshedAt?:string;generatedAt?:string}|{status:'loading'|'empty'|'unavailable'|'error'})&{filterRevision?:number};
/** Neutral, immutable, trusted input. Never part of Page/URL/parameter values. */
export interface DisplayInputsSnapshot {contextRevision:string;timeZone:string;periods:Readonly<Record<string,DataPeriodFact>>}
export interface DisplayInputsSource {getSnapshot():DisplayInputsSnapshot;subscribe(listener:()=>void):()=>void}
export function periodFact(snapshot:DisplayInputsSnapshot|undefined,id:string,revision?:number):DataPeriodFact {
 const fact=snapshot?.periods?.[id];if(!snapshot||!fact)return {status:'unavailable'};
 if(typeof snapshot.contextRevision!=='string'||!snapshot.contextRevision.trim()||typeof snapshot.timeZone!=='string'||!snapshot.timeZone.trim())return {status:'error'};
 try{new Intl.DateTimeFormat('en',{timeZone:snapshot.timeZone});}catch{return {status:'error'};}
 if(fact.filterRevision!==undefined&&fact.filterRevision!==revision)return {status:'loading'};
 if(fact.status!=='ready')return ['loading','empty','unavailable','error'].includes(fact.status)?fact:{status:'error'};
 if(!['month','date'].includes(fact.granularity)||typeof fact.latest!=='string'||fact.latestComplete!==undefined&&typeof fact.latestComplete!=='string'||validateTimePointValue(fact.latest,fact.granularity)||fact.latestComplete&&(validateTimePointValue(fact.latestComplete,fact.granularity)||fact.latestComplete>fact.latest))return {status:'error'};
 if(fact.missingRanges!==undefined&&!Array.isArray(fact.missingRanges))return {status:'error'};
 for(const range of fact.missingRanges??[])if(!range||typeof range.from!=='string'||typeof range.to!=='string'||validateCalendarTimeRange(range,fact.granularity).length)return {status:'error'};
 for(const stamp of [fact.refreshedAt,fact.generatedAt])if(stamp!==undefined&&(typeof stamp!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(stamp)||validateTimePointValue(stamp.slice(0,10),'date')||!Number.isFinite(Date.parse(stamp))))return {status:'error'};
 return fact;
}
export function calendarEndpoint(value:string,end=false):string {
 if(/^\d{4}-\d\d$/.test(value)){const [year,month]=value.split('-').map(Number);return `${value}-${end?String(daysInGregorianMonth(year,month)).padStart(2,'0'):'01'}`;}return value.slice(0,10);
}
export function timeAvailabilityIssue(declaration:FilterDeclaration,value:{type:string;value?:unknown;from?:unknown;to?:unknown}|undefined,snapshot?:DisplayInputsSnapshot,revision?:number):string|undefined {
 if(declaration.type!=='timePoint'&&declaration.type!=='timeRange')return;
 const availability=declaration.availability;
 if(availability){const fact=periodFact(snapshot,availability.fact,revision);if(fact.status!=='ready')return `期间事实${fact.status==='loading'?'等待输入':'不可用'}`;const maximum=fact[availability.max];if(!maximum)return '完成期间事实未提供';
  const to=value?.type==='timePoint'&&typeof value.value==='string'?value.value:typeof value?.to==='string'?value.to:undefined;if(to&&calendarEndpoint(to,true)>calendarEndpoint(maximum,true))return '期间超过可信数据上限';
  if(availability.blockMissing&&value){const from=value.type==='timePoint'&&typeof value.value==='string'?value.value:typeof value.from==='string'?value.from:undefined;if(from&&to&&(fact.missingRanges??[]).some(range=>calendarEndpoint(from)<=calendarEndpoint(range.to,true)&&calendarEndpoint(to,true)>=calendarEndpoint(range.from)))return '所选期间包含显式禁选缺数区间';}
 }
 const from=value?.type==='timePoint'&&typeof value.value==='string'?value.value:typeof value?.from==='string'?value.from:undefined,to=value?.type==='timePoint'&&typeof value.value==='string'?value.value:typeof value?.to==='string'?value.to:undefined;
 if(from&&declaration.min&&staticEndpoint(from)<staticEndpoint(declaration.min))return '期间早于声明下限';
 if(to&&declaration.max&&staticEndpoint(to,true)>staticEndpoint(declaration.max,true))return '期间晚于声明上限';
 if(from&&to&&declaration.blockedRanges?.some(range=>staticEndpoint(from)<=staticEndpoint(range.to,true)&&staticEndpoint(to,true)>=staticEndpoint(range.from)))return '所选期间包含禁选区间';
 return;
}
export function availabilityInitial(declaration:FilterDeclaration,snapshot?:DisplayInputsSnapshot,revision?:number):string|undefined {
 if((declaration.type!=='timePoint'&&declaration.type!=='timeRange')||!declaration.availability?.initial)return;
 const fact=periodFact(snapshot,declaration.availability.fact,revision);if(fact.status!=='ready')return;return fact[declaration.availability.initial];
}
export function formatPeriodFact(snapshot:DisplayInputsSnapshot|undefined,id:string,part:'latest'|'latestComplete'|'refreshedAt'|'generatedAt',revision?:number):string|undefined {
 const fact=periodFact(snapshot,id,revision);if(fact.status!=='ready')return fact.status==='loading'?'等待期间事实':fact.status==='empty'?'暂无期间数据':'期间事实不可用';
 const value=fact[part];if(!value)return;
 if(part==='latest'||part==='latestComplete')return value;
 return new Intl.DateTimeFormat('zh-CN',{timeZone:snapshot!.timeZone,dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date(value));
}

function staticEndpoint(value:string,end=false):string {return value.includes('T')?value:calendarEndpoint(value,end)+(end?'T23:59:59.999':'T00:00');}
