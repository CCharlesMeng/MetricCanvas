// Design arithmetic/state oracle ONLY. Does not load or implement Page Schema/runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const f = JSON.parse(readFileSync(new URL('./review-fixtures.json', import.meta.url)));
let checks = 0;
const equal = (actual, expected) => { assert.deepStrictEqual(actual, expected); checks++; };
const t = f.threeReturns;
equal(t.details.length + t.sum.length, t.expected.visibleRows);
equal(t.count, t.expected.totalCount);
equal(t.sum[0].totalIncome, t.expected.summaryIncome);
equal(t.page2.offset, t.page2.limit);
const normalize = (details, sum, count) => {
  if (!Number.isInteger(count) || count < details.length) throw Error('count');
  if (sum.length !== 1) throw Error('summary');
  return { details, summary: sum[0], totalCount: count };
};
equal(normalize(t.details,t.sum,t.count).totalCount,25);
assert.throws(()=>normalize(t.details,t.sum,undefined)); checks++;
assert.throws(()=>normalize(t.details,[...t.sum,...t.sum],t.count)); checks++;
for (const c of f.timeCases) {
  const ref = c.reference === 'system' ? c.clockYear : c.reference === 'page' ? Number(c.pageMonth.slice(0,4)) : Math.max(...c.rows.map(r=>Number(r.mtime.slice(0,4))));
  equal(ref,c.referenceYear);
  if (c.reference === 'page') {
    const groups = new Map();
    for (const r of c.rows) groups.set(r.period_id,[...(groups.get(r.period_id)??[]),r.value]);
    equal([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period_id,values])=>({period_id,value:values.every(v=>v===null)?null:values.reduce((s,v)=>s+(v??0),0)})),c.expected);
  } else {
    const value = (year,month) => c.rows.find(r=>r.mtime===`${year}${month}`)?.value??null;
    for (const [key,month] of [['jan','01'],['feb','02']]) if (c[key]) equal({current:value(ref,month),previous:value(ref-1,month)},c[key]);
  }
}
for (const name of ['allMissingForecast','partialForecast']) {
  const c=f.numericCases[name]; equal(c.input.reduce((a,b)=>a+(b??0),0),c.expected);
}
for (const c of f.numericCases.directSubtract) equal(c.previous==null?null:c.current-c.previous,c.expected);
for (const c of f.numericCases.growth) equal(c.base==null||c.base===0?(c.consumer.startsWith('经营概览')?0:null):(c.current-c.base)/c.base*100,c.expected);
const top=f.numericCases.topN, sorted=[...top.input].sort((a,b)=>b-a);
equal(sorted.slice(0,top.n),top.expected); equal(sorted.slice(top.n).reduce((a,b)=>a+b,0),top.other);
let active=null,state='closed';
for(const c of f.states){
  if(c.event.startsWith('open')){active=c.event.slice(4);state=`${active}:loading`;}
  else if(c.event==='close'||c.event==='pageFilterChange'){active=null;state='closed';}
  else if(c.event.slice(7)===active){state=`${active}:ready`;}
  equal(state,c.expected);
}
console.log(JSON.stringify({layer:'design-reference-oracle',checks,status:'pass',productAcceptance:'not-run',limitations:'No Schema validation, real orchestrator, cancellation, focus, column normalization, full TOP sorting or query execution tested.'},null,2));
