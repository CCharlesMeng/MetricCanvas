import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolvePeriodSelection, periodSelectionFromRange, periodRangeLabel } from '../src/period-filter';
import { parsePage } from '../src/validate';
import { extractPageParams } from '../src/extract-page-params';
const now=new Date(2026,9,15);
const document=()=>JSON.parse(readFileSync(new URL('../fixtures/contract-valid/dashboard-period-filter.json',import.meta.url),'utf8'));
describe('period contract and calendar semantics',()=>{
  it.each([
    [{mode:'year',value:'2024'},'2024-01-01','2024-12-31'],
    [{mode:'quarter',value:'2026-Q1'},'2026-01-01','2026-03-31'],
    [{mode:'quarter',value:'2026-Q4'},'2026-10-01','2026-12-31'],
    [{mode:'month',value:'2024-02'},'2024-02-01','2024-02-29'],
    [{mode:'last12Months'},'2025-10-01','2026-09-30']
  ] as const)('resolves %j independently from display strings',(selection,from,to)=>{
    expect(resolvePeriodSelection(selection,now)).toMatchObject({from,to});
    expect(resolvePeriodSelection(selection,now,'month')).toMatchObject({from:from.slice(0,7),to:to.slice(0,7)});
  });
  it('uses current month for default and excludes current month for last twelve',()=>{
    expect(resolvePeriodSelection({mode:'month'},now).selection).toEqual({mode:'month',value:'2026-10'});
    const range=resolvePeriodSelection({mode:'last12Months'},now);
    expect(periodRangeLabel(range)).toBe('25年10月~26年9月');
    expect(resolvePeriodSelection({mode:'last12Months'},new Date(2026,0,1))).toMatchObject({from:'2025-01-01',to:'2025-12-31'});
  });
  it.each(['2026-Q0','2026-Q5','2026-Q2 extra','0000-Q1'])('rejects malformed quarter %s',value=>expect(()=>resolvePeriodSelection({mode:'quarter',value},now)).toThrow());
  it('requires parameter boundaries to match a complete declared natural period',()=>{
    expect(periodSelectionFromRange({from:'2024-02-01',to:'2024-02-29'},'month','date')).toEqual({mode:'month',value:'2024-02'});
    expect(periodSelectionFromRange({from:'2026-04-01',to:'2026-06-29'},'quarter','date')).toBeUndefined();
  });
  it('accepts both full scenario pages and guards the capability version',()=>{
    expect(parsePage(document()).ok).toBe(true);
    const page=document();page.schemaVersion='6.26';expect(parsePage(page).ok).toBe(false);
  });
  it.each(['datetime','invalidQuarter','missingDefault','report','plainRange'])('rejects incompatible declarations %s',kind=>{
    const page=document(),f=page.filters[0];
    if(kind==='datetime')f.precision='datetime';
    if(kind==='invalidQuarter')f.default={mode:'quarter',value:'2026-Q5'};
    if(kind==='missingDefault')delete f.default;
    if(kind==='report')page.layout='report';
    if(kind==='plainRange')delete f.display;
    expect(parsePage(page).ok).toBe(false);
  });
  it('does not freeze a dynamic period into a parameter candidate',()=>{
    const result=extractPageParams(document(),{baseline:'period-fixture'});expect(result.ok).toBe(true);
    if(result.ok)expect(result.candidates.some(c=>c.locations.some(l=>l.filterId==='period-filter'))).toBe(false);
  });
});

it('limits period defaults and parameter initialization to the declared modes',()=>{
  const page=document();page.schemaVersion='6.41';page.filters[0].periodModes=['year'];page.filters[0].default={mode:'year'};
  expect(parsePage(page).ok).toBe(true);
  page.filters[0].periodModes=['year','month'];expect(parsePage(page).ok).toBe(true);
  page.filters[0].periodModes=['year'];page.filters[0].default={mode:'month'};expect(parsePage(page).ok).toBe(false);
  const parameter=JSON.parse(readFileSync(new URL('../fixtures/contract-valid/period-filter-parameter-page.json',import.meta.url),'utf8'));
  parameter.schemaVersion='6.41';parameter.filters[0].periodModes=[parameter.filters[0].initialMode];expect(parsePage(parameter).ok).toBe(true);
  parameter.filters[0].periodModes=['year'];parameter.filters[0].initialMode='quarter';
  const invalid=parsePage(parameter);expect(invalid.ok).toBe(false);
  if(!invalid.ok)expect(invalid.errors).toEqual(expect.arrayContaining([expect.objectContaining({path:'/filters/0/initialMode'})]));
});
