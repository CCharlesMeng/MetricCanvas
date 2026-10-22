import {isRelativeTimeExpression,resolveRelativeTime,validateCalendarTimeRange,type TimeRangeFilterDeclaration,type TimeRangeValue} from './filter';
import type {DqeQueryDefinition,DqeRequestBody} from './query';
import type {Page} from './page';
export type TimeMode='day'|'month'|'isoWeek';
export interface ModeRange extends TimeRangeValue {mode?:TimeMode}
export function modeRangeIssue(declaration:TimeRangeFilterDeclaration,range:ModeRange):string|undefined {
 if(declaration.display!=='modes')return range.mode?'普通日期范围不得带模式':undefined;
 if('selection' in range&&range.selection!==undefined)return '模式范围不得混用自然期间选择';
 if(!range.mode||!declaration.modes?.some(item=>item.id===range.mode))return '时间模式未配置';
 const issues=validateCalendarTimeRange(range,range.mode==='month'?'month':'date');if(issues.length)return issues[0].message;
 if(range.mode==='isoWeek'){const expected=isoWeekRange(range.from);if(range.from!==expected.from||range.to!==expected.to)return 'ISO周必须为同一周的周一至周日';}
 return;
}
export function isoWeekRange(value:string):TimeRangeValue {
 if(validateCalendarTimeRange({from:value,to:value},'date').length)throw new Error('非法ISO周日期');
 const date=new Date(value+'T12:00:00Z'),weekday=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-weekday);const from=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+6);return {from,to:date.toISOString().slice(0,10)};
}
export function isoWeekLabel(value:string):string {
 const range=isoWeekRange(value),thursday=new Date(range.from+'T12:00:00Z');thursday.setUTCDate(thursday.getUTCDate()+3);const year=thursday.getUTCFullYear(),first=isoWeekRange(`${year}-01-04`);const week=1+Math.round((Date.parse(range.from)-Date.parse(first.from))/604800000);return `${year}-W${String(week).padStart(2,'0')}`;
}
export function initialModeRange(declaration:TimeRangeFilterDeclaration,mode:TimeMode,now:Date):ModeRange {
 const entry=declaration.modes?.find(item=>item.id===mode);if(!entry)throw new Error('时间模式未配置');
 const range=isRelativeTimeExpression(entry.default)?resolveRelativeTime(entry.default,now,mode==='month'?'month':'date'):entry.default;
 const result={...range,mode};const issue=modeRangeIssue(declaration,result);if(issue)throw new Error(issue);return result;
}
export function ordinaryQuery(query:DqeQueryDefinition):DqeQueryDefinition&{body:DqeRequestBody} {
 if(!query.body||query.timeModes)throw Object.assign(new Error('模式查询须先按合法已应用模式选择'),{code:'DQE_QUERY_REJECTED'});return query as DqeQueryDefinition&{body:DqeRequestBody};
}
export function selectTimeQuery(query:DqeQueryDefinition,values:ReadonlyMap<string,{type:string;mode?:TimeMode}>):DqeQueryDefinition&{body:DqeRequestBody} {
 if(!query.timeModes)return ordinaryQuery(query);
 const selected=values.get(query.timeModes.filterId);const leaf=selected?.type==='timeRange'&&selected.mode?query.timeModes.cases[selected.mode]:undefined;
 if(!leaf)throw Object.assign(new Error('时间模式查询未通过合法选择'),{code:'DQE_QUERY_REJECTED'});
 const {timeModes,body,filterBindings,paramBindings,...base}=query;return {...base,...leaf};
}
/** All static leaves are visible to validation and dependency discovery. */
export function timeQueryLeaves(query:DqeQueryDefinition):Array<DqeQueryDefinition&{body:DqeRequestBody}>{
 if(!query.timeModes)return [ordinaryQuery(query)];
 const {timeModes,body,filterBindings,paramBindings,...base}=query;return Object.values(timeModes.cases).map(leaf=>({...base,...leaf}));
}
export function* timeQueryVariants(page:Page):Generator<Page>{
 const selectors=new Map<string,TimeMode[]>();for(const source of Object.values(page.dataSources))if(source.source.type==='query'&&source.source.query.timeModes){const selection=source.source.query.timeModes;selectors.set(selection.filterId,Object.keys(selection.cases) as TimeMode[]);}
 if(!selectors.size){yield page;return;}
 let assignments:Map<string,{type:string;mode:TimeMode}>[]=[new Map()];for(const [id,modes]of selectors){if(assignments.length*modes.length>4096)throw new Error('查询模式组合超过4096');assignments=assignments.flatMap(values=>modes.map(mode=>new Map(values).set(id,{type:'timeRange',mode})));}
 for(const values of assignments){const sources=Object.fromEntries(Object.entries(page.dataSources).map(([id,source])=>[id,source.source.type==='query'?{...source,source:{...source.source,query:selectTimeQuery(source.source.query,values)}}:source]));yield {...page,dataSources:sources};}
}

/** Unannotated receipts cannot establish the time/period-fact context for these queries. */
export function requiresTimeValidation(filter:import('./filter').FilterDeclaration):boolean {
 return (filter.type==='timeRange'||filter.type==='timePoint')&&!!(filter.availability||filter.max||filter.blockedRanges||filter.type==='timeRange'&&(filter.display==='modes'||filter.min!==undefined||filter.disableFuture!==undefined));
}
export function hasTimeConstraints(query:DqeQueryDefinition,declarations:readonly import('./filter').FilterDeclaration[]=[]):boolean {
 const ids=new Set(timeQueryLeaves(query).flatMap(leaf=>Object.keys(leaf.filterBindings??{})));
 return !!query.timeModes||declarations.some(filter=>ids.has(filter.id)&&requiresTimeValidation(filter));
}
