import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {render} from 'svelte/server';
import {readFileSync,writeFileSync} from 'node:fs';
import {parsePage} from '../../../../packages/page/src/validate';
import {initialFilterValues} from '../../../../packages/engine/runtime/src/filter-state';
const server=await createServer({configFile:false,root:process.cwd(),plugins:[svelte()],server:{middlewareMode:true},ssr:{noExternal:['@metriccanvas/page','@metriccanvas/ui','@metriccanvas/data-execution']}});
try{
 const {render:renderStatic}=await server.ssrLoadModule('svelte/server');
 const {default:View}=await server.ssrLoadModule('/packages/engine/runtime-ui/src/ExportView.svelte');
 const doc=JSON.parse(readFileSync('pages/ioc-header-dense-filter-demo.json','utf8'));const parsed=parsePage(doc);if(!parsed.ok)throw Error(JSON.stringify(parsed));
 const state={page:parsed.page,currentYear:2026,filters:initialFilterValues(parsed.page.filters??[]),snapshots:new Map(),tables:{},headerFilters:{},summaries:{}};
 const html=renderStatic(View,{props:{state,width:1024,padding:'0px',gap:'16px'}}).body;
 for(const id of doc.iocHeader.filterIds)if(!html.includes(`data-filter-id="${id}"`))throw Error('missing static filter '+id);
 if(html.includes('展开筛选')||html.includes('收起筛选')||html.includes('返回来源页'))throw Error('interactive header in static view');
 if(!html.includes(doc.iocHeader.identity.title))throw Error('missing identity');
 writeFileSync('docs/evidence/ioc-header-b0-b1/evidence/static-header.html',html);
 state.filters=new Map([...state.filters,['amount',{type:'numberRange' as const,from:10,to:20}],['search-proof',{type:'search' as const,query:'已应用检索'}]]);
 (state.page.filters??=[]).push({id:'search-proof',type:'search',label:'检索'});
 state.page.iocHeader!.filterIds!.push('search-proof');
 const applied=renderStatic(View,{props:{state,width:1024,padding:'0px',gap:'16px'}}).body;
 if(!applied.includes('10～20')||!applied.includes('已应用检索'))throw Error('missing applied static values');
 writeFileSync('docs/evidence/ioc-header-b0-b1/evidence/static-applied.html',applied);
 console.log('Static applied values: number range10–20 and search text retained');
 console.log('Static ExportView: identity and all eight filters retained; no header operations or collapse/back controls');
}finally{await server.close();}
