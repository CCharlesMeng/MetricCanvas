import { expect, it } from 'vitest';
import { normalizeDisplayQueryRows, normalizeQueryRows, rowCellFallback, type QueryDataSourceFieldDefinition } from '../src/internal';

it('keeps valid nested detail mappings in both raw and normalized field spaces', () => {
  const fields: Record<string, QueryDataSourceFieldDefinition> = {details:{queryField:'RAW',type:'recordList',role:'detail',items:{fields:{name:{queryField:'RAW_NAME',type:'string',role:'dimension'}}}}};
  const raw = normalizeDisplayQueryRows([{RAW:[{RAW_NAME:'item'}]}],fields);
  expect(raw.rows).toEqual([{details:[{name:'item'}]}]);
  expect(normalizeDisplayQueryRows(raw.rows,fields,true).rows).toEqual(raw.rows);
  expect(normalizeDisplayQueryRows([{RAW:{invalid:true}}],fields).rows).toEqual([{details:null}]);
  expect(normalizeQueryRows([{RAW:{invalid:true}}],fields).ok).toBe(false);
});

it('retains multiple scalar fallbacks without consuming them as typed values', () => {
  const fields: Record<string, QueryDataSourceFieldDefinition> = {
    a:{queryField:'A',type:'string',role:'dimension'},b:{queryField:'B',type:'number',role:'measure'}
  };
  const result = normalizeDisplayQueryRows([{A:123,B:'unavailable'}],fields);
  expect(result.rows).toEqual([{a:null,b:null}]);
  expect(rowCellFallback(result.rows[0],'a')?.raw).toBe(123);
  expect(rowCellFallback(result.rows[0],'b')?.raw).toBe('unavailable');
  const repeated = normalizeDisplayQueryRows(result.rows,fields,true);
  expect(repeated.cellFallbacks).toEqual(result.cellFallbacks);
});
