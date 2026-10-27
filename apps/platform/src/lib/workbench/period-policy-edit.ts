import { resolvePeriodSelection, resolvePeriodQuery, type DqeFilterBinding, type PeriodMode, type PeriodQueryPolicy, type QueryPeriod } from '@metriccanvas/page/internal';
export type PeriodPolicyChoice = '' | 'legacy' | 'preserve' | QueryPeriod | 'selection';
export const periodPolicyOptions = [
  {value:'',label:'请选择查询策略'}, {value:'legacy',label:'保留旧协议'},
  {value:'preserve',label:'保留各分支原配置'},
  {value:'day',label:'固定按日'}, {value:'month',label:'固定按月'},
  {value:'year',label:'固定按年（必要时扩大范围）'}, {value:'selection',label:'按所选周期（近一年按月）'}
];
export function periodPolicyChoice(binding:DqeFilterBinding|undefined, existing:boolean):PeriodPolicyChoice {
  const policy=binding?.target==='time'?binding.periodPolicy:undefined;
  if(policy)return policy.kind==='fixed'?policy.period:'selection';
  return existing?'legacy':'';
}
export function policyFromChoice(choice:PeriodPolicyChoice,supportedPeriods:QueryPeriod[]):PeriodQueryPolicy|undefined {
  if(choice===''||choice==='legacy'||choice==='preserve')return undefined;
  return choice==='selection'?{kind:choice,supportedPeriods}:{kind:'fixed',period:choice};
}
export function preservePeriodBinding(choice:PeriodPolicyChoice,existing:boolean,changed:boolean):boolean {
  return choice==='legacy'||choice==='preserve'||existing&&!changed;
}
export function periodPolicyPreview(mode:PeriodMode,value:string,policy:PeriodQueryPolicy|undefined,now:Date):string {
  if(!policy)return '沿用旧查询配置';
  try {
    const input=mode==='last12Months'?{mode} as const:{mode,...(value?{value}:{})};
    const resolved=resolvePeriodQuery(resolvePeriodSelection(input,now),policy);
    return `${resolved.period} · ${resolved.from} ～ ${resolved.to}${resolved.expanded?'（已扩大到完整自然年）':''}`;
  }catch(cause){return cause instanceof Error?cause.message:'期间配置无效';}
}
