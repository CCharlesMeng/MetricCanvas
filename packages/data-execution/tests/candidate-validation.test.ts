import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createCandidateValidator} from '../src/candidate-validation';
import {initialFilterValues} from '../src/filter-values';
import type {RuntimeDataGateway} from '../src/ports';
const gateway:RuntimeDataGateway={async fetchData(){throw Error('candidate trust must not execute a query');}};
function load(id:string){const parsed=parsePage(JSON.parse(readFileSync(`pages/${id}.json`,'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
it('optional empty single choices preserve initial rows; selected dynamic values require a receipt',()=>{
 const page=load('ioc-project-overview'),values=new Map(initialFilterValues(page.filters??[]));
 const validator=createCandidateValidator(page,gateway);expect(validator.trusted('kpi-summary',values)).toBe(true);
 values.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['unverified']});expect(validator.trusted('kpi-summary',values)).toBe(false);
});
it('explicit independent candidate context blocks initial reuse even before a selection',()=>{
 const page=load('ioc-header-unconfigured'),validator=createCandidateValidator(page,gateway);
 expect(validator.trusted('request',initialFilterValues(page.filters??[]))).toBe(false);
});
