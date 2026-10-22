import {fieldSelectionIds,projectFieldSelections} from './field-selection';
import {querySelectors,selectionAssignments,projectQueries} from './query-selection';
import type {Page} from './page';

/** Query and field selections sharing a filter must use the same value in validation. */
export function* pageSelectionVariants(page:Page):Generator<Page> {
  const selectors=querySelectors(page);
  for(const id of fieldSelectionIds(page)){
    if(selectors.has(id))continue;
    const filter=page.filters?.find(filter=>filter.id===id);
    if(filter?.type!=='dimension'||!filter.options)throw new Error('字段选择控制器不存在');
    selectors.set(id,filter.options.filter(option=>!option.disabled).map(option=>({type:'dimension',values:[option.value]})));
  }
  if(!selectors.size){yield page;return;}
  for(const values of selectionAssignments(selectors))yield projectQueries(projectFieldSelections(page,values),values);
}
