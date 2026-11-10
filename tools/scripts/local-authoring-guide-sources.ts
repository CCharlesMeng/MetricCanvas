import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pageFilesById } from './page-files.mjs';
import { declaredExampleGuidePages, buildExampleGuides, type ExampleGuideIndex } from './local-authoring-example-guides';
import { referenceProjection } from './local-authoring-projection';
import { KnowledgePartCache } from './local-authoring-generation-cache';

async function readmes(root:string,directory='pages'):Promise<Array<[string,string]>> {
  const entries=await readdir(path.join(root,directory),{withFileTypes:true});
  return (await Promise.all(entries.map(async entry=>{
    const file=path.posix.join(directory,entry.name);
    if(entry.isDirectory()) return readmes(root,file);
    return entry.name==='README.md'?[[file,await readFile(path.join(root,file),'utf8')] as [string,string]]:[];
  }))).flat();
}

/** Only explicitly enrolled examples are read, validated and distributed. */
export async function exampleGuideSources(root:string,reference:Map<string,string>,cache:KnowledgePartCache):Promise<{reference:Map<string,string>;guides:ExampleGuideIndex}> {
  const documents=new Map((await readmes(root)).sort(([a],[b])=>a.localeCompare(b)));
  const wanted=declaredExampleGuidePages(documents), files=pageFilesById(path.join(root,'pages'));
  const pages=new Map<string,string>();
  for(const id of wanted) {
    const file=files.get(id);
    if(!file) throw new Error(`Missing declared Playground example: ${id}`);
    pages.set(`pages/${id}.json`,await readFile(file,'utf8'));
  }
  const serialized=await cache.derive('readme-guides',{documents:[...documents],pages:[...pages]},()=>{
    const built=buildExampleGuides(documents,pages);
    return {byPageId:[...built.byPageId],references:[...built.references]};
  });
  const augmented=new Map(reference);
  for(const [file,text] of pages) {
    const id=path.posix.basename(file,'.json'), value=JSON.parse(text);
    if(value.id!==id) throw new Error(`Playground example identity mismatch: ${id}`);
    const source=`page/reference/examples/${id}.json`;
    const normalized=referenceProjection(new Map([[source,text]]));
    // The real Playground document wins over a conformance alias for the same recipe.
    augmented.set(`examples/${id}.json`,normalized.get(`examples/${id}.json`)!);
  }
  return {reference:augmented,guides:{byPageId:new Map(serialized.byPageId),references:new Map(serialized.references)}};
}
