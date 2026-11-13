import {hasQueryFieldMapping,type FieldDefinition} from '@metriccanvas/page/internal';
import type {PagedJoinPlan} from './plan';

/** Only the domain may select pages; other-member conditions require the complete joined population. */
export function autoPageEligible(plan:PagedJoinPlan):boolean{
  const source=plan.source.source,records=source.records;
  if(!records||!source.members[source.domainMember].canSelectPage)return false;
  if(records.maxRows!==undefined||Object.keys(records.timeFilters??{}).length)return false;
  if(plan.view.sort.length!==1)return false;
  // Upstream has no verified nulls-last or multi-column metric ordering contract.
  if(domainField(plan,plan.view.sort[0].field)?.nullable!==false)return false;
  if(plan.view.predicates.some(rule=>rule.op==='isNull'||!domainField(plan,rule.field)))return false;
  const search=plan.view.search;
  if(search?.query.trim()&&(search.match!=='equals'||search.fields.length!==1||!domainField(plan,search.fields[0])))return false;
  return true;
}

function domainField(plan:PagedJoinPlan,field:string):FieldDefinition|undefined{
  const projection=plan.source.source.projection[field];
  if(projection?.member!==plan.source.source.domainMember)return;
  const raw=plan.members.get(projection.member)?.fields[projection.field];
  return raw&&hasQueryFieldMapping(raw)?raw:undefined;
}
