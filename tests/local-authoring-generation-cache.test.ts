import { expect,it } from 'vitest';
import { mkdtemp,readFile,readdir,rm,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KnowledgePartCache } from '../tools/scripts/local-authoring-generation-cache';

it('reuses independent knowledge parts and rebuilds only changed inputs or algorithms',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'knowledge-parts-'));
  try {
    let builds=0;
    const derive=(cache:KnowledgePartCache,part:string,input:unknown)=>cache.derive(part,input,()=>({build:++builds,input}));
    const cache=new KnowledgePartCache('algorithm-1',directory,true);
    const first=await derive(cache,'example:first',{column:'time'});
    const second=await derive(cache,'example:second',{column:'enum'});
    expect(await derive(cache,'example:first',{column:'time'})).toEqual(first);
    expect(await derive(cache,'example:second',{column:'enum'})).toEqual(second);
    expect(builds).toBe(2);
    await derive(cache,'example:first',{column:'changed'});
    expect(await derive(cache,'example:second',{column:'enum'})).toEqual(second);
    expect(builds).toBe(3);
    await derive(new KnowledgePartCache('algorithm-2',directory,true),'example:first',{column:'time'});
    expect(builds).toBe(4);
  } finally {await rm(directory,{recursive:true,force:true});}
});

it('rejects corrupt cache bytes and has a cache-independent reference execution',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'knowledge-parts-corrupt-'));
  try {
    let builds=0;
    const cache=new KnowledgePartCache('algorithm',directory,true);
    const build=()=>{builds++;return {complete:'原文😀',values:[1,2]};};
    const expected=await cache.derive('module',{},build);
    const file=path.join(directory,(await readdir(directory))[0]!);
    const record=JSON.parse(await readFile(file,'utf8'));record.value.complete='corrupt';
    await writeFile(file,JSON.stringify(record));
    expect(await cache.derive('module',{},build)).toEqual(expected);
    expect(builds).toBe(2);
    const uncached=new KnowledgePartCache('algorithm',directory,false);
    expect(await uncached.derive('module',{},build)).toEqual(expected);
    expect(builds).toBe(3);
  } finally {await rm(directory,{recursive:true,force:true});}
});
