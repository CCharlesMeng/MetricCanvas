import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve('../..'),dist=resolve('dist/microfrontend');
const version=process.env.METRICCANVAS_PLATFORM_VERSION || '1.0.0-rc.1';
if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw Error('Invalid platform release version');
const hash=data=>createHash('sha256').update(data).digest('hex');
const files=directory=>readdirSync(directory).sort().flatMap(name=>{const path=resolve(directory,name);return statSync(path).isDirectory()?files(path):[path];});
writeFileSync(resolve(dist,'portal-contract.d.ts'),readFileSync(resolve('src/lib/integration/contract.ts')));
writeFileSync(resolve(dist,'compose-deployment.mjs'),readFileSync(resolve('scripts/compose-deployment.mjs')));
writeFileSync(resolve(dist,'pack-deployment.mjs'),readFileSync(resolve('scripts/pack-deployment.mjs')));
const artifacts=files(dist).filter(path=>!path.endsWith('/release.json'));
const script=artifacts.filter(path=>path.endsWith('.js')).map(path=>readFileSync(path,'utf8')).join('\n');
for(const forbidden of ['local-dev','developer-1','__fixtures/','__METRICCANVAS_PANGU__','currentLoginUser','node_modules/','process.env.NODE_ENV',root]) {
 if(script.includes(forbidden))throw Error(`生产产物包含禁止内容: ${forbidden}`);
}
const tracked=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const sourceFiles=[...new Set(tracked)].filter(path=>/^(apps\/platform\/(src|scripts)\/|packages\/(page|engine|metric-canvas|application-runtime)\/|apps\/platform\/(package.json|vite.config.ts|svelte.config.js|index.html)|pnpm-lock.yaml|package.json)/.test(path)).sort();
const sourceHash=createHash('sha256');
for(const path of sourceFiles){try{if(statSync(resolve(root,path)).isFile()){sourceHash.update(path+'\0');sourceHash.update(readFileSync(resolve(root,path)));sourceHash.update('\0');}}catch{}}
const manifest={version,deploymentContractVersion:"1",baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeSha256:sourceHash.digest('hex'),entry:'index.html',routeBase:'runtime prop; any normalized path prefix',qiankunCandidate:'2.10.16',targetPortal:'NOT_RUN',realServices:'NOT_RUN',files:Object.fromEntries(artifacts.map(path=>[relative(dist,path),hash(readFileSync(path))]))};
writeFileSync(resolve(dist,'release.json'),JSON.stringify(manifest,null,2)+'\n');
const archive=resolve(`dist/metriccanvas-platform-${version}.tar.gz`);
execFileSync('tar',['-czf',archive,'-C',dist,'.']);
const sha256=hash(readFileSync(archive));writeFileSync(`${archive}.sha256`,`${sha256}  ${relative(resolve('dist'),archive)}\n`);
console.log(JSON.stringify({archive,sha256,...manifest},null,2));
