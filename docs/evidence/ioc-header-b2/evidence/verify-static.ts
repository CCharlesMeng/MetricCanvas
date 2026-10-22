import { pageFilesById } from '../../../../tools/scripts/page-files.mjs';
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
 for(const name of ['options','tree','detail']){
 const doc=JSON.parse(readFileSync(pageFilesById('pages').get(`ioc-header-business-${name}-demo`)!,'utf8'));const parsed=parsePage(doc);if(!parsed.ok)throw Error(JSON.stringify(parsed));
 const state={page:parsed.page,currentYear:2026,filters:initialFilterValues(parsed.page.filters??[]),snapshots:new Map(),tables:{},headerFilters:{},summaries:{}};
 const html=renderStatic(View,{props:{state,width:1024,padding:'0px',gap:'16px'}}).body;
 for(const id of doc.iocHeader.filterIds)if(!html.includes(`data-filter-id="${id}"`))throw Error('missing static filter '+id);
 writeFileSync(`docs/evidence/ioc-header-b2/evidence/static-${name}.html`,html);
 if(html.includes('<details')||html.includes('展开筛选')||html.includes('收起筛选'))throw Error('interactive B2 static view');
 if(name==='options'&&(!html.includes('重点客户')||!html.includes('是、否')||!html.includes('切换客户分类')))throw Error('missing enum labels/hint');
 if(name==='detail'&&!html.includes('详情一级'))throw Error('missing private enum');
 writeFileSync(`docs/evidence/ioc-header-b2/evidence/static-${name}.html`,html);
 console.log(`${name}: static applied conditions, hints and readonly controls retained`);
 }
}finally{await server.close();}
