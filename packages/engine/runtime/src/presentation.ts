import { evaluateCondition, type ConditionContext, type ConditionResult, type Condition, type Component, type Page, type PageSection, type TableComponent, type Row, type PolicyNode } from '@metriccanvas/page/internal';
export interface PresentationGate { eligible: boolean; enabled: boolean; reason?: string }
const allowed:PresentationGate={eligible:true,enabled:true};
export function policyGate(node:PolicyNode,context:ConditionContext,parent:PresentationGate=allowed):PresentationGate {
  if(!parent.eligible)return parent;
  const visible=evaluateCondition(node.visibleWhen,context);
  const enabled=evaluateCondition(node.enabledWhen,context);
  return {eligible:visible.status==='allow',enabled:parent.enabled&&visible.status==='allow'&&enabled.status==='allow',reason:reason(visible)??reason(enabled)};
}
function interactionGate(node:PolicyNode,context:ConditionContext,parent?:PresentationGate):PresentationGate {
 const own=policyGate(node,context,parent);
 const action=node as PolicyNode & {navigate?:PolicyNode;openDetail?:PolicyNode};
 const nested=action.navigate??action.openDetail;
 return nested?policyGate(nested,context,own):own;
}
function reason(result:ConditionResult){return result.reason ?? (result.status==='deny'?'CONDITION_FALSE':undefined);}
/** Pure presentation projection. Original Page and source graph remain immutable. */
export function compilePresentation(page:Page) {
  return {
    evaluate(input:Omit<ConditionContext,'declarations'>) {
      const context:ConditionContext={...input,declarations:page.filters??[]};
      const components=new Map<string,PresentationGate>();
      const sections=new Map<string,PresentationGate>();
      const groups=new Map((page.sectionGroups??[]).map(group=>[group.id,policyGate(group,context)]));
      function component(node:Component,parent:PresentationGate):Component|undefined {
        const own=policyGate(node,context,parent);
        const gate=node.type==='button'?interactionGate(node.props.action,context,own):own;
        components.set(node.id,gate);
        if(!gate.eligible)return undefined;
        if(node.type==='tabContainer')return {...node,props:{...node.props,tabs:node.props.tabs.flatMap(tab=>{
          const tabGate=policyGate(tab,context,gate);if(!tabGate.eligible)return [];
          if('components' in tab)return [{...tab,components:tab.components.flatMap(child=>component(child,tabGate)??[]) as typeof tab.components}];
          const child=component(tab.component,tabGate);
          // Empty content is permitted in the render projection; the declared tab remains available.
          return [{...tab,components:child?[child as typeof tab.component]:[]}];
        })}};
        if(node.type==='compositeCard')return {...node,props:{...node.props,components:node.props.components.flatMap(child=>component(child,gate)??[]) as typeof node.props.components}};
        if(node.type==='table'&&node.props.toolbar){
          const toolbar=node.props.toolbar;
          return {...node,props:{...node.props,toolbar:{
            ...(toolbar.search&&policyGate(toolbar.search,context,gate).eligible?{search:toolbar.search}:{}),
            ...(toolbar.export&&policyGate(toolbar.export,context,gate).eligible?{export:toolbar.export}:{})
          }}};
        }
        if(node.type==='text'&&node.props.parts)return {...node,props:{...node.props,body:node.props.parts.filter(part=>policyGate(part,context,gate).eligible).map(part=>part.text).join('')}};
        return node;
      }
      const renderSections:PageSection[]=page.sections.flatMap(section=>{
        const group=page.sectionGroups?.find(group=>group.sectionIds.includes(section.id));
        const gate=policyGate(section,context,group?groups.get(group.id):allowed);sections.set(section.id,gate);
        return gate.eligible?[{...section,components:section.components.flatMap(child=>component(child,gate)??[])}]:[];
      });
      const filters=(page.filters??[]).filter(filter=>filter.visible!==false&&policyGate(filter,context).eligible);
      return {
        sections:renderSections, filters, groups, components, sectionGates:sections, context,
        gate(node:PolicyNode,row?:Row,parent?:PresentationGate){return interactionGate(node,{...context,row},parent);},
        component(id:string){return components.get(id)??{eligible:false,enabled:false};},
        rows(table:TableComponent,rows:readonly Row[]){return projectPresentationRows(table,rows,context);}
      };
    }
  };
}
export type Presentation = ReturnType<ReturnType<typeof compilePresentation>['evaluate']>;
export function projectPresentationRows(table:TableComponent,rows:readonly Row[],context:ConditionContext):Row[]{
  if(!table.props.rowVisibleWhen)return [...rows];
  return rows.filter(row=>evaluateCondition(table.props.rowVisibleWhen,{...context,row}).status==='allow');
}
