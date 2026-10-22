import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const {copyConsumerFixtures}=await import(pathToFileURL(join(root,'tools/package-build/consumer-fixtures.mjs')));
const out=mkdtempSync(join(tmpdir(),'ioc-ci-closure-'));
writeFileSync('/tmp/ioc-ci-fix-consumer-path',out);
const run=(cmd,args,cwd=root,env={})=>execFileSync(cmd,args,{cwd,stdio:'inherit',env:{...process.env,...env}});
const names=['data-execution','page','ui','engine','metric-canvas','embed'];
const dependencies={svelte:'5.56.6','@playwright/test':'1.62.0'};
for(const name of names){const archive=join(out,`${name}.tgz`);run('pnpm',['pack','--out',archive],join(root,'packages',name));dependencies[`@metriccanvas/${name}`]=`file:${archive}`;}
const consumer=join(out,'consumer');mkdirSync(consumer);writeFileSync(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies},null,2));
run('npm',['install','--ignore-scripts','--no-audit','--no-fund'],consumer);
copyConsumerFixtures(root,consumer);
for(const filename of ['embed.spec.ts','version-error.spec.ts','execution.spec.ts','globals.d.ts']){
const path=join(consumer,'packages/embed/tests/browser',filename);writeFileSync(path,readFileSync(path,'utf8').replaceAll("'../../src/types'","'@metriccanvas/embed'").replaceAll("'../../src'","'@metriccanvas/embed'"));}
cpSync(join(root,'packages/embed/playwright.config.ts'),join(consumer,'packages/embed/playwright.config.ts'));
cpSync(join(consumer,'node_modules/@metriccanvas/embed/dist'),join(consumer,'packages/embed/dist'),{recursive:true});
run(join(consumer,'node_modules/.bin/playwright'),['test','--config','packages/embed/playwright.config.ts','--workers=2'],consumer,{MC_EMBED_EXAMPLE_PORT:'4235'});
writeFileSync(join(out,'summary.json'),JSON.stringify({consumer,packages:names,status:'passed',scope:'All Embed browser tests against six installed tarballs, including frozen B4 collector'},null,2));
console.log('All installed Embed browser evidence: '+out);
