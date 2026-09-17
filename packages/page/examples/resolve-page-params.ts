/** Run with node --import tsx packages/page/examples/resolve-page-params.ts. No renderer or network. */
import {readFileSync} from 'node:fs';
import {resolvePageParams,canonicalizeJson} from '../src/index';
const template=JSON.parse(readFileSync(new URL('../fixtures/contract-valid/inline-params-page.json',import.meta.url),'utf8'));
const suppliedValues={region:'中国区','report-period':{start:'2026-01',end:'2026-06',granularity:'month'}};
const supplied=resolvePageParams(template,suppliedValues);
if(!supplied.ok)throw Error(JSON.stringify(supplied.issues));
const embedded=resolvePageParams(supplied.document);
if(!embedded.ok||canonicalizeJson(embedded.resolvedPage)!==canonicalizeJson(supplied.resolvedPage))throw Error('value 与 suppliedValues 结果不一致');
const source=supplied.resolvedPage.dataSources.tokens.source;
if(source.type!=='query')throw Error('query expected');
process.stdout.write(JSON.stringify({document:supplied.document,dqe:source.query.body},null,2)+'\n');
