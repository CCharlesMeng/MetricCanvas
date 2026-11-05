import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createCandidateValidator} from '../src/candidate-validation';
import {initialFilterValues} from '../src/filter-values';
import type {RuntimeDataGateway} from '../src/ports';
const gateway:RuntimeDataGateway={async fetchData(){throw Error('candidate trust must not execute a query');}};
const files={
 'ioc-project-overview':'pages/business/dashboard/ioc/project/ioc-project-overview.json',
 'ioc-header-unconfigured':'pages/capabilities/ioc-header/business/ioc-header-unconfigured.json'
};
function load(id:keyof typeof files){const parsed=parsePage(JSON.parse(readFileSync(files[id],'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
it('ordinary optional empty single choices preserve initial rows; selected values require a receipt',()=>{
 const raw=JSON.parse(readFileSync(files['ioc-project-overview'],'utf8'));
 delete raw.iocHeader;
 // Ordinary hierarchy dimensions retain the legacy presentation and receipt rules.
 delete raw.filters.find((filter:any)=>filter.id==='region').treeSelection;
 const parsed=parsePage(raw);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
 const page=parsed.page,values=new Map(initialFilterValues(page.filters??[]));
 const validator=createCandidateValidator(page,gateway);expect(validator.trusted('kpi-summary',values)).toBe(true);
 values.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['unverified']});expect(validator.trusted('kpi-summary',values)).toBe(false);
});
it('an empty optional IOC Region does not require a candidate receipt, while a selected node does',async()=>{
 const page=load('ioc-project-overview'),validator=createCandidateValidator(page,gateway);
 const values=new Map(initialFilterValues(page.filters??[]));
 expect(validator.trusted('kpi-summary',values)).toBe(true);
 await expect(validator.verify('kpi-summary',values,new AbortController().signal)).resolves.toBeUndefined();
 values.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['全球']});
 expect(validator.trusted('kpi-summary',values)).toBe(false);
 await expect(validator.verify('kpi-summary',values,new AbortController().signal)).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});
});
it('explicit independent candidate context blocks initial reuse even before a selection',()=>{
 const page=load('ioc-header-unconfigured'),validator=createCandidateValidator(page,gateway);
 expect(validator.trusted('request',initialFilterValues(page.filters??[]))).toBe(false);
});
