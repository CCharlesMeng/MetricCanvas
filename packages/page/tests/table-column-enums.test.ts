import {expect,it} from 'vitest';
import document from '../../../pages/capabilities/table/table-column-enums.json';
import {parsePage} from '../src/validate';

it('accepts front-end enum metadata and rejects use before its capability version',()=>{
  expect(parsePage(document).ok).toBe(true);
  expect(parsePage({...document,schemaVersion:'6.77'}).ok).toBe(false);
});
it('rejects empty, duplicate and malformed enum declarations without changing input',()=>{
  const raw=structuredClone(document),before=structuredClone(raw);
  const column=raw.sections[0].components[0].props.columns[1];
  column.enumValues=[{value:'0',label:'甲'},{value:'0',label:'乙'}];
  const duplicate=parsePage(raw);
  expect(duplicate).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({path:'/sections/0/components/0/props/columns/1/enumValues'})])});
  column.enumValues=[];
  expect(parsePage(raw).ok).toBe(false);
  column.enumValues=[{value:'0',label:''}];
  expect(parsePage(raw).ok).toBe(false);
  expect(document).toEqual(before);
});
