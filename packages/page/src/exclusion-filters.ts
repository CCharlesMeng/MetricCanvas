import type {Page} from './page';
import type {FilterDeclaration} from './filter';
import {queryFilterIds} from './amount-filter';
import {queryLeaves,querySelection} from './query-selection';
import {supportsIndependentExclusionCandidates} from './version';

/** Only unambiguous dynamic exclusion predicates can ignore candidate membership. */
export function independentExclusionFilterIds(page:Page):Set<string> {
  if(!supportsIndependentExclusionCandidates(page.schemaVersion))return new Set();
  const uses=new Map<string,boolean>();
  for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    const query=source.source.query,selector=querySelection(query);
    if(selector)uses.set(selector.filterId,false);
    for(const leaf of queryLeaves(query))for(const id of queryFilterIds(leaf)){
      const binding=leaf.filterBindings?.[id];
      const exclusion=binding?.target==='dimension'&&binding.operator==='!=';
      uses.set(id,uses.get(id)!==false&&exclusion);
    }
  }
  return new Set((page.filters??[]).filter(filter=>retainsExclusion(filter)&&uses.get(filter.id)===true).map(filter=>filter.id));
}
function retainsExclusion(filter:FilterDeclaration):boolean {
  if(filter.type!=='dimension'||filter.selection?.required||filter.hierarchy||filter.display==='tree'||filter.options)return false;
  if(filter.clearOnChangeOf?.length||filter.candidateContext?.reconcile==='intersection')return false;
  return !!(filter.candidates||filter.candidateContext);
}
