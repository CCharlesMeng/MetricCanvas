import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parsePage} from '../src/validate';
const base=()=>({...JSON.parse(readFileSync('pages/ioc-header-overview-demo.json','utf8')),schemaVersion:'6.37'});
const apply=(filter:object)=>{const page=base();page.filters.push({id:'business',type:'dimension',dimension:'kind',...filter});return page;};
describe('B2 shared business filter declarations',()=>{
  it('accepts closed single/multiple choices and hint TextValue',()=>{
    expect(parsePage(apply({selection:{mode:'single',required:true},options:[{value:'1',label:'是'},{value:'0',label:'否'}],default:['1'],hint:{parts:['期间 ',{filter:'period',format:'period'}]}})).ok).toBe(true);
  });
  it.each([
    {selection:{mode:'single'},default:['1','0']},
    {selection:{mode:'single',required:true},default:[]},
    {options:[{value:'1',label:'是',disabled:true}],default:['1']},
    {options:[{value:'1',label:'是'},{value:'1',label:'重复'}]},
    {options:[{value:'1',label:'是'}],dependsOn:'region'},
    {display:'tabs',selection:{mode:'multiple'}},
    {selection:{mode:'multiple',allBehavior:'unrestricted'}},
    {treeSelection:'level',display:'tree'},
    {candidateContext:{filterIds:['period','period'],reconcile:'clear'}},
    {dependsOn:'region',candidateContext:{filterIds:['region'],reconcile:'clear'}},
    {candidateContext:{filterIds:['absent'],reconcile:'intersection'}},
    {clearOnChangeOf:['business']}
  ])('rejects incompatible or unsafe declarations %j',filter=>expect(parsePage(apply(filter)).ok).toBe(false));
  it('detects cycles through new and old dependency fields',()=>{
    const page=apply({candidateContext:{filterIds:['region'],reconcile:'clear'}});
    page.filters.find((f:any)=>f.id==='region').clearOnChangeOf=['business'];expect(parsePage(page).ok).toBe(false);
  });
  it('registers new capabilities independently of iocHeader',()=>{
    const page=apply({options:[{value:'1',label:'是'}]});page.schemaVersion='6.36';expect(parsePage(page).ok).toBe(false);
  });
});
