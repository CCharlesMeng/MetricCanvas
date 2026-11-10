import { buildContractBindings } from './local-authoring-contract-query';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { atPointer, referenceNodes, type ReferenceMap } from './page-reference';

import { digest, encodeKnowledge, topicClosure, type AuthoringKnowledge } from './local-authoring-knowledge-core';
import { buildExampleIndex } from './local-authoring-example-query';
import { buildPassageIndex } from './local-authoring-semantic-query';
import type { QueryKnowledge } from './local-authoring-query-types';
import { buildRuleBindings } from './local-authoring-query-rules';
import { KnowledgePartCache, knowledgeAlgorithmIdentity } from './local-authoring-generation-cache';
import { exampleGuideSources } from './local-authoring-guide-sources';
export { knowledgeSelection, topicClosure } from './local-authoring-knowledge-core';
export type { AuthoringKnowledge } from './local-authoring-knowledge-core';
type Json = Record<string, any>;

/** Semantic prose is copied verbatim from the already sanitized local projection.
 * H2 blocks are independently discoverable; an explicit selector fails on rename.
 * This avoids adding a second, hand-maintained summary of protocol rules. */
function semanticSections(text: string): string[] {
  const prose = text.split('## 结构与分支（生成）')[0]
    .replace(/页面协议 [\d.]+。结构真源为本册\[schema\.json\][\s\S]*$/, '').trim();
  return prose.split(/(?=^## )/m).filter(part => part.trim()).map(part => part.trim());
}

export function validateSemanticHeadings(file:string,sections:string[],registered:string[]|undefined):void {
  const actual=sections.slice(1).map(section=>section.split('\n')[0].replace(/^## /,''));
  if(!registered || JSON.stringify(actual)!==JSON.stringify(registered)) {
    throw new Error(`page/reference/${file}: semantic headings changed; review topic/common scope and update authoringSemanticHeadings. Actual: ${JSON.stringify(actual)}`);
  }
}

function baseTopics(model: AuthoringKnowledge): void {
  for (const [id, module] of Object.entries(model.modules)) {
    model.topics[`${id}.overview`] = {module:id,title:module.title,roots:[],sections:[0],dependencies:[]};
    module.semantics.slice(1).forEach((section, index) => {
      const title = section.split('\n')[0].replace(/^## /,'');
      model.topics[`${id}.section-${digest(title).slice(0,8)}`] = {
        module:id,title,roots:[],sections:[0,index+1],dependencies:[]
      };
    });
  }
}

function configuredTopics(model: AuthoringKnowledge, map: Json): void {
  for (const [id, topic] of Object.entries(map.authoringTopics ?? {}) as Array<[string,Json]>) {
    const module = model.modules[topic.module];
    if (!module) throw new Error(`Unknown knowledge module: ${topic.module}`);
    for (const root of topic.roots ?? []) atPointer(model.schema,root);
    const sections = [0,...(topic.headings ?? []).map((heading: string) => {
      const index = module.semantics.findIndex(section => section.split('\n')[0] === `## ${heading}`);
      if (index < 0) throw new Error(`Missing semantic section ${id}: ${heading}`);
      return index;
    })];
    model.topics[id] = {module:topic.module,title:topic.title,roots:topic.roots ?? [],
      sections:[...new Set<number>(sections)],dependencies:topic.dependencies ?? []};
  }
}

export async function localAuthoringKnowledge(root: string, reference: Map<string,string>): Promise<Map<string,string>> {
  const cache=new KnowledgePartCache(await knowledgeAlgorithmIdentity(root));
  const sources=await exampleGuideSources(root,reference,cache);
  reference=sources.reference;
  const map = JSON.parse(await readFile(path.join(root,'docs/page-metadata/reference-map.json'),'utf8'));
  const index = JSON.parse(reference.get('index.json')!);
  const schema = JSON.parse(reference.get('schema.json')!);
  const rules = JSON.parse(reference.get('rules.json')!).invariants;
  const modules: AuthoringKnowledge['modules'] = {};
  for (const [file, module] of Object.entries(index.modules) as Array<[string,Json]>) {
    const id = path.posix.basename(file,'.md');
    if(Object.hasOwn(modules,id)) throw new Error(`Duplicate local knowledge module: ${id}`);
    const moduleRules=rules.filter((rule:Json)=>(module.rules ?? []).includes(rule.id));
    modules[id] = await cache.derive(`module:${id}`,{file,module,text:reference.get(file),rules:moduleRules,headings:map.authoringSemanticHeadings?.[file]},()=>{
      const semantics=semanticSections(reference.get(file)!);
      validateSemanticHeadings(file,semantics,map.authoringSemanticHeadings?.[file]);
      return {file:`references/page-metadata/${file}`,title:module.title,
        semantics,examples:module.examples.map((name:string)=>`references/page-metadata/examples/${name}.json`),
        rules:moduleRules};
    });
  }
  const nodes = await cache.derive('schema-nodes',{schema,map},()=>referenceNodes(schema,map as ReferenceMap).map(({pointer,path:fieldPath,module,required,schema:node}) => ({
    pointer,path:fieldPath,module:path.posix.basename(module,'.md'),required,
    note:map.fieldNotes[pointer] ?? node.description ?? map.fieldNotes[fieldPath.split('.').at(-1)!],
    enums:Object.fromEntries((node.enum ?? ('const' in node ? [node.const] : [])).map((value:unknown)=>[
      JSON.stringify(value),map.enumNotes[`${pointer}=${JSON.stringify(value)}`] ?? map.enumNotes[String(value)] ?? ''
    ]))
  })));
  const model:QueryKnowledge = {schemaVersion:index.schemaVersion,schema,modules,topics:{},nodes,formatVersion:4};
  baseTopics(model); configuredTopics(model,map);
  const examples=await Promise.all([...reference].filter(([file])=>file.startsWith('examples/')&&file.endsWith('.json'))
    .map(([file,text])=>cache.derive(`example:${file}`,text,()=>buildExampleIndex(new Map([[file,text]])))));
  model.examples=examples.flat().sort((a,b)=>a.file.localeCompare(b.file));
  for(const entry of model.examples) entry.guides=sources.guides.byPageId.get(entry.pageId) ?? [];
  model.passages = buildPassageIndex(model);
  model.ruleBindings = buildRuleBindings(model, map.authoringRuleBindings);
  model.contracts = buildContractBindings(model, map.authoringContracts ?? {});
  // Exercise the same dependency validation as the installed CLI at build time.
  for (const id of Object.keys(model.topics)) topicClosure(model,[id]);
  return new Map([['references/authoring-knowledge/model.json',encodeKnowledge(model)],...sources.guides.references,
    ...[...reference].filter(([file])=>file.startsWith('examples/')).map(([file,text])=>[`references/page-metadata/${file}`,text] as [string,string])]);
}
