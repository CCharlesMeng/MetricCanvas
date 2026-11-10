import { expect,it } from 'vitest';
import { mkdir,mkdtemp,readFile,rm,stat,symlink,utimes,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncGeneratedTree } from '../tools/scripts/local-authoring-output-sync';

it('preserves equal output bytes and mtime while pruning only the owned stale files',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'knowledge-sync-'));
  try {
    const tree=path.join(root,'owned'),stable=path.join(tree,'a.json');
    await syncGeneratedTree(tree,new Map([['a.json','first'],['nested/stale.md','stale']]));
    const old=new Date('2001-01-01T00:00:00Z');await utimes(stable,old,old);
    await writeFile(path.join(root,'authored.md'),'keep');
    await syncGeneratedTree(tree,new Map([['a.json','first'],['new.json','second']]));
    expect((await stat(stable)).mtimeMs).toBe(old.getTime());
    await expect(readFile(path.join(tree,'nested/stale.md'))).rejects.toThrow();
    expect(await readFile(path.join(root,'authored.md'),'utf8')).toBe('keep');
    expect(await readFile(path.join(tree,'new.json'),'utf8')).toBe('second');
    await syncGeneratedTree(tree,new Map([['a.json','changed']]));
    expect(await readFile(stable,'utf8')).toBe('changed');
  } finally {await rm(root,{recursive:true,force:true});}
});

it('rejects escaping paths and symlink parents without touching outside content',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'knowledge-sync-safe-'));
  try {
    const tree=path.join(root,'owned'),outside=path.join(root,'outside');
    await mkdir(tree);await mkdir(outside);await writeFile(path.join(outside,'keep'),'untouched');
    await symlink(outside,path.join(tree,'linked'),'dir');
    await expect(syncGeneratedTree(tree,new Map([['../outside/keep','bad']]))).rejects.toThrow('Invalid generated');
    await expect(syncGeneratedTree(tree,new Map([['linked/keep','bad']]))).rejects.toThrow('symlink');
    expect(await readFile(path.join(outside,'keep'),'utf8')).toBe('untouched');
  } finally {await rm(root,{recursive:true,force:true});}
});
