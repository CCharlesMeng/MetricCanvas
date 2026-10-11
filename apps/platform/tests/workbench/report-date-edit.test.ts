import { expect, it } from 'vitest';
import fixture from '../../../../packages/page/fixtures/contract-valid/report-date-filters-page.json';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { editReportDate } from '../../src/lib/workbench/report-date-edit';
function draft() { const result=createCanvasAuthoringDraft(fixture);if(!result.ok)throw Error(result.message);return result.draft; }
const locator={sectionId:'header',componentId:'page-header'};
it('updates date bindings and placement atomically, then removes all owned references',()=>{
  const before=draft();const original=structuredClone(before);
  const edited=editReportDate(before,locator,{filterId:'period-filter',declaration:{id:'period-filter',type:'timePoint',granularity:'month',required:true,default:'2026-04'},bindings:[{dataSourceId:'sales',binding:{target:'time',window:{kind:'yearToDate'}}}]});
  expect(before).toEqual(original);if(!edited.ok)throw Error(edited.message);expect(edited.ok).toBe(true);
  expect(edited.draft.pageDocument.filters).toMatchObject([{type:'timePoint',default:'2026-04'}]);
  const removed=editReportDate(edited.draft,locator,{filterId:'period-filter',remove:true});
  expect(removed.ok).toBe(true);if(!removed.ok)throw Error(removed.message);
  expect(JSON.stringify(removed.draft.pageDocument)).not.toContain('period-filter');
});
it('invalid range configuration preserves the entire canvas draft',()=>{
  const before=draft();const original=structuredClone(before);
  const result=editReportDate(before,locator,{filterId:'period-filter',declaration:{id:'period-filter',type:'timeRange',precision:'month',required:true,default:{from:'2026-09',to:'2026-04'}},bindings:[{dataSourceId:'sales',binding:{target:'time'}}]});
  expect(result.ok).toBe(false);expect(before).toEqual(original);
});
