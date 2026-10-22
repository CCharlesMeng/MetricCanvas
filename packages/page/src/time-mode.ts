import {isRelativeTimeExpression,resolveRelativeTime,validateCalendarTimeRange,type TimeRangeFilterDeclaration,type TimeRangeValue} from './filter';
import type {DqeQueryDefinition} from './query';
import {queryLeaves,hasQuerySelection} from './query-selection';
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
// Historical internal names retain the same shared static-query selection implementation.
export {ordinaryQuery,selectQuery as selectTimeQuery,queryLeaves as timeQueryLeaves,queryVariants as timeQueryVariants} from './query-selection';
/** Unannotated receipts cannot establish the time/period-fact context for these queries. */
export function requiresTimeValidation(filter:import('./filter').FilterDeclaration):boolean {
 return (filter.type==='timeRange'||filter.type==='timePoint')&&!!(filter.availability||filter.max||filter.blockedRanges||filter.type==='timeRange'&&(filter.display==='modes'||filter.min!==undefined||filter.disableFuture!==undefined));
}
export function hasTimeConstraints(query:DqeQueryDefinition,declarations:readonly import('./filter').FilterDeclaration[]=[]):boolean {
 const ids=new Set(queryLeaves(query).flatMap(leaf=>Object.keys(leaf.filterBindings??{})));
 return !!query.timeModes||declarations.some(filter=>ids.has(filter.id)&&requiresTimeValidation(filter));
}

/** Query receipts must prove both the selected branch and constrained input context. */
export function requiresQueryContext(query:DqeQueryDefinition,declarations:readonly import('./filter').FilterDeclaration[]=[]):boolean {
 return hasQuerySelection(query)||hasTimeConstraints(query,declarations);
}
