// Run from repository root: pnpm exec tsx docs/evidence/2026-10-12-explicit-presentation/render-chart-evidence.ts
// Uses parsed initial snapshots; does not execute DQE or verify production.
import {readFileSync,writeFileSync} from 'node:fs';
import {init} from '../../../packages/engine/node_modules/echarts/index.js';
import {parsePage,isQueryDataSource,resolveDataSourceFields,normalizeQueryRows,walkPageComponents} from '../../../packages/page/src/internal.ts';
import {barOption} from '../../../packages/engine/widgets/src/components/bar-chart/options.ts';
import {lineOption} from '../../../packages/engine/widgets/src/components/line-chart/options.ts';
import {cartesianFrame} from '../../../packages/engine/widgets/src/shared/chart-presentation.ts';
import {finiteNumber} from '../../../packages/engine/widgets/src/shared/value-format.ts';
const parsed=parsePage(JSON.parse(readFileSync('pages/business-sdt-report.json','utf8')));
if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
const summary=[];
walkPageComponents(parsed.page,(component)=>{
 if(component.type!=='barChart'&&component.type!=='lineChart')return;
 const source=parsed.page.dataSources[component.data.main];
 if(!source||!isQueryDataSource(source)||!source.source.initial)throw new Error('Missing initial source');
 const normalized={rows:source.source.initial.rows};
 const data={main:{fields:resolveDataSourceFields(source),snapshot:{status:'ready' as const,rows:normalized.rows}}};
 const option=component.type==='barChart'?barOption(data,component.props):lineOption(data,component.props);
 const frame=cartesianFrame(option,component.type==='barChart'?1076:350,true);
 const chart=init(null,undefined,{renderer:'svg',ssr:true,width:component.type==='barChart'?1076:350,height:frame.minHeight});
 chart.setOption({...frame.option,animation:false});
 const svg=chart.renderToSVGString();
 const texts=[...svg.matchAll(/<text([^>]+)>(.*?)<\/text>/gu)];
 const numeric=texts.filter(text=>text[1].includes('font-size:11px'));
 const expected=component.props.series.reduce((n,s)=>{const field=typeof s.field==='string'?s.field:s.field.field;return n+normalized.rows.filter(row=>finiteNumber(row[field])!==undefined).length},0);
 const axis=option.xAxis as {data:string[]};
 const missing=axis.data.filter(name=>!texts.some(text=>text[2]===name));
 if(numeric.length!==expected||missing.length)throw new Error(`${component.id}: missing categories or values`);
 summary.push({id:component.id,categories:axis.data.length,missingCategories:missing,expectedValueLabels:expected,paintedValueLabels:numeric.length,hoverRequired:false});
 if(component.id==='rep-office-efficiency-chart')writeFileSync('docs/evidence/2026-10-12-explicit-presentation/representative-chart.svg',svg);
 chart.dispose();
});
writeFileSync('docs/evidence/2026-10-12-explicit-presentation/svg-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
