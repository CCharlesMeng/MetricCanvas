import type { IocHeaderComponent, Page } from './page';
import type { IocHeaderDeclaration } from './schema/ioc-header';
import { walkDocumentComponents } from './component-walk';
import {iocHeaderFilterIds} from './ioc-header-controls';

type ObjectValue = Record<string, unknown>;
function object(value:unknown):ObjectValue|undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : undefined;
}

/** Raw read for hosts and text/version validation; independent of presentation eligibility. */
export function documentIocHeader(document:unknown):ObjectValue|undefined {
  const page=object(document);
  const root=object(page?.iocHeader);
  if(root)return root;
  const sections=page?.sections;
  if(!Array.isArray(sections))return undefined;
  const components=object(sections[0])?.components;
  if(!Array.isArray(components))return undefined;
  const first=object(components[0]);
  return first?.type==='iocHeader'?object(first.props):undefined;
}

export function headerDeclarations(document:unknown):Array<{props:ObjectValue;path:string}> {
  const headers:Array<{props:ObjectValue;path:string}>=[];
  const root=object(object(document)?.iocHeader);
  if(root)headers.push({props:root,path:'/iocHeader'});
  walkDocumentComponents(document,(component,path)=>{
    const props=object(component.props);
    if(component.type==='iocHeader'&&props)headers.push({props,path:path+'/props'});
  });
  return headers;
}

/** New documents have no implicit toolbar. Explicit legacy declarations remain readable. */
export function hasLegacyDefaultHeader(document:unknown):boolean {
  const version=object(document)?.schemaVersion;
  if(typeof version!=='string')return true;
  const [major,minor]=version.split('.').map(Number);
  return major===5 || major===6&&minor<81;
}

export interface HeaderBinding {
  source:'component'|'legacy-root'|'legacy-toolbar'|'legacy-default';
  props:IocHeaderDeclaration;
  path:string;
  component?:IocHeaderComponent;
}

export function resolveHeaderBinding(page:Page):HeaderBinding|undefined {
  if(page.iocHeader)return {source:'legacy-root',props:page.iocHeader,path:'/iocHeader'};
  const component=page.sections[0]?.components[0];
  if(component?.type==='iocHeader')return {source:'component',props:component.props,path:'/sections/0/components/0/props',component};
  const toolbar=page.dashboardToolbar;
  if(toolbar==='hidden')return undefined;
  if(toolbar===undefined&&!hasLegacyDefaultHeader(page))return undefined;
  // Preserve page-level legacy attributes even on Report, which has no toolbar view.
  const props=typeof toolbar==='object'?{readOnly:toolbar.readOnly,note:toolbar.note}:{};
  return {source:toolbar===undefined?'legacy-default':'legacy-toolbar',props,path:'/dashboardToolbar'};
}

export function usesIocRegion(page:Page):boolean {
  return documentIocHeader(page)!==undefined;
}

export function iocHeaderDeclaration(page:Page):IocHeaderDeclaration|undefined {
  const header=documentIocHeader(page) as IocHeaderDeclaration|undefined;
  return header?{...header,filterIds:iocHeaderFilterIds(header)}:undefined;
}

/** Immutable property update; original documents and other component identities are retained. */
export function mapIocHeader(page:Page, map:(header:IocHeaderDeclaration)=>IocHeaderDeclaration):Page {
  const binding=resolveHeaderBinding(page);
  if(binding?.source==='legacy-root')return {...page,iocHeader:map(binding.props)};
  if(binding?.source!=='component')return page;
  return {...page,sections:page.sections.map((section,index)=>index===0?{...section,components:section.components.map(component=>component===binding.component?{...binding.component,props:map(binding.props)}:component)}:section)};
}
