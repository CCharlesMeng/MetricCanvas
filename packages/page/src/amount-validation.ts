import type {Page} from './page';
import type {TypedError} from './errors';
import {exhaustiveCases,numberRangeIssue,rangeInBaseUnits} from './amount-filter';
import {hasQueryFieldMapping} from './field';
export function amountErrors(page:Page):TypedError[]{
 const errors:TypedError[]=[],filters=page.filters??[];
 const fail=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
 for(const [i,filter]of filters.entries())if(filter.type==='numberRange'){
  const path=`/filters/${i}`;
  if(filter.constraints?.min!==undefined&&filter.constraints.max!==undefined&&filter.constraints.min>filter.constraints.max)fail(path+'/constraints','范围约束上下限顺序不合法');
  if((filter.constraints||filter.units||filter.presets)&&filter.default&&numberRangeIssue(filter,filter.default))fail(path+'/default','默认范围不符合约束');
  if(filter.units){
   if(!exhaustiveCases(filters,filter.units.filterId,filter.units.cases))fail(path+'/units','金额单位必须穷尽required单选封闭枚举');
   if(!filter.clearOnChangeOf?.includes(filter.units.filterId))fail(path+'/clearOnChangeOf','币种变化必须在同一事务清除金额');
  }
  const units=Object.values(filter.units?.cases??{}),perUnit=units.some(unit=>unit.presets!==undefined);
  if(perUnit&&(filter.presets||units.some(unit=>!unit.presets)))fail(path+'/units','按币种预设必须覆盖全部单位case，且不能与公共presets混用');
  const groups=perUnit?units.map(unit=>({presets:unit.presets??[],scale:unit.scale})):(units.length?units:[{scale:1}]).map(unit=>({presets:filter.presets??[],scale:unit.scale}));
  for(const group of groups){
   if(new Set(group.presets.map(p=>p.id)).size!==group.presets.length)fail(path+'/presets','范围预设id必须唯一');
   for(const preset of group.presets)try{rangeInBaseUnits(filter,preset.range,group.scale);}catch{fail(path+'/presets','预设换算溢出或不符合约束');}
  }
 }
 for(const [id,source]of Object.entries(page.dataSources))if(source.source.type==='query')for(const [filterId,binding]of Object.entries(source.source.query.filterBindings??{}))if(binding.target==='numberRange'){
  const path=`/dataSources/${id}/source/query/filterBindings/${filterId}`,filter=filters.find(f=>f.id===filterId);
  if(!!binding.metric===!!binding.metricByFilter){fail(path,'范围绑定需要互斥metric或metricByFilter');continue;}
  if(binding.metricByFilter){
   const selection=binding.metricByFilter;
   if(!exhaustiveCases(filters,selection.filterId,selection.cases))fail(path,'metricByFilter必须穷尽required单选枚举');
   if(filter?.type!=='numberRange'||filter.units?.filterId!==selection.filterId){fail(path,'动态金额metric必须与units使用同一币种');continue;}
   for(const [value,metric]of Object.entries(selection.cases)){
    const field=Object.values(source.fields).find(field=>hasQueryFieldMapping(field)&&field.queryField===metric);
    if(field?.type!=='money'||field.currency!==filter.units.cases[value]?.currency)fail(path,`金额case ${value}需要匹配币种的静态money查询字段`);
   }
  }else if(filter?.type==='numberRange'&&filter.units)fail(path,'多币种金额必须显式选择对应metric');
 }
 return errors;
}

/** Currency equality used to be implicit when CNY was the only money type. */
export function moneyComputeErrors(page:Page):TypedError[]{
 const errors:TypedError[]=[];
 for(const [id,source]of Object.entries(page.dataSources)){
  for(const [fieldId,field]of Object.entries(source.fields))if(field.type==='money'&&((field.currency==='USD'&&field.defaultFormat==='cny-adaptive')||(field.currency==='CNY'&&field.defaultFormat==='usd-adaptive')))errors.push({type:'SCHEMA_ERROR',path:`/dataSources/${id}/fields/${fieldId}`,message:'金额格式必须匹配静态货币'});
  for(const [i,op]of (source.compute??[]).entries()){
   const ids=op.op==='sumFields'?op.fields:op.op==='selectField'?Object.values(op.cases):op.op==='delta'?[op.minuend,op.subtrahend]:op.op==='ratio'?[op.numerator,op.denominator]:op.op==='cagr'?[op.beginning,op.ending]:[];
   const money=ids.map(id=>source.fields[id]).filter(field=>field?.type==='money');
   const output='output' in op?source.fields[op.output]:undefined;
   if(output?.type==='money')money.push(output);
   if(new Set(money.map(field=>field.currency)).size>1)errors.push({type:'SCHEMA_ERROR',path:`/dataSources/${id}/compute/${i}`,message:'计算不能混合静态货币字段'});
  }
 }return errors;
}
