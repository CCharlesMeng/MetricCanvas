import {describe,it,expect} from 'vitest';
import fixture from '../../../pages/capabilities/ioc-header/selection/ioc-header-selection.json';
import {parsePage} from '../src';
describe('dimension selection protocol',()=>{
 it('accepts full page and gates only new declarations',()=>{
  const result=parsePage(fixture);if(!result.ok)throw Error(JSON.stringify(result.errors));
  expect(result.ok).toBe(true);
  expect(parsePage({...fixture,schemaVersion:'6.42'}).ok).toBe(false);
 });
 it.each([{selection:{mode:'single'},default:['a','b']},{display:'tabs',selection:{mode:'multiple'}},{display:'select',treeSelection:'leaf'},{searchable:'yes'}])('rejects %j', patch=>{
  const page=structuredClone(fixture);Object.assign(page.filters[0],patch);expect(parsePage(page).ok).toBe(false);
 });
});
