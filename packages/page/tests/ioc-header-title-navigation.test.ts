import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { declaredNavigationTargets } from '../src/navigate';
import { capabilityFloorErrors } from '../src/version';
import { compilePresentation } from '../../engine/runtime/src/presentation';
import { resolvedIocHeader } from '../../engine/runtime-ui/src/ioc-header/model';

const source=()=>JSON.parse(readFileSync('pages/capabilities/ioc-header/section-component/ioc-header-title-link.json','utf8'));
const identity=(doc:ReturnType<typeof source>)=>doc.sections[0].components[0].props.identity;
const errors=(doc:unknown)=>{const parsed=parsePage(doc);return parsed.ok?[]:parsed.errors;};
const at='/sections/0/components/0/props/identity/titleNavigate';

describe('IOC header title navigation',()=>{
 it('reads the approved field and preserves the source and dynamic title declaration',()=>{
  const doc=source(),before=JSON.stringify(doc),parsed=parsePage(doc);
  expect(parsed.errors).toEqual([]);expect(JSON.stringify(doc)).toBe(before);
  if(!parsed.ok)throw Error('source must parse');
  expect(declaredNavigationTargets(parsed.page)).toContainEqual(identity(doc).titleNavigate);
  expect(resolvedIocHeader(doc.sections[0].components[0].props).titleNavigate).toEqual(identity(doc).titleNavigate);
  identity(doc).title={param:'project'};
  expect(parsePage(doc).ok).toBe(true);
 });
 it('keeps existing plain titles and accepts the current legacy root envelope',()=>{
  const doc=source();delete identity(doc).titleNavigate;delete doc.params;
  expect(errors(doc)).toEqual([]);
  const root=source();root.iocHeader=root.sections[0].components.shift().props;
  expect(errors(root)).toEqual([]);
 });
 it.each(['6.114','5.4'])('requires the new capability in %s',version=>{
  const doc=source();doc.schemaVersion=version;
  expect(capabilityFloorErrors(doc)).toContainEqual(expect.objectContaining({path:at}));
  expect(parsePage(doc).ok).toBe(false);
 });
 it.each(['javascript:alert(1)','data:text/html,test',' https://example.com','https:example.com',''])('rejects unsafe or empty URLs: %s',href=>{
  const doc=source();identity(doc).titleNavigate.href=href;
  expect(errors(doc).some(error=>error.path.startsWith(at))).toBe(true);
 });
 it.each([
  [{source:'row',field:'project'},'/field'],
  [{source:'param',id:'missing'},'/id'],
  [{source:'filter',id:'missing'},'/id'],
  [{source:'filter',id:'reviewed',part:'from'},'/part']
 ])('validates source binding %j',(binding,suffix)=>{
  const doc=source();identity(doc).titleNavigate.query.key=binding;
  expect(errors(doc)).toContainEqual(expect.objectContaining({path:`${at}/query/key${suffix}`}));
 });
 it('requires a title and validates navigation conditions without row context',()=>{
  const doc=source();delete identity(doc).title;
  expect(errors(doc)).toContainEqual(expect.objectContaining({path:at}));
  const bad=source();identity(bad).titleNavigate.enabledWhen={filter:'missing',part:'value',op:'eq',value:true};
  expect(errors(bad).some(error=>error.path.startsWith(at+'/enabledWhen'))).toBe(true);
  identity(bad).titleNavigate.enabledWhen={row:'project',op:'eq',value:'P001'};
  expect(errors(bad).some(error=>error.path.startsWith(at+'/enabledWhen'))).toBe(true);
 });
 it('uses the same conditional eligibility and enabled gates as table navigation',()=>{
  const doc=source(),parsed=parsePage(doc);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const filters=new Map([['show-link',{type:'boolean' as const,value:false}],['allow-navigation',{type:'boolean' as const,value:false}]]);
  const compiled=compilePresentation(parsed.page);
  expect(compiled.evaluate({filters}).gate(identity(doc).titleNavigate)).toMatchObject({eligible:false,enabled:false});
  filters.set('show-link',{type:'boolean',value:true});
  expect(compiled.evaluate({filters}).gate(identity(doc).titleNavigate)).toMatchObject({eligible:true,enabled:false});
 });
});
