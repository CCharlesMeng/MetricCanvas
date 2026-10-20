import {fieldSelectionIds} from './field-selection';
import {validateCalendarTimeRange} from './filter';
import {initialModeRange} from './time-mode';
import type {Page} from './page';
import type {TypedError} from './errors';
export function timeExtensionErrors(page:Page):TypedError[]{
 const selectors=new Map<string,number>();for(const source of Object.values(page.dataSources))if(source.source.type==='query'&&source.source.query.timeModes){const selection=source.source.query.timeModes;selectors.set(selection.filterId,Object.keys(selection.cases).length);}
 if(selectors.size)for(const id of fieldSelectionIds(page)){const filter=page.filters?.find(f=>f.id===id);if(filter?.type==='dimension'&&filter.options)selectors.set(id,filter.options.filter(option=>!option.disabled).length);}
 const errors:TypedError[]=[];const fail=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
 if([...selectors.values()].reduce((total,size)=>total*size,1)>4096)errors.push({type:'SCHEMA_ERROR',path:'/dataSources',message:'查询模式组合超过4096'});
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
 for(const [id,source]of Object.entries(page.dataSources))if(source.source.type==='query'){
  const query=source.source.query,path=`/dataSources/${id}/source/query`;
  if(!!query.body===!!query.timeModes)fail(path,'查询必须互斥声明普通body或timeModes');
  if(!query.timeModes&&Object.keys(query.filterBindings??{}).some(id=>page.filters?.some(f=>f.id===id&&f.type==='timeRange'&&f.display==='modes')))fail(path,'模式筛选必须使用显式timeModes完整查询');
  if(query.timeModes){
   if(query.body||query.filterBindings||query.paramBindings)fail(path,'模式查询与普通body/filterBindings/paramBindings互斥');
   const filter=page.filters?.find(item=>item.id===query.timeModes!.filterId);
   if(filter?.type!=='timeRange'||filter.display!=='modes'){fail(path,'timeModes必须引用模式范围筛选');continue;}
   const modes=filter.modes?.map(item=>item.id)??[];if(modes.length!==Object.keys(query.timeModes.cases).length||modes.some(mode=>!query.timeModes!.cases[mode]))fail(path,'查询case必须穷尽声明模式');
   let projection:string|undefined;
   for(const [mode,leaf]of Object.entries(query.timeModes.cases)){
    const binding=leaf.filterBindings[filter.id];if(binding?.target!=='time')fail(path,'每个case须显式绑定模式时间范围');
    const dsl=leaf.body.dsl_list[0];const captions=(value:unknown)=>Array.isArray(value)?value.map(item=>typeof item==='string'?item:item&&typeof item==='object'&&'alias' in item?item.alias:null).sort():[];const outputs=JSON.stringify([captions(dsl.output_dims),captions(dsl.output_metrics)]);if(projection!==undefined&&outputs!==projection)fail(path,'模式case必须输出相同字段/类型/货币映射');projection=outputs;
    const time=dsl.filter&&typeof dsl.filter==='object'&&!Array.isArray(dsl.filter)?(dsl.filter as Record<string,unknown>).time:undefined;
    const period=time&&typeof time==='object'&&!Array.isArray(time)?(time as Record<string,unknown>).period:undefined;
    if(period!==(mode==='month'?'month':mode==='isoWeek'?'week':'day'))fail(path,'静态查询period必须匹配显式模式');
   }
  }
 }
 for(const fact of page.iocHeader?.identity?.facts??[])if(typeof fact.value==='object'&&'fact' in fact.value){const expected=fact.kind==='latestDataPeriod'?['latest','latestComplete']:[fact.kind];if(!expected.includes(fact.value.part))fail('/iocHeader/identity/facts','期间事实part与kind不匹配');}
 return errors;
}
