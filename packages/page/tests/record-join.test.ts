import fs from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '../src/validate';
const original=JSON.parse(fs.readFileSync(new URL('../../../pages/business-rejection-details.json',import.meta.url),'utf8'));
const root='rejection-overview';
describe('record join protocol',()=>{
  it('accepts the business page and preserves the input',()=>{const page=structuredClone(original);expect(parsePage(page).errors).toEqual([]);expect(page).toEqual(original);});
  it('requires the records capability version',()=>{const page=structuredClone(original);page.schemaVersion='6.65';expect(parsePage(page).ok).toBe(false);});
  it('requires explicit exclusion of the local time filter from the basic member',()=>{
    const page=structuredClone(original);delete page.dataSources[root].source.members.basic.notApplicableFilters;
    expect(parsePage(page).errors).toContainEqual(expect.objectContaining({path:`/dataSources/${root}/source/members/basic/source`,message:'每个成员必须显式消费全部组合业务筛选'}));
  });
  it.each(['unknown','consumed','domain','non-time','basic-time','numeric-id'])('rejects invalid %s configuration',kind=>{
    const page=structuredClone(original),source=page.dataSources[root].source;
    if(kind==='unknown')source.members.basic.notApplicableFilters.push('missing');
    if(kind==='consumed')source.members.basic.notApplicableFilters.push('region');
    if(kind==='domain')source.members.rejection.notApplicableFilters=['mtime'];
    if(kind==='non-time')source.records.timeFilters={region:{field:'biz-approve-time',valueFormat:'datetime'}};
    if(kind==='basic-time')source.records.timeFilters={mtime:{field:'life-status',valueFormat:'datetime'}};
    if(kind==='numeric-id')page.dataSources[root].fields['record-id'].type='number';
    expect(parsePage(page).ok).toBe(false);
  });
});


describe('optional record row budget',()=>{
  it('requires 6.69 when maxRows is omitted and preserves explicit limits on old pages',()=>{
    const page=structuredClone(original);
    expect(parsePage(page).ok).toBe(true);
    page.schemaVersion='6.68';
    expect(parsePage(page).errors).toContainEqual(expect.objectContaining({type:'SCHEMA_ERROR',path:'/dataSources/rejection-overview',message:expect.stringContaining('6.69')}));
    page.dataSources[root].source.records.maxRows=undefined;
    expect(parsePage(page).ok).toBe(false);
    page.dataSources[root].source.records.maxRows=100000;
    expect(parsePage(page).ok).toBe(true);
  });
  it.each([null,0,-1,1.5,100001])('rejects invalid explicit row budget %s',maxRows=>{
    const page=structuredClone(original);page.dataSources[root].source.records.maxRows=maxRows;
    expect(parsePage(page).ok).toBe(false);
  });
});
