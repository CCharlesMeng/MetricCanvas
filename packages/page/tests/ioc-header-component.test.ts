import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage,normalizePageDocument} from '../src/validate';
import {upgradePageDocument} from '../src/upgrade-document';
import {resolveHeaderBinding,usesIocRegion} from '../src/header-binding';
import {capabilityFloorErrors} from '../src/version';
import {documentUsesRuntimeBackToolbar} from '../src/page';
import {compilePresentation} from '../../engine/runtime/src/presentation';
import {resolvePageHeader,pageFiltersReadOnly} from '../../engine/runtime-ui/src/ioc-header/page-header';
import {compatibilityHeaderSection} from '../../engine/runtime-ui/src/ioc-header/render-plan';
import {visibleSections} from '../../engine/runtime-ui/src/section-navigation';

const load=(id='placement')=>JSON.parse(readFileSync(`pages/capabilities/ioc-header/section-component/ioc-header-section-${id}.json`,'utf8'));
function page(document=load()){
 const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;
}
function errors(document:unknown){const parsed=parsePage(document);return parsed.ok?[]:parsed.errors;}

describe('section IOC Header contract and page semantics',()=>{
 it('retains normal component structure and source document without synthesizing a second Header',()=>{
  const doc=load(),before=JSON.stringify(doc),parsed=page(doc);
  expect(resolveHeaderBinding(parsed)).toMatchObject({source:'component',path:'/sections/0/components/0/props'});
  expect(compatibilityHeaderSection(parsed)).toBeUndefined();expect(normalizePageDocument(doc).ok).toBe(true);
  expect(JSON.stringify(doc)).toBe(before);expect(documentUsesRuntimeBackToolbar(doc)).toBe(true);
 });
 it('keeps Header full width in a weighted section and still constrains ordinary component spans',()=>{
  const document=load();expect(parsePage(document).ok).toBe(true);
  document.sections[0].components[1].layout.span=4;
  expect(errors(document)).toContainEqual(expect.objectContaining({path:'/sections/0/components/1/layout/span'}));
 });
 it.each(['6.80','6.36','5.0','5.4'])('rejects hand-written new syntax in %s',version=>{
  const doc=load();doc.schemaVersion=version;
  expect(capabilityFloorErrors(doc)).toContainEqual(expect.objectContaining({path:'/sections/0/components/0'}));
  expect(parsePage(doc).ok).toBe(false);
 });
 it('rejects nonfirst, duplicate, partial-width, background, empty and mixed declarations',()=>{
  const wrong=load();wrong.sections[0].components.reverse();expect(errors(wrong)).toContainEqual(expect.objectContaining({path:'/sections/0/components/1'}));
  const duplicate=load();duplicate.sections[1].components.push({...duplicate.sections[0].components[0],id:'second-header'});expect(errors(duplicate).some(error=>error.message.includes('最多'))).toBe(true);
  const partial=load();partial.sections[0].components[0].layout.span=6;expect(errors(partial).some(error=>error.path.endsWith('/layout'))).toBe(true);
  const mixed=load();mixed.dashboardToolbar='hidden';expect(errors(mixed).some(error=>error.message.includes('混写'))).toBe(true);
  const empty=load();empty.sections[0].components[0].props={};expect(errors(empty)).toContainEqual(expect.objectContaining({path:'/sections/0/components/0/props'}));
 });
 it('preserves ownership, IOC mode and readonly while parent condition hides Header',()=>{
  const doc=load();doc.sections[0].components[0].props.readOnly=true;const parsed=page(doc);
  const filters=new Map([['show-header',{type:'boolean' as const,value:false}]]);
  const presentation=compilePresentation(parsed).evaluate({filters});
  expect(presentation.sections.map(section=>section.id)).toEqual(['persistent']);
  expect(usesIocRegion(parsed)).toBe(true);expect(pageFiltersReadOnly(parsed)).toBe(true);
  expect(resolvePageHeader(parsed,presentation.filters).content.map(filter=>filter.id)).not.toContain('team');
 });
 it('lets a grouped Header disappear without deleting the page navigation or declared state',()=>{
  const parsed=page(load('groups'));
  expect(visibleSections(parsed,'details').map(section=>section.id)).toEqual(['persistent']);
  expect(usesIocRegion(parsed)).toBe(true);expect(documentUsesRuntimeBackToolbar(parsed)).toBe(true);
 });
 it('resolves an optional title at the component path',()=>{
  const doc=load();doc.params={display:[{id:'title',type:'string',required:false}]};doc.sections[0].components[0].props.identity.title={param:'title'};
  const component=page(doc).sections[0].components[0];expect(component.type==='iocHeader'&&component.props.identity?.title).toBe('未命名');
 });
 it('does not generate a new-version default Header, while old defaults remain readable',()=>{
  const doc=load();doc.sections[0].components.shift();
  expect(resolvePageHeader(page(doc),[]).model).toBeUndefined();expect(documentUsesRuntimeBackToolbar(doc)).toBe(false);
  doc.schemaVersion='6.80';const old=page(doc);
  expect(resolvePageHeader(old,[]).model?.legacyBack).toBe(true);expect(usesIocRegion(old)).toBe(false);
  expect(compatibilityHeaderSection(old)).toBeDefined();expect(compatibilityHeaderSection(old,true)).toBeUndefined();
 });
 it('migrates root IOC into a stable always-visible section with idempotence and no input mutation',()=>{
  const doc=load(),header=doc.sections[0].components.shift();doc.schemaVersion='6.80';doc.iocHeader=header.props;
  const before=JSON.stringify(doc),upgraded=upgradePageDocument(doc);
  expect(upgraded.ok).toBe(true);if(!upgraded.ok)return;
  expect(upgraded.document.iocHeader).toBeUndefined();expect(upgraded.document.sections[0].visibleWhen).toBeUndefined();
  expect(upgraded.document.sections[1].visibleWhen).toEqual(doc.sections[0].visibleWhen);
  expect(upgradePageDocument(upgraded.document)).toMatchObject({ok:true,changed:false});expect(JSON.stringify(doc)).toBe(before);
  expect(compatibilityHeaderSection(page(doc),true)).toBeDefined();
 });
 it('blocks legacy toolbars instead of silently enabling IOC Region or adding export content',()=>{
  const doc=load();doc.sections[0].components.shift();doc.schemaVersion='6.80';doc.dashboardToolbar='visible';
  expect(usesIocRegion(page(doc))).toBe(false);expect(upgradePageDocument(doc)).toMatchObject({ok:false,errors:[{path:'/dashboardToolbar'}]});
 });
 it('validates Report period ownership through component props',()=>{
  const doc=load();doc.layout='report';doc.filters=[{id:'period',type:'timeRange',display:'period',precision:'month',required:true,default:{mode:'month'}}];
  delete doc.sections[0].visibleWhen;doc.sections[0].components[0].props={identity:{title:'期间'},filterIds:['period']};
  expect(parsePage(doc).ok).toBe(true);
 });
});
