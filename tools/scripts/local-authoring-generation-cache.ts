import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { digest } from './local-authoring-knowledge-core';

type Stats = {hits:number; misses:number; corrupt:number; disabled:number};
const stats:Stats = {hits:0,misses:0,corrupt:0,disabled:0};
export const getKnowledgeCacheStats = ():Stats => ({...stats});
export const generationCacheEnabled = ():boolean => process.env.METRICCANVAS_LOCAL_BUILD_CACHE !== '0' && !process.argv.includes('--no-cache');

async function sourceFiles(root:string, directory:string):Promise<string[]> {
  const entries=await readdir(path.join(root,directory),{withFileTypes:true});
  const nested=await Promise.all(entries.map(async entry=>{
    const relative=path.posix.join(directory,entry.name);
    if(entry.isDirectory()) return sourceFiles(root,relative);
    return /\.(?:ts|js|mjs|json)$/.test(entry.name)?[relative]:[];
  }));
  return nested.flat().sort();
}

/** Conservative transform closure. Data and README inputs are keyed per part,
 * separately from all maintained page/tool code and its locked toolchain. */
export async function knowledgeAlgorithmIdentity(root:string):Promise<string> {
  const groups=await Promise.all(['tools/scripts','packages/page/src'].map(directory=>sourceFiles(root,directory)));
  const files=[...groups.flat(),'pnpm-lock.yaml','package.json','tsconfig.base.json'];
  const identities=await Promise.all(files.sort().map(async file=>[file,digest(await readFile(path.join(root,file),'utf8'))]));
  return digest(JSON.stringify({format:1,node:process.versions.node,files:identities}));
}

export class KnowledgePartCache {
  constructor(private algorithm:string, private directory=path.join(os.tmpdir(),'metriccanvas-knowledge-parts-v1'),private enabled=generationCacheEnabled()) {}

  async derive<T>(part:string,input:unknown,build:()=>T):Promise<T> {
    if(!this.enabled) {stats.disabled++;return build();}
    const key=digest(JSON.stringify({algorithm:this.algorithm,part,input}));
    const file=path.join(this.directory,key+'.json');
    const cached=await this.read<T>(file,key);
    if(cached.found) {stats.hits++;return cached.value;}
    stats.misses++;
    const value=build(), encoded=JSON.stringify(value);
    await this.write(file,JSON.stringify({key,sha256:digest(encoded),value}));
    return value;
  }

  private async read<T>(file:string,key:string):Promise<{found:true;value:T}|{found:false}> {
    try {
      const cached=JSON.parse(await readFile(file,'utf8'));
      if(cached.key===key && cached.sha256===digest(JSON.stringify(cached.value))) return {found:true,value:cached.value};
      stats.corrupt++;
    } catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') stats.corrupt++;}
    return {found:false};
  }

  private async write(file:string,content:string):Promise<void> {
    const temporary=file+`.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    try {await mkdir(this.directory,{recursive:true});await writeFile(temporary,content);await rename(temporary,file);}
    catch { /* An unwritable local cache cannot change generated knowledge. */ }
  }
}
