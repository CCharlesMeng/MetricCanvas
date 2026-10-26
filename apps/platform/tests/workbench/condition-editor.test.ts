import {expect,it} from 'vitest';
import type {Condition} from '@metriccanvas/page/internal';
import {basicConditionSelection,basicFilterCondition,conditionSummary,filterConditionChoices,presentationLabel} from '../../src/lib/workbench/condition-editor';
import {createCanvasAuthoringDraft} from '../../src/lib/workbench/document-edit';
import {editProperty,presentationControls,propertyControls} from '../../src/lib/workbench/property-edit';
import scenario from '../../../../pages/platform/platform-canvas-experience.json';
import auditScenario from '../../../../pages/platform/platform-interaction-audit.json';

const filters=[{id:'region',label:'区域',type:'dimension'},{id:'month',label:'月份',type:'timePoint'},{id:'period',label:'时间范围',type:'timeRange'}];

it('keeps table JSON properties independent and labels current column presentation targets',()=>{
  const parsed=createCanvasAuthoringDraft(auditScenario);
  if(!parsed.ok)throw Error(parsed.message);
  const locator={sectionId:'bottom',componentId:'audit-table'};
  const controls=propertyControls(parsed.draft,locator);
  expect(controls.find(control=>control.target.kind==='table-pinned')?.kind).toBe('json');
  expect(presentationLabel(parsed.draft.canvasDocument,{kind:'tableColumn',id:'audit-table',indices:[0]})).toBe('区域 · 表格列');
  const control=controls.find(control=>control.target.kind==='presentation'&&control.target.target.kind==='tableColumn');
  if(!control)throw Error('missing column presentation control');
  const updated=editProperty(parsed.draft,locator,{...control.target,value:{filter:'region',part:'values',op:'isNotEmpty'}});
  expect(updated.ok).toBe(true);
  if(updated.ok)expect(propertyControls(updated.draft,locator).find(item=>item.id===control.id)?.value).toEqual({filter:'region',part:'values',op:'isNotEmpty'});
  expect(parsed.draft.pageDocument.dataSources).toEqual(auditScenario.dataSources);
});

it('builds selection rules with collection and scalar empty semantics, independent of JSON key order',()=>{
  const choices=filterConditionChoices(filters);
  expect(choices.map(choice=>choice.label)).toEqual(['区域','月份','时间范围 · 开始','时间范围 · 结束']);
  expect(basicFilterCondition(choices[0],true)).toEqual({filter:'region',part:'values',op:'isNotEmpty'});
  expect(basicFilterCondition(choices[1],false)).toEqual({filter:'month',part:'value',op:'isNull'});
  expect(basicConditionSelection({op:'isEmpty',part:'values',filter:'region'},choices)).toEqual({choice:'region:values',selected:false});
  expect(basicConditionSelection({filter:'region',part:'values',op:'containsAny',values:['华东']},choices)).toBeNull();
  expect(basicConditionSelection({permission:'existing-view'},choices)).toBeNull();
  expect(basicConditionSelection({filter:'deleted',part:'value',op:'isNull'},choices)).toBeNull();
});

it('summarizes complete existing conditions without discarding nested rules or typed values',()=>{
  const condition:Condition={all:[{filter:'region',part:'values',op:'containsAny',values:['华东','华北']},
    {not:{any:[{fact:'amount',op:'gte',value:0},{row:'enabled',op:'eq',value:false}]}},{permission:'report-view'}]};
  const before=structuredClone(condition);
  expect(conditionSummary(condition,filters)).toBe('（区域 包含任一 华东、华北） 且 （不满足（（页面事实「amount」 大于等于 0） 或 （当前行「enabled」 等于 false））） 且 （已有权限「report-view」允许）');
  expect(conditionSummary({filter:'period',part:'from',op:'isNotNull'},filters)).toBe('时间范围 · 开始 已填写');
  expect(condition).toEqual(before);
});

it('uses business labels and validates condition updates atomically through the existing page operation',()=>{
  const parsed=createCanvasAuthoringDraft(scenario);
  if(!parsed.ok)throw Error(parsed.message);
  const draft=parsed.draft,before=structuredClone(draft);
  expect(presentationLabel(draft.canvasDocument,{kind:'component',id:'first'})).toBe('经营概况 · 文本');
  const control=presentationControls(draft).find(item=>item.target.kind==='presentation'&&item.target.target.id==='first');
  if(!control)throw Error('missing condition control');
  const updated=editProperty(draft,{sectionId:'overview',componentId:'first'},{...control.target,value:{permission:'existing-view'}});
  expect(updated.ok).toBe(true);
  if(!updated.ok)return;
  expect(presentationControls(updated.draft).find(item=>item.id===control.id)?.value).toEqual({permission:'existing-view'});
  expect(editProperty(updated.draft,{sectionId:'overview',componentId:'first'},{...control.target,value:{filter:'missing',part:'values',op:'isEmpty'}}).ok).toBe(false);
  const cleared=editProperty(updated.draft,{sectionId:'overview',componentId:'first'},{...control.target,value:undefined});
  expect(cleared.ok).toBe(true);
  if(cleared.ok)expect(presentationControls(cleared.draft).find(item=>item.id===control.id)?.value).toBeUndefined();
  expect(draft).toEqual(before);
});
