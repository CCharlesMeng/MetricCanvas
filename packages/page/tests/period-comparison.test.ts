import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {resolvePeriodSelection,type PeriodSelection} from '../src/period-filter';
import {resolvePeriodComparison} from '../src/period-comparison';
import {comparisonCapabilityPaths} from '../src/period-comparison-validation';
import type {DisplayInputsSnapshot} from '../src/period-facts';
const now=new Date(2026,9,29);
const inputs=(latest='2026-10-28'):DisplayInputsSnapshot=>({permissions:{},values:{},permissionRevision:'test',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',latest,granularity:'date'}}});
const document=()=>JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/period-comparison/period-comparison-demo.json',import.meta.url),'utf8'));
it('inspects untrusted capability declarations without interpreting opaque data',()=>{
  expect(comparisonCapabilityPaths({dataSources:{bad:null,malformed:{source:{query:{timeModes:{cases:null},filterBindings:{bad:null}}},compute:[null,{op:'joinAggregate',values:[null]}]}}})).toEqual([]);
  expect(comparisonCapabilityPaths({dataSources:{raw:{source:{query:{body:{periodComparison:{kind:'current'}}}},compute:[{op:'other',values:[{onMissing:'zero'}]}]}}})).toEqual([]);
  const binding={target:'time',periodComparison:{kind:'current',fact:'sales'}};
  const query={timeModes:{cases:{month:{filterBindings:{period:binding}}}}};
  expect(comparisonCapabilityPaths({dataSources:{nested:{source:{query}}}})).toEqual(['/dataSources/nested/source/query']);
});
it.each([
  [{mode:'month',value:'2026-10'},'current','2026-10-01','2026-10-28'],
  [{mode:'month',value:'2026-10'},'previousPeriod','2026-09-01','2026-09-28'],
  [{mode:'quarter',value:'2026-Q4'},'previousPeriod','2026-07-01','2026-07-28'],
  [{mode:'year',value:'2026'},'previousYear','2025-01-01','2025-10-28'],
  [{mode:'year',value:'2026'},'previousPeriod','2025-01-01','2025-10-28'],
  [{mode:'last12Months'},'previousPeriod','2024-10-01','2025-09-30'],
  [{mode:'last12Months'},'previousYear','2024-10-01','2025-09-30'],
  [{mode:'month',value:'2024-02'},'previousPeriod','2024-01-01','2024-01-31'],
  [{mode:'quarter',value:'2026-Q1'},'previousPeriod','2025-10-01','2025-12-31']
] as const)('derives %j %s calendar boundaries',(selection,kind,from,to)=>{
  const range=resolvePeriodSelection(selection,now);const original=structuredClone(range);
  expect(resolvePeriodComparison(range,{kind,fact:'sales'},inputs())).toEqual({from,to});
  expect(range).toEqual(original);
});
it('clamps leap dates and month ends, consuming the frozen rolling range',()=>{
  const month=resolvePeriodSelection({mode:'month',value:'2024-02'},now);
  expect(resolvePeriodComparison(month,{kind:'previousYear',fact:'sales'},inputs('2024-02-29'))).toEqual({from:'2023-02-01',to:'2023-02-28'});
  const year=resolvePeriodSelection({mode:'year',value:'2024'},now);
  expect(resolvePeriodComparison(year,{kind:'previousYear',fact:'sales'},inputs('2024-02-29')).to).toBe('2023-02-28');
  const rolling=resolvePeriodSelection({mode:'last12Months'},now,'month');
  expect(resolvePeriodComparison(rolling,{kind:'previousYear',fact:'sales'},inputs('2027-01-01'))).toEqual({from:'2024-10-01',to:'2025-09-30'});
});
it('fails closed on missing/stale cutoff, unavailable current period and calendar underflow',()=>{
  const range=resolvePeriodSelection({mode:'month',value:'2026-10'},now);
  expect(()=>resolvePeriodComparison(range,{kind:'current',fact:'sales'})).toThrow('统计截止时间');
  const stale=inputs();stale.periods!.sales.filterRevision=1;
  expect(()=>resolvePeriodComparison(range,{kind:'current',fact:'sales'},stale,2)).toThrow('统计截止时间');
  expect(()=>resolvePeriodComparison(range,{kind:'current',fact:'sales'},inputs('2026-09-30'))).toThrow('尚无');
  const old=resolvePeriodSelection({mode:'year',value:'0001'},now);
  expect(()=>resolvePeriodComparison(old,{kind:'previousYear',fact:'sales'},inputs())).toThrow('公历');
});
it('accepts the complete demo and gates all new declarations at 6.77',()=>{
  const raw=document();expect(parsePage(raw)).toMatchObject({ok:true});
  raw.schemaVersion='6.76';expect(parsePage(raw).ok).toBe(false);
});
it.each(['periodPolicy','window','ordinary','granularity','fixed','limited','incomplete','unknown-kind','unknown-field'])('rejects invalid comparison declaration %s',kind=>{
  const raw=document(),source=raw.dataSources.current.source,binding=source.query.filterBindings.period,item=source.query.body.dsl_list[0];
  if(kind==='periodPolicy')binding.periodPolicy={kind:'fixed',period:'day'};
  if(kind==='window')binding.window={kind:'period',unit:'month'};
  if(kind==='ordinary')delete raw.filters[0].display;
  if(kind==='granularity')item.filter.time.period='month';
  if(kind==='fixed')item.filter.time.start='2026-01-01';
  if(kind==='limited')item.order={limit:5};
  if(kind==='incomplete')delete source.resultScope;
  if(kind==='unknown-kind')binding.periodComparison.kind='lastMonth';
  if(kind==='unknown-field')binding.periodComparison.cutoff='2026-10-28';
  expect(parsePage(raw).ok).toBe(false);
});

it('rejects tampered applied ranges instead of shifting a different calendar period',()=>{
  const range=resolvePeriodSelection({mode:'month',value:'2026-10'},now);
  expect(()=>resolvePeriodComparison({...range,from:'2026-09-01'},{kind:'previousYear',fact:'sales'},inputs())).toThrow('不一致');
  const rolling=resolvePeriodSelection({mode:'last12Months'},now);
  expect(()=>resolvePeriodComparison({...rolling,to:'2026-09-29'},{kind:'previousYear',fact:'sales'},inputs())).toThrow('完整自然月');
});
