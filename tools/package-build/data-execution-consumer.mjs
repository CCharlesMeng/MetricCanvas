import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const output = mkdtempSync(join(tmpdir(), 'metriccanvas-data-execution-consumer-'));
const archives = {};
for (const name of ['page', 'data-execution']) {
  const archive = join(output, `${name}.tgz`);
  execFileSync('pnpm', ['pack', '--out', archive], { cwd: join(root, 'packages', name), stdio: 'pipe' });
  archives[`@metriccanvas/${name}`] = `file:${archive}`;
}
const consumer = join(output, 'consumer');
mkdirSync(consumer);
writeFileSync(join(consumer, 'package.json'), JSON.stringify({
  private: true, type: 'module', dependencies: archives,
  overrides: { '@metriccanvas/page': '$@metriccanvas/page' }
}, null, 2));
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumer, stdio: 'pipe' });
const require = createRequire(join(consumer, 'package.json'));
for (const name of ['svelte', 'echarts', '@metriccanvas/engine', '@metriccanvas/ui']) assert.throws(() => require.resolve(name));
const source = readFileSync(join(root, 'packages/page/fixtures/contract-valid/query-cascade-page.json'), 'utf8');
writeFileSync(join(consumer, 'metadata.json'), source);
writeFileSync(join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPageDataExecutor} from '@metriccanvas/data-execution';
import {parsePage} from '@metriccanvas/page';
const metadata=JSON.parse(readFileSync(new URL('./metadata.json',import.meta.url),'utf8'));
const calls=[];
const result=await createPageDataExecutor({gateway:{async fetchData(query,context){
  calls.push({query,id:context.dataSourceIds[0]});
  return calls.length===1 ? {rows:[{'commerce-id':'A','customer-name':'Customer','project-name':'Project','decision-time':2}],totalCount:1}
    : {rows:[{'commerce-id':'A','stage-name':'代表处SDT','decision-time':0,'decision-count':3}],totalCount:1};
}}}).execute(metadata);
assert.equal(calls.length,2);
assert.deepEqual(calls[1].query.filterValues,[{target:'dimension',queryField:'商务编号',values:['A']}]);
assert(parsePage(result).ok);
assert.equal(result.dataSources['project-efficiency-bottom5'].source.initial.rows[0]['商务编号'],'A');
assert(!metadata.dataSources['project-efficiency-bottom5'].source.initial);
console.log('Standalone Node ESM execution passed');
`);
const result = execFileSync(process.execPath, ['verify.mjs'], { cwd: consumer, encoding: 'utf8' });
writeFileSync(join(consumer, 'types.ts'), `
import {createPageDataExecutor, type DataGateway} from '@metriccanvas/data-execution';
import {createDqeGateway} from '@metriccanvas/data-execution/dqe';
import {executePageDataProgram} from '@metriccanvas/data-execution/node';
import type {PageDocument} from '@metriccanvas/page';
declare const metadata: PageDocument;
const gateway: DataGateway=createDqeGateway({endpoint:'http://localhost/dqe'});
const output: Promise<PageDocument>=createPageDataExecutor({gateway}).execute(metadata);
const nodeOutput: Promise<PageDocument>=executePageDataProgram(metadata,{endpoint:'http://localhost/dqe'});
void output; void nodeOutput;
`);
execFileSync(join(root, 'node_modules/.bin/tsc'), ['--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'types.ts'], { cwd: consumer, stdio: 'pipe' });
const empty = {
  schemaVersion: JSON.parse(source).schemaVersion, id: 'standalone-cli', layout: 'report',
  dataSources: {}, sections: [{ id: 'main', components: [{ id: 'heading', type: 'text', layout: { span: 12 }, props: { body: 'CLI' } }] }]
};
const cli = execFileSync(join(consumer, 'node_modules/.bin/metriccanvas-execute-page'), [], {
  cwd: consumer, input: JSON.stringify(empty), encoding: 'utf8',
  env: { ...process.env, METRICCANVAS_DQE_ENDPOINT: 'http://127.0.0.1:1/dqe', METRICCANVAS_DQE_HEADERS: '{}' }
});
assert.deepEqual(JSON.parse(cli), empty);
console.log(JSON.stringify({ output, result: result.trim(), installed: Object.keys(archives), noRenderingDependencies: true, externalTypes: 'pass', installedCli: 'pass' }));
