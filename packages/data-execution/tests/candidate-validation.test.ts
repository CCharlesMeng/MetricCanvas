import { pageFilesById } from '../../../tools/scripts/page-files.mjs';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createCandidateValidator} from '../src/candidate-validation';
import {initialFilterValues} from '../src/filter-values';
import type {RuntimeDataGateway} from '../src/ports';
const gateway:RuntimeDataGateway={async fetchData(){throw Error('candidate trust must not execute a query');}};
function load(id:string){const parsed=parsePage(JSON.parse(readFileSync(pageFilesById('pages').get(`${id}`)!,'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
it('ordinary optional empty single choices preserve initial rows; selected values require a receipt',()=>{
 const raw=JSON.parse(readFileSync(pageFilesById('pages').get('ioc-project-overview')!,'utf8'));
 delete raw.iocHeader;
 // Ordinary hierarchy dimensions retain the legacy presentation and receipt rules.
 delete raw.filters.find((filter:any)=>filter.id==='region').treeSelection;
 const parsed=parsePage(raw);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
 const page=parsed.page,values=new Map(initialFilterValues(page.filters??[]));
 const validator=createCandidateValidator(page,gateway);expect(validator.trusted('kpi-summary',values)).toBe(true);
 values.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['unverified']});expect(validator.trusted('kpi-summary',values)).toBe(false);
});
it('IOC Region requires a complete candidate receipt even at the initial scope',()=>{
 const page=load('ioc-project-overview'),validator=createCandidateValidator(page,gateway);
 expect(validator.trusted('kpi-summary',initialFilterValues(page.filters??[]))).toBe(false);
});
it('explicit independent candidate context blocks initial reuse even before a selection',()=>{
 const page=load('ioc-header-unconfigured'),validator=createCandidateValidator(page,gateway);
 expect(validator.trusted('request',initialFilterValues(page.filters??[]))).toBe(false);
});
