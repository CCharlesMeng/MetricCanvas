import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
const original=JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-header-select-all.json',import.meta.url),'utf8'));
it('accepts true, false and omission without enum or allBehavior',()=>{
  expect(parsePage(original).errors).toEqual([]);
  expect(original.sections[0].components[1].props.columns[1]).toEqual({field:'status',title:'是否有效',filterable:{mode:'select',defaultValues:['是'],showSelectAll:true}});
  expect(JSON.stringify(original)).not.toContain('allBehavior');
});
it.each([true,false])('gates explicit %s at the new version',value=>{
  const page=structuredClone(original);page.schemaVersion='6.97';page.sections[0].components[0].props.columns[1].filterable.showSelectAll=value;
  expect(parsePage(page)).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('6.98')})])});
});
it.each(['yes',1,{},null])('rejects non-boolean %j',value=>{
  const page=structuredClone(original);page.sections[0].components[0].props.columns[1].filterable.showSelectAll=value;expect(parsePage(page).ok).toBe(false);
});
it('rejects a range control',()=>{
  const page=structuredClone(original);page.sections[0].components[0].props.columns[1].filterable={mode:'numberRange',showSelectAll:true};expect(parsePage(page).ok).toBe(false);
});
