import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {capabilityFloorErrors,requiredMinorVersion} from '../src/version';
const load=()=>JSON.parse(readFileSync('packages/page/fixtures/contract-valid/ioc-auto-back-page.json','utf8'));
it('reads auto return at its capability floor and rejects older declarations',()=>{
 const doc=load();expect(parsePage(doc).ok).toBe(true);expect(requiredMinorVersion(doc)).toBe(96);
 doc.schemaVersion='6.95';expect(capabilityFloorErrors(doc)).toContainEqual(expect.objectContaining({path:'/sections/0/components/0/props/back'}));
 expect(parsePage(doc).ok).toBe(false);
});
it('retains true and omission, rejects arbitrary return mode values',()=>{
 for(const value of [true,undefined]){const doc=load();doc.sections[0].components[0].props.back=value;expect(parsePage(doc).ok).toBe(true);}
 for(const value of ['history',{},1]){const doc=load();doc.sections[0].components[0].props.back=value;expect(parsePage(doc).ok).toBe(false);}
});

it('accepts explicit false only at its capability floor',()=>{
 const doc=load();doc.schemaVersion='6.111';doc.sections[0].components[0].props.back=false;
 expect(parsePage(doc).ok).toBe(true);expect(requiredMinorVersion(doc)).toBe(111);
 doc.schemaVersion='6.109';expect(parsePage(doc).ok).toBe(false);
 expect(capabilityFloorErrors(doc)).toContainEqual(expect.objectContaining({path:'/sections/0/components/0/props/back'}));
});
