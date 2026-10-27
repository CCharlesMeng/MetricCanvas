import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
const load=()=>JSON.parse(readFileSync('pages/business-rejection-details.json','utf8'));
it('accepts a named approval time with no statistical filter.time',()=>{
  const page=load(),before=structuredClone(page);
  expect(parsePage(page).errors).toEqual([]);
  expect(page).toEqual(before);
});
it.each(['queryField','valueFormat'])('rejects an incomplete named time target missing %s',key=>{
  const page=load();delete page.dataSources['rejection-details'].source.query.filterBindings.mtime[key];
  expect(parsePage(page).errors).toContainEqual(expect.objectContaining({message:'字段时间绑定必须同时声明 queryField 和 valueFormat'}));
});
it('rejects field-time bindings before 6.68',()=>{
  const page=load();page.schemaVersion='6.67';
  expect(parsePage(page).ok).toBe(false);
});
it('retains explicit local-only record time filters at 6.66',()=>{
  const page=load();page.schemaVersion='6.66';
  page.dataSources['rejection-overview'].source.records.maxRows=100000;
  delete page.dataSources['rejection-details'].source.query.filterBindings.mtime;
  page.dataSources['rejection-overview'].source.records.timeFilters={mtime:{field:'biz-approve-time',valueFormat:'datetime'}};
  expect(parsePage(page).errors).toEqual([]);
});
it('rejects mixing period policy with a named time field',()=>{
  const page=load();
  page.filters[0].display='period';page.filters[0].default={mode:'month',value:'2026-09'};
  page.dataSources['rejection-details'].source.query.filterBindings.mtime.periodPolicy={kind:'fixed',period:'month'};
  expect(parsePage(page).errors).toContainEqual(expect.objectContaining({path:'/dataSources/rejection-details/source/query/filterBindings/mtime',message:'对象查询不支持指标期间策略'}));
});
it('detects named time bindings in static query mode cases',()=>{
  const page=load(),query=page.dataSources['rejection-details'].source.query;
  page.filters.push({id:'mode',type:'dimension',dimension:'mode',default:['a'],options:[{label:'A',value:'a'}],selection:{mode:'single',required:true}});
  query.queryModes={filterId:'mode',cases:{a:{body:query.body,filterBindings:query.filterBindings}}};delete query.body;delete query.filterBindings;
  expect(parsePage(page).errors).toEqual([]);
  page.schemaVersion='6.67';expect(parsePage(page).ok).toBe(false);
});

it('rejects minute precision rather than widening it to complete calendar days',()=>{
  const page=load();page.filters[0].precision='datetime';page.filters[0].default={from:'2026-09-01T10:00',to:'2026-09-01T11:00'};
  expect(parsePage(page).errors).toContainEqual(expect.objectContaining({message:'字段时间绑定仅支持日或月精度筛选'}));
});
