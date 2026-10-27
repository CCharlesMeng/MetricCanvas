import fs from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '../src/validate';
import {versionPolicy} from '../src/version';
const original=JSON.parse(fs.readFileSync(new URL('../../../pages/business-rejection-details.json',import.meta.url),'utf8'));
const root='rejection-overview';
describe('record join protocol',()=>{
  it('accepts the business page and preserves the input',()=>{const page=structuredClone(original);expect(parsePage(page).errors).toEqual([]);expect(page).toEqual(original);});
  it('requires the new capability version',()=>{const page=structuredClone(original);page.schemaVersion=`6.${versionPolicy.minor-1}`;expect(parsePage(page).ok).toBe(false);});
  it('requires explicit exclusion of the local time filter from the basic member',()=>{
    const page=structuredClone(original);delete page.dataSources[root].source.members.basic.notApplicableFilters;
    expect(parsePage(page).errors).toContainEqual(expect.objectContaining({path:`/dataSources/${root}/source/members/basic/source`,message:'每个成员必须显式消费全部组合业务筛选'}));
  });
  it.each(['unknown','consumed','domain','non-time','basic-time','numeric-id'])('rejects invalid %s configuration',kind=>{
    const page=structuredClone(original),source=page.dataSources[root].source;
    if(kind==='unknown')source.members.basic.notApplicableFilters.push('missing');
    if(kind==='consumed')source.members.basic.notApplicableFilters.push('region');
    if(kind==='domain')source.members.rejection.notApplicableFilters=['mtime'];
    if(kind==='non-time')source.records.timeFilters.region=source.records.timeFilters.mtime;
    if(kind==='basic-time')source.records.timeFilters.mtime.field='life-status';
    if(kind==='numeric-id')page.dataSources[root].fields['record-id'].type='number';
    expect(parsePage(page).ok).toBe(false);
  });
});
