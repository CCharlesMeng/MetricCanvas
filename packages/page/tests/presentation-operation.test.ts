import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {applyPresentationOperation} from '../src/presentation-operation';
import {presentationTargets} from '../src/presentation-edit';
const input=()=>JSON.parse(readFileSync(new URL('../../../pages/page-visibility-region-linkage.json',import.meta.url),'utf8'));
it('edits hidden nodes by stable identity and preserves unrelated source data',()=>{
 const page=input();const before=structuredClone(page);
 const result=applyPresentationOperation(page,{type:'set_presentation_condition',target:{kind:'section',id:'department-norms'},field:'visibleWhen',condition:{permission:'read'}});
 expect(result.ok).toBe(true);expect(page).toEqual(before);
 expect(result.document?.dataSources).toEqual(before.dataSources);
 expect(presentationTargets(result.document).some(item=>item.target.id==='conditional-child')).toBe(true);
});
it('rejects invalid context and ambiguous targets without returning a changed document',()=>{
 const result=applyPresentationOperation(input(),{type:'set_presentation_condition',target:{kind:'section',id:'department-norms'},field:'visibleWhen',condition:{row:'kind',op:'eq',value:'department'}});
 expect(result.ok).toBe(false);expect(result.document).toBeUndefined();
});
it('creates a button and conditional text through the product edit implementation',()=>{
 const button=applyPresentationOperation(input(),{type:'add_button',sectionId:'controls',componentId:'new-button',label:'返回基础',action:{on:'click',writeFilter:'mode',value:'base'}});
 expect(button.ok).toBe(true);
 const text=applyPresentationOperation(button.document,{type:'set_text_parts',componentId:'explanation',parts:[{id:'only',text:'地区部',visibleWhen:{filter:'organization',part:'level',op:'eq',value:'department'}}]});
 expect(text.ok).toBe(true);
});
