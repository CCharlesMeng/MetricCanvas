import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/filters/filter-source-candidates.json',import.meta.url),'utf8'));
async function mount(page:Page,state='ready',readOnly=false){
 await page.goto('/examples/inline.html');
 await page.evaluate(({document,state,readOnly})=>{
  window.runtime.destroy();
  const probe={offsets:[] as number[],queries:[] as any[],search:''};(window as any).sourceCandidateProbe=probe;
  if(readOnly){document.dashboardToolbar={variant:'compact',readOnly:true};document.filters[0].default=['north'];document.filters[1].default=['online'];}
  window.runtime=MetricCanvas.mount('#dashboard',{document,initialSearch:'',onEvent(event){if(event.type==='filter-change')probe.search=event.search;},dataGateway:{async fetchData(query:any,context:any){
   if(context?.dataSourceIds?.includes('channel-options')){
    if(state==='error')throw Object.assign(Error('synthetic candidate failure'),{code:'DQE_UPSTREAM_ERROR'});
    const rows=state==='empty'?[]:[{code:'direct',name:'直营',weight:1},{code:'direct',name:'直营',weight:2},{code:'partner',name:'伙伴',weight:1},{code:'online',name:'线上',weight:1},{code:'partner',name:'伙伴',weight:2}];
    const offset=query.pagination?.offset??0;probe.offsets.push(offset);
    return {rows:rows.slice(offset,offset+(query.pagination?.limit??2)),totalCount:state==='incomplete'&&offset>0?6:rows.length};
   }
   probe.queries.push(query);
   const selected=query.filterValues.find((value:any)=>value.queryField==='org')?.values;
   const rows=(selected??['north','shanghai','beijing']).map((org:string)=>({org,amount:org==='north'?100:40}));
   return {rows,totalCount:rows.length};
  }}});
 },{document:structuredClone(document),state,readOnly});
}
for(const width of [1440,390])test(`${width}: complete candidates and independent tree nodes control the chart`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await mount(page);
 const channel=page.locator('[data-filter-group=channel]'),org=page.locator('[data-filter-group=organization]');
 await expect(channel.locator('[data-candidates-status=ready]')).toBeVisible();
 await channel.getByRole('button',{name:'渠道',exact:true}).click();
 await expect(channel.getByRole('option')).toHaveText(['直营','伙伴','线上']);
 await channel.getByRole('option',{name:'线上',exact:true}).click();
 await org.getByRole('button',{name:'组织',exact:true}).click();
 await org.getByRole('button',{name:'北区',exact:true}).click();
 await org.getByRole('button',{name:'展开北区',exact:true}).click();
 await expect(org.getByRole('treeitem',{name:'上海',exact:true})).toHaveAttribute('aria-selected','false');
 await expect.poll(()=>page.evaluate(()=>(window as any).sourceCandidateProbe.queries.at(-1).filterValues.find((value:any)=>value.queryField==='org')?.values)).toEqual(['north']);
 await org.getByRole('button',{name:'上海',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>new URLSearchParams((window as any).sourceCandidateProbe.search).getAll('organization'))).toEqual(['north','shanghai']);
 await channel.getByRole('button',{name:'渠道',exact:true}).click();
 await expect(channel.getByRole('option')).toHaveCount(3);
 expect(await page.evaluate(()=>(window as any).sourceCandidateProbe.offsets)).toEqual([0,2,4]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('source-candidates.png'),fullPage:true});
});
for(const state of ['error','incomplete','empty'])test(`${state}: candidate state never exposes partial choices`,async({page})=>{
 await mount(page,state);const channel=page.locator('[data-filter-group=channel]');
 await channel.getByRole('button',{name:'渠道',exact:true}).click();
 await expect(channel).toContainText(state==='empty'?'无候选项':'候选项加载失败');
 await expect(channel.getByRole('option')).toHaveCount(0);
 if(state!=='empty')await expect(channel.getByRole('button',{name:'重试',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).sourceCandidateProbe.queries)).toEqual([]);
});
test('source-backed readOnly controls retain their values and prohibit editing',async({page})=>{
 await mount(page,'ready',true);
 for(const id of ['channel','organization'])await expect(page.locator(`[data-filter-group=${id}]`).getByRole('button').first()).toBeDisabled();
});
