import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/internal';
import { migrateURLNavigation } from '../../../tools/scripts/migrate-url-navigation';
const source = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/params-page.json',import.meta.url),'utf8'));
it('拒绝旧导航结构与旧协议，而不是静默解析', () => {
  const doc = source(); doc.schemaVersion = '5.4';
  expect(parsePage(doc).ok).toBe(false);
});
describe('源侧导航校验', () => {
  it('合法外部 URL 不要求目标在本仓', () => {
    const doc = source();
    doc.sections.push({id:'external',components:[{id:'external-link',type:'text',layout:{span:12},props:{links:[{label:'外部',href:'https://external.example/detail'}]}}]});
    expect(parsePage(doc).errors).toEqual([]);
  });
  it.each([
    [{source:'row',field:'missing'},'/field'],
    [{source:'param',id:'missing'},'/id'],
    [{source:'filter',id:'missing'},'/id']
  ])('文本链接校验来源 %j', (binding,suffix) => {
    const doc = source();
    doc.sections.push({id:'external',components:[{id:'external-link',type:'text',layout:{span:12},props:{links:[{label:'详情',href:'/detail',query:{code:binding}}]}}]});
    const result = parsePage(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e=>e.path.endsWith('/query/code'+suffix))).toBe(true);
  });
  it('页面参数仅被导航消费也合法，且不会被文本物化替换', () => {
    const doc = {schemaVersion:'6.0',id:'link-page',params:[{id:'code',type:'string',required:true}],dataSources:{},sections:[{id:'main',components:[{id:'link',type:'text',layout:{span:12},props:{links:[{label:'详情',href:'/detail',query:{code:{source:'param',id:'code'}}}]}}]}]};
    const result = parsePage(doc);
    expect(result.errors).toEqual([]);
    if(result.ok) expect(result.page.sections[0]?.components[0]?.props).toEqual(doc.sections[0]!.components[0]!.props);
  });
});
it('迁移需要显式部署地址，保留原文档，产出新版本', () => {
  const old = {schemaVersion:'5.4',id:'source',dataSources:{},sections:[{id:'main',components:[{id:'text',type:'text',layout:{span:12},props:{links:[{label:'目标',page:'target'}]}}]}]};
  expect(()=>migrateURLNavigation(old,{})).toThrow('部署 URL 映射');
  const next = migrateURLNavigation(old,{target:'../target.html'});
  expect(next.schemaVersion).toBe('6.0');
  expect(next.sections[0].components[0].props.links).toEqual([{label:'目标',href:'../target.html'}]);
  expect(old.schemaVersion).toBe('5.4');
});
