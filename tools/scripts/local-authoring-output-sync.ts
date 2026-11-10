import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Stats={written:number;unchanged:number;removed:number};
const stats:Stats={written:0,unchanged:0,removed:0};
export const getOutputSyncStats=():Stats=>({...stats});

/** Generated file ownership is unchanged; equal bytes retain their mtime. */
export async function writeChangedFile(file:string,content:string):Promise<void> {
  const actual=await readFile(file).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
  if(actual?.equals(Buffer.from(content))) {stats.unchanged++;return;}
  await mkdir(path.dirname(file),{recursive:true});
  const temporary=file+`.${process.pid}.tmp`;
  await writeFile(temporary,content,'utf8');await rename(temporary,file);stats.written++;
}

async function generatedFiles(root:string,prefix=''):Promise<string[]> {
  const entries=await readdir(path.join(root,prefix),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  return (await Promise.all(entries.map(async entry=>{
    const relative=path.posix.join(prefix,entry.name);
    return entry.isDirectory()?generatedFiles(root,relative):[relative];
  }))).flat();
}

function safeRelative(file:string):void {
  if(!file || file.includes('\\') || path.posix.isAbsolute(file) || file.split('/').some(part=>part==='..' || part==='')) throw new Error(`Invalid generated output path: ${file}`);
}

async function rejectSymlinkParents(root:string,relative:string):Promise<void> {
  let current=root;
  for(const part of ['',...relative.split('/').slice(0,-1)]) {
    current=path.join(current,part);
    const info=await lstat(current).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
    if(info?.isSymbolicLink()) throw new Error(`Generated output parent is a symlink: ${relative}`);
  }
}

/** Only call for a subtree owned entirely by this output map. */
export async function syncGeneratedTree(root:string,outputs:Map<string,string>):Promise<void> {
  await rejectSymlinkParents(root,'_ownership-check');
  for(const file of outputs.keys()) {safeRelative(file);await rejectSymlinkParents(root,file);}
  const previous=await generatedFiles(root);
  for(const [file,content] of outputs) await writeChangedFile(path.join(root,file),content);
  for(const file of previous) if(!outputs.has(file)) {await rm(path.join(root,file),{force:true});stats.removed++;}
}
