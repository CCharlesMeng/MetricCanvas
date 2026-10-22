import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base=process.argv[2];
if(!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error('Usage: tsx local-authoring-retrieval-benchmark.ts <baseline-commit>');
const root='metriccanvas-authoring/skill/metriccanvas-local-authoring/';
const baseline=(file:string)=>execFileSync('git',['show',`${base}:${root}${file}`]);
const current=(file:string)=>readFileSync(root+file);
const mandatory=['SKILL.md','references/local-workflow.md','references/page-metadata/README.md',
  ...['data-sources','fields','queries-and-bindings'].map(id=>`references/page-metadata/${id}.md`)];
const scenarios:Array<[string,string[],string[]]>=[
  ['标题修改',['metricCard.title'],['components/metricCard']],
  ['列宽修改',['table.width'],['components/table']],
  ['金额与百分格式',['fields.format'],['field-bindings-and-formats']],
  ['列绑定修复',['table.columns','fields.format'],['components/table','field-bindings-and-formats']],
  ['未知属性修复',['table.width'],['components/table','validation']],
  ['inline 看板',['page.core','layout.core','data.inline','metricCard.core'],['page','sections-and-layout','components/metricCard']],
  ['已确认 Report',['page.core','layout.core','data.inline','text.core'],['page','sections-and-layout','components/text']],
  ['未确认形态',[],[]],
  ['表格搜索',['table.search','query.core'],['components/table']],
  ['期间筛选',['filters.time','filters.period','query.core'],['filters']],
  ['报告导出',['reportHeader.export'],['components/reportHeader']],
  ['组合源',['data.pagedJoin','table.pagination'],['components/table']],
  ['指标匹配与查询条件',['data.query','fields.core','query.core'],['components/metricCard']],
];
const cases=scenarios.map(([task,topics,modules])=>{
  const files=task==='未确认形态'?['SKILL.md','references/page-form.md']:[...new Set([...mandatory,...modules.map(id=>`references/page-metadata/${id}.md`)])];
  const before=files.reduce((sum,file)=>sum+baseline(file).byteLength,0);
  const result=topics.length?execFileSync(process.execPath,[root+'scripts/read-knowledge.mjs','show',...topics.flatMap(id=>['--topic',id])]):current('references/page-form.md');
  const after=current('SKILL.md').byteLength+result.byteLength;
  return {task,baselineFiles:files,topics,baselineBytes:before,proposedRouteBytes:after,reduction:1-after/before};
});
console.log(JSON.stringify({measurement:'deterministic reference retrieval only; not observed Agent requests',
  baselineCommit:base,currentCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  skillEntrySha256:createHash('sha256').update(current('SKILL.md')).digest('hex'),
  readerSha256:createHash('sha256').update(current('scripts/read-knowledge.mjs')).digest('hex'),
  knowledgeSha256:createHash('sha256').update(current('references/authoring-knowledge/model.json')).digest('hex'),
  fixturePageSha256:createHash('sha256').update(readFileSync('pages/local-authoring-knowledge-demo.json')).digest('hex'),
  fixtureMdSha256:createHash('sha256').update(readFileSync('tools/fixtures/local-authoring-data/metrics.md')).digest('hex'),
  units:'UTF-8 bytes',cases,actualAgentComparison:'not-run',inputTokens:'unavailable',cachedTokens:'unavailable',outputTokens:'unavailable',
  note:'当前结果未计入未知模型的后续指针深查/修复轮次，不能据此推算总input或费用节省。'},null,2));
