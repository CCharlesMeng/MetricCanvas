import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createCanvasAuthoringDraft, moveComponent, deleteComponent, editComponent } from '../../src/lib/workbench/document-edit';
import { editProperty, propertyControls } from '../../src/lib/workbench/property-edit';

const locator={sectionId:'equation',componentId:'product-card'};
function setup(){
  const result=createCanvasAuthoringDraft(JSON.parse(readFileSync('pages/capabilities/layout/metric-card-equation.json','utf8')));
  if(!result.ok)throw new Error(result.message);return result.draft;
}
function components(document:Record<string,unknown>){
  return (document.sections as {id:string;components:{id:string;layout:{span:number;before?:{text:string;gap?:number}}}[]}[]).find(s=>s.id==='equation')!.components;
}
it('布局入口修改前置文字和间距，保存重开保留，数据源不变',()=>{
  const draft=setup();expect(propertyControls(draft,locator).find(c=>c.id==='metric-before-gap')?.value).toBe(8);
  const edit=editProperty(draft,locator,{kind:'metric-before',field:'gap',value:'12'});
  expect(edit.ok).toBe(true);if(!edit.ok)return;
  expect(components(edit.draft.pageDocument)[1].layout.before).toEqual({text:'=',gap:12});
  expect(edit.draft.pageDocument.dataSources).toEqual(draft.pageDocument.dataSources);
  const reopened=createCanvasAuthoringDraft(edit.draft.pageDocument);expect(reopened.ok).toBe(true);if(!reopened.ok)return;
  expect(propertyControls(reopened.draft,locator).find(c=>c.id==='metric-before-gap')?.value).toBe(12);
  expect(editProperty(draft,locator,{kind:'metric-before',field:'gap',value:7}).ok).toBe(false);
  const removed=editProperty(edit.draft,locator,{kind:'metric-before',field:'text',value:''});
  expect(removed.ok).toBe(true);if(removed.ok)expect(components(removed.draft.pageDocument)[1].layout).not.toHaveProperty('before');
});
it('移动后只清理失效相邻边，保留原草稿供撤销',()=>{
  const draft=setup(), original=structuredClone(draft);
  const moved=moveComponent(draft,locator,{sectionId:'equation',index:3});
  expect(moved.ok).toBe(true);if(!moved.ok)return;
  expect(components(moved.draft.pageDocument).map(c=>c.id)).toEqual(['total-card','service-card','product-card','other-card']);
  expect(components(moved.draft.pageDocument).every(c=>!c.layout.before)).toBe(true);
  expect(draft).toEqual(original);
});
it('删除只清理后一项断开的前缀，其他连接保留，非法跨度原子拒绝',()=>{
  const draft=setup();const result=deleteComponent(draft,locator);
  expect(result.ok).toBe(true);if(!result.ok)return;
  expect(components(result.draft.pageDocument).map(c=>c.layout.before?.text)).toEqual([undefined,undefined,'+']);
  expect(editComponent(draft,locator,{span:4}).ok).toBe(false);
});
