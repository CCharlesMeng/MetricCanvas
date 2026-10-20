import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {readFileSync,writeFileSync} from 'node:fs';
import {parsePage} from '../../../../packages/page/src/validate';
import {initialFilterValues} from '../../../../packages/engine/runtime/src/filter-state';
const server=await createServer({configFile:false,root:process.cwd(),plugins:[svelte()],server:{middlewareMode:true},ssr:{noExternal:['@metriccanvas/page','@metriccanvas/ui','@metriccanvas/data-execution']}});
try{
 const {render}=await server.ssrLoadModule('svelte/server');
 const {default:View}=await server.ssrLoadModule('/packages/engine/runtime-ui/src/ExportView.svelte');
 const parsed=parsePage(JSON.parse(readFileSync('pages/ioc-header-currency-demo.json','utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed));
 const filters=initialFilterValues(parsed.page.filters??[]);filters.set('currency',{type:'dimension',dimension:'currency_code',values:['USD']});filters.set('amount',{type:'numberRange',from:1000000});
 const state={page:parsed.page,currentYear:2026,filters,snapshots:new Map([['main',{status:'ready',rows:[{project:'甲项目','base-cny':2000000,'fee-cny':200000,'total-cny':2200000,'base-usd':300000,'fee-usd':10000,'total-usd':310000,scope:'USD fixture'}]}]]),tables:{},headerFilters:{},summaries:{}};
 const html=render(View,{props:{state,width:1024,padding:'0px',gap:'16px'}}).body;
 for(const text of ['100～不限万美元','预签金额（美元）','310,000'])if(!html.includes(text))throw Error('missing static USD output: '+text);
 if(html.includes('2,200,000')||html.includes('<details'))throw Error('wrong static currency/interactive amount');
 writeFileSync('docs/evidence/ioc-header-b3/evidence/static-currency.html',html);
 console.log('Static USD amount, table, chart and header use the same applied case; no editable amount panel.');
}finally{await server.close();}
