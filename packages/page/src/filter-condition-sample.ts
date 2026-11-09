import type {FilterDeclaration} from './filter';
import type {Condition} from './schema/condition';
import type {ConditionValue} from './condition';

/** The declared input type is shared by display and query-condition validation. */
export function declaredFilterSample(f:FilterDeclaration,part:Extract<Condition,{filter:string}>['part']):ConditionValue|undefined {
  if(part==='mode')return f.type==='timeRange' && f.display==='period' ? '' : undefined;
  if(part==='level')return f.type==='dimension' && f.hierarchy ? '' : undefined;
  if(part==='values')return f.type==='dimension' ? [''] : undefined;
  if(part==='from'||part==='to')return rangeFilterSample(f);
  if(f.type==='boolean')return false;
  return f.type==='timePoint'||f.type==='search' ? '' : undefined;
}
function rangeFilterSample(f:FilterDeclaration):ConditionValue|undefined {
  if(f.type==='timeRange')return '';
  return f.type==='numberRange'?0:undefined;
}
