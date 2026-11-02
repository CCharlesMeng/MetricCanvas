import { flattenPageComponents, resolveHeaderBinding, type Page, type PageSection } from '@metriccanvas/page/internal';

/** Internal only: never serialize this compatibility section into an old revision. */
export function compatibilityHeaderSection(page:Page,staticView=false):PageSection|undefined {
  const binding=resolveHeaderBinding(page);
  if(!binding || binding.source==='component')return undefined;
  if(binding.source!=='legacy-root'&&(staticView||page.layout!=='dashboard'))return undefined;
  const ids=new Set([...page.sections.map(section=>section.id),...flattenPageComponents(page).map(component=>component.id)]);
  const id=availableId(ids,'mc-legacy-header');ids.add(id);
  return {id,container:'plain',components:[{id:availableId(ids,'mc-legacy-header-content'),type:'iocHeader',layout:{span:12},props:binding.props}]};
}
function availableId(ids:ReadonlySet<string>,base:string):string {
  let candidate=base,index=1;
  while(ids.has(candidate))candidate=`${base}-${index++}`;
  return candidate;
}
export function leadingHeaderSectionId(page:Page):string|undefined {
  return page.sections[0]?.components[0]?.type==='iocHeader'?page.sections[0].id:undefined;
}
