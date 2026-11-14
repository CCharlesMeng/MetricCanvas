import {filterURLKeys,usesIocRegion,type Page} from '@metriccanvas/page/internal';
import {filterInputIssue} from '../../runtime/src/navigation-inputs';

/** Strict URL errors are resolved before asynchronous default requests start. */
export function initialFilterInputIssue(page:Page,search:string,clock:Date):string|undefined {
  if(page.strictURLInputs!==true)return;
  const privateIds=new Set((page.detailViews??[]).flatMap(view=>view.filters??[])),query=new URLSearchParams(search);
  const privateInput=(page.filters??[]).some(filter=>privateIds.has(filter.id)&&Object.values(filterURLKeys(filter,usesIocRegion(page))).some(key=>query.has(key)));
  return privateInput?'详情私有筛选不能由页面URL写入':filterInputIssue(search,page.filters??[],clock,usesIocRegion(page));
}
