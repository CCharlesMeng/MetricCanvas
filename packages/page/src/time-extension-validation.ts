import {queryBudgetErrors,timeQueryErrors} from './query-selection-validation';
import {validateCalendarTimeRange} from './filter';
import {initialModeRange} from './time-mode';
import type {Page} from './page';
import type {TypedError} from './errors';
export function timeExtensionErrors(page:Page):TypedError[]{
 const errors:TypedError[]=queryBudgetErrors(page);const fail=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
 for(const [i,filter]of (page.filters??[]).entries()){
  const path=`/filters/${i}`;
  if(filter.type==='dimension'&&filter.candidateWindow&&(filter.options||filter.hierarchy))fail(path,'月份窗口仅用于动态平面年月维度');
  if(filter.type!=='timeRange'&&filter.type!=='timePoint')continue;
  if(filter.availability?.initial&&(filter.default!==undefined||filter.initialParam))fail(path,'availability.initial与default/initialParam互斥');
  if(filter.type==='timeRange'){
   if(filter.display==='modes'){
    if(!filter.required||!filter.modes?.length||!filter.defaultMode||!filter.modes.some(item=>item.id===filter.defaultMode)||filter.initialParam||filter.initialMode||filter.default!==undefined||filter.precision)fail(path,'模式范围必须声明required/modes/defaultMode，并与普通精度/默认/参数初始化互斥');
    if(new Set(filter.modes?.map(item=>item.id)).size!==filter.modes?.length)fail(path,'时间模式必须唯一');
    for(const mode of filter.modes??[])try{initialModeRange(filter,mode.id,new Date(2026,9,19));}catch{fail(path,'时间模式默认范围不合法');}
   }else if(filter.modes||filter.defaultMode)fail(path,'modes/defaultMode仅用于display:modes');
   if(filter.display==='period'&&filter.presets)fail(path,'自然期间选择与范围快捷预设互斥');
   if(new Set(filter.presets?.map(item=>item.id)).size!==(filter.presets?.length??0))fail(path,'时间预设id必须唯一');
   for(const preset of filter.presets??[])if(preset.range.anchor&&validateCalendarTimeRange({from:preset.range.anchor,to:preset.range.anchor},'date').length)fail(path,'预设锚点须为合法日期');
  }
  for(const key of ['min','max'] as const){const value=filter[key];if(key==='min'&&filter.type==='timePoint')continue;if(value&&validateCalendarTimeRange({from:value,to:value},filter.type==='timePoint'?filter.granularity:filter.precision==='datetime'&&value.includes('T')?'datetime':/^\d{4}-\d\d$/.test(value)?'month':'date').length)fail(`${path}/${key}`,'静态日期边界须为合法日历值');}
  for(const range of filter.blockedRanges??[])if(validateCalendarTimeRange(range,filter.type==='timeRange'&&filter.precision==='datetime'&&range.from.includes('T')?'datetime':range.from.length===7?'month':'date').length)fail(path,'禁选范围不合法');
  if(filter.min&&filter.max&&filter.min>filter.max)fail(path,'日期上下限顺序不合法');
 }
 errors.push(...timeQueryErrors(page));
 for(const fact of page.iocHeader?.identity?.facts??[])if(typeof fact.value==='object'&&'fact' in fact.value){const expected=fact.kind==='latestDataPeriod'?['latest','latestComplete']:[fact.kind];if(!expected.includes(fact.value.part))fail('/iocHeader/identity/facts','期间事实part与kind不匹配');}
 return errors;
}
