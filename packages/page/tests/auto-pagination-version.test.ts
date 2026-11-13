import {expect,it} from 'vitest';
import document from '../fixtures/contract-valid/record-join-auto-page.json';
import {parsePage} from '../src/validate';

it('accepts auto in 6.118 without mutating the declaration and rejects it in 6.117',()=>{
  const value=structuredClone(document),before=structuredClone(value);
  expect(parsePage(value).errors).toEqual([]);expect(value).toEqual(before);
  value.schemaVersion='6.117';
  expect(parsePage(value).errors).toContainEqual(expect.objectContaining({path:'/dataSources/rejection-overview/source/pagination/mode',message:expect.stringContaining('6.118')}));
});

it('requires record-preserving mode and the complete fallback budgets',()=>{
  const value=structuredClone(document),source=value.dataSources['rejection-overview'].source,records=source.records;
  Reflect.deleteProperty(source,'records');
  expect(parsePage(value).errors).toContainEqual(expect.objectContaining({path:'/dataSources/rejection-overview/source/records'}));
  source.records=records;Reflect.deleteProperty(source.records,'batchSize');Reflect.deleteProperty(source,'fallback');
  expect(parsePage(value).errors.map(error=>error.path)).toEqual(expect.arrayContaining(['/dataSources/rejection-overview/source/fallback','/dataSources/rejection-overview/source/records/batchSize']));
});
