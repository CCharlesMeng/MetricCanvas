import {copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {afterEach, describe, expect, it} from 'vitest';
// @ts-expect-error Node composition script is independently executable JS.
import {composeDeployment} from '../../scripts/compose-deployment.mjs';
// @ts-expect-error Node packaging script is independently executable JS.
import {packDeployment} from '../../scripts/pack-deployment.mjs';
const paths:string[]=[];
afterEach(()=>{for(const path of paths.splice(0))rmSync(path,{recursive:true,force:true});});
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'platform-deployment-'));paths.push(dir);
 const platform=join(dir,'platform'),adapter=join(dir,'adapter.js'),output=join(dir,'output');mkdirSync(platform);
 const html='<div data-metriccanvas-root></div><script src="./assets/platform.umd.js"></script>';
 writeFileSync(join(platform,'index.html'),html);
 writeFileSync(join(platform,'release.json'),JSON.stringify({version:'1.0.0',deploymentContractVersion:'1',files:{'index.html':hash(html)}}));
 writeFileSync(adapter,'window.MetricCanvasDeploymentAdapter={contractVersion:"1"};');
 return {platform,adapter,output};
}
describe('static deployment composition',()=>{
 it('packages from a downloaded release outside the repository and preserves every listed digest',()=>{
  const input=fixture();
  for(const name of ['compose-deployment.mjs','pack-deployment.mjs']) {
   copyFileSync(new URL(`../../scripts/${name}`,import.meta.url),join(input.platform,name));
  }
  const result=JSON.parse(execFileSync(process.execPath,
   [join(input.platform,'pack-deployment.mjs'),input.platform,input.adapter,input.output],
   {cwd:tmpdir(),encoding:'utf8'}));
  const archiveBytes=readFileSync(result.archive);
  const archiveHash=createHash('sha256').update(archiveBytes).digest('hex');
  expect(result.sha256).toBe(archiveHash);
  expect(readFileSync(result.checksum,'utf8')).toBe(`${archiveHash}  output.tar.gz\n`);
  const unpacked=join(input.platform,'unpacked');mkdirSync(unpacked);
  execFileSync('tar',['-xzf',result.archive,'-C',unpacked]);
  const manifest=JSON.parse(readFileSync(join(unpacked,'release.json'),'utf8'));
  for(const [name,digest] of Object.entries(manifest.files)) {
   expect(createHash('sha256').update(readFileSync(join(unpacked,name))).digest('hex')).toBe(digest);
  }
  expect(manifest.deployment.adapterSha256).toBe(hash(readFileSync(input.adapter,'utf8')));
  expect(manifest.deployment.targetPortal).toBe('NOT_RUN');
 });
 it.each(['.tar.gz','.tar.gz.sha256'])('rejects an existing %s before composing',suffix=>{
  const input=fixture(),existing=input.output+suffix;writeFileSync(existing,'preserve');
  expect(()=>packDeployment(input)).toThrow('must not already exist');
  expect(readFileSync(existing,'utf8')).toBe('preserve');
  expect(existsSync(input.output)).toBe(false);
 });
 it('preserves upstream files and records separate adapter provenance',()=>{
  const input=fixture(),before=readFileSync(join(input.platform,'index.html'),'utf8');
  const result=composeDeployment(input);
  expect(readFileSync(join(input.platform,'index.html'),'utf8')).toBe(before);
  const html=readFileSync(join(input.output,'index.html'),'utf8');
  expect(html.indexOf('deployment/adapter.js')).toBeLessThan(html.indexOf('assets/platform.umd.js'));
  expect(result.files['index.html']).toBe(hash(html));
  expect(result.deployment.baseFiles['index.html']).toBe(hash(before));
  expect(result.deployment.adapterSha256).toBe(hash(readFileSync(input.adapter,'utf8')));
  expect(()=>composeDeployment(input)).toThrow('already exist');
 });
 it('rejects a changed upstream release',()=>{
  const input=fixture();writeFileSync(join(input.platform,'index.html'),'tampered');
  expect(()=>composeDeployment(input)).toThrow('integrity');
 });
 it('rejects incompatible deployment versions and overlapping output',()=>{
  const input=fixture();
  expect(()=>composeDeployment({...input,output:join(input.platform,'deployment')})).toThrow('separate');
  writeFileSync(join(input.platform,'release.json'),JSON.stringify({deploymentContractVersion:'2'}));
  expect(()=>composeDeployment(input)).toThrow('Unsupported');
 });
});
