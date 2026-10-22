import { pageFilesById } from '../../../../tools/scripts/page-files.mjs';
import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {readFileSync,writeFileSync} from 'node:fs';
import {collectFilterTextValueReferences} from '../../../../packages/page/src/internal';
import {parsePage} from '../../../../packages/page/src/validate';
import {initialFilterValues} from '../../../../packages/engine/runtime/src/filter-state';
import {filterTextPage,periodFactPage} from '../../../../packages/engine/runtime-ui/src/filter-text';
const server=await createServer({configFile:false,root:process.cwd(),plugins:[svelte()],server:{middlewareMode:true},ssr:{noExternal:['@metriccanvas/page','@metriccanvas/ui','@metriccanvas/data-execution']}});
try{
 const {render}=await server.ssrLoadModule('svelte/server');const {default:View}=await server.ssrLoadModule('/packages/engine/runtime-ui/src/ExportView.svelte');
 const facts={contextRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready' as const,granularity:'month' as const,latest:'2026-10',latestComplete:'2026-09',refreshedAt:'2026-10-19T02:00:00Z'}}};
 for(const name of ['time-modes','availability']){
  const raw=JSON.parse(readFileSync(pageFilesById('pages').get(`ioc-header-${name}-demo`)!,'utf8'));const parsed=parsePage(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed));
  const filters=initialFilterValues(parsed.page.filters??[],new Date(2026,9,19),facts);if(name==='time-modes')filters.set('period',{type:'timeRange',mode:'isoWeek',from:'2026-10-05',to:'2026-10-11'});
  const page=periodFactPage(filterTextPage(parsed.page,collectFilterTextValueReferences(raw),filters),facts,0),state={page,currentYear:2026,displayInputs:facts,filterRevision:0,filters,snapshots:new Map([['bound',{status:'ready',rows:[{scope:name==='time-modes'?'2026-10-05 至 2026-10-11':'2026-09',count:1}]}]]),tables:{},headerFilters:{},summaries:{}};
  const html=render(View,{props:{state,width:1024,padding:'0px',gap:'16px'}}).body;
  const expected=name==='time-modes'?['ISO周','2026-10-05～2026-10-11']:['2026-10','2026-09','2026年10月19日 10:00:00'];for(const text of expected)if(!html.includes(text))throw Error('missing static value '+text);
  if(name==='time-modes'&&!/data-ioc-fact="period"[\s\S]*?2026-10-05 至 2026-10-11[\s\S]*?<\/div>/.test(html))throw Error('header summary did not capture the applied week');
  if(html.includes('<details')||html.includes('展开筛选')||html.includes('事实等待'))throw Error('static view contains live controls');
  writeFileSync(`docs/evidence/ioc-header-b4/evidence/static-${name}.html`,html);console.log(`${name}: captured applied mode/range or trusted latest/complete/timestamp present in static export`);
 }
}finally{await server.close();}
