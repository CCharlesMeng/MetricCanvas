import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {validate} from '../src/validate';

const fixture=()=>JSON.parse(readFileSync(new URL('../fixtures/contract-valid/missing-organization-key.json',import.meta.url),'utf8'));

describe('空组织键兼容保持现有 Schema',()=>{
  it.each(['6.74','6.77'])('已有版本 %s 无需新增声明',schemaVersion=>{
    expect(validate({...fixture(),schemaVersion})).toEqual([]);
  });
  it('不引入 onMissingKey 页面开关',()=>{
    const page=fixture();
    expect(JSON.stringify(page)).not.toContain('onMissingKey');
    page.dataSources.combined.compute[0].onMissingKey='skip';
    expect(validate(page).some(error=>error.path.includes('/onMissingKey'))).toBe(true);
  });
});
