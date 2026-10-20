import type {UiTreeNode} from '@metriccanvas/ui';
import type {FilterCandidate} from '../../../runtime/src/ports';
/** Explicit identities: never derive hierarchy from business codes or labels. */
export function structuralTree(candidates:readonly FilterCandidate[],level:string):UiTreeNode[] {
  const key=(level:string|undefined,value:string)=>JSON.stringify([level??null,value]);
  const nodes=new Map(candidates.map(candidate=>[key(candidate.level,candidate.value),{key:key(candidate.level,candidate.value),label:candidate.label,disabled:candidate.disabled,...(candidate.level===level?{value:candidate.value}:{}),children:[]} as UiTreeNode]));
  const roots:UiTreeNode[]=[];
  for(const candidate of candidates){const node=nodes.get(key(candidate.level,candidate.value))!;const parent=candidate.parent&&nodes.get(key(candidate.parent.level,candidate.parent.value));if(parent)parent.children!.push(node);else roots.push(node);}
  return roots;
}
