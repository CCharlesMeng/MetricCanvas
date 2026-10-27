import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

type Json = Record<string, any>;
export interface KnowledgeTopic {
  module: string; title: string; roots: string[]; sections: number[]; dependencies: string[];
}
export interface AuthoringKnowledge {
  schemaVersion: string; schema: Json; topics: Record<string, KnowledgeTopic>;
  modules: Record<string, { file: string; title: string; semantics: string[]; examples: string[]; rules: unknown[] }>;
  nodes: Array<{pointer: string; path: string; module: string; required: string; note?: string; enums?: Record<string,string>}>;
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');

export function encodeKnowledge(model: AuthoringKnowledge): string {
  const compressed=gzipSync(JSON.stringify(model));
  // RFC 1952 OS=unknown keeps artifact hashes independent of the generator's OS.
  compressed[9]=255;
  return JSON.stringify({encoding:'gzip-base64',data:compressed.toString('base64')})+'\n';
}

export function decodeKnowledge(content: string): AuthoringKnowledge {
  const envelope = JSON.parse(content);
  if (envelope.encoding !== 'gzip-base64' || typeof envelope.data !== 'string') throw new Error('Invalid knowledge encoding');
  return JSON.parse(gunzipSync(Buffer.from(envelope.data,'base64')).toString('utf8')) as AuthoringKnowledge;
}

function atPointer(document: any, pointer: string): any {
  if (pointer === '#') return document;
  return pointer.slice(2).split('/').reduce((node,key)=>node?.[key.replaceAll('~1','/').replaceAll('~0','~')],document);
}

export function topicClosure(model: AuthoringKnowledge, ids: string[]): string[] {
  const result = new Set<string>(), visiting = new Set<string>();
  function visit(id:string):void {
    if (result.has(id)) return;
    const topic = Object.hasOwn(model.topics,id)?model.topics[id]:undefined;
    if (!topic) throw new Error(`Unknown topic: ${id}`);
    if (visiting.has(id)) throw new Error(`Cyclic knowledge dependency: ${id}`);
    visiting.add(id); topic.dependencies.forEach(visit); visiting.delete(id); result.add(id);
  }
  ids.forEach(visit); return [...result];
}

/** Node facts retain ancestor branch conditions, while child/ref nodes stay explicit
 * references. The output never pretends to be a standalone JSON Schema. */
export function knowledgeSelection(model: AuthoringKnowledge, ids: string[], pointers:string[]=[]): unknown {
  const topics = topicClosure(model,ids);
  for(const pointer of pointers) if(!model.nodes.some(node=>node.pointer===pointer)) throw new Error(`Unknown schema pointer: ${pointer}`);
  const roots = [...new Set([...topics.flatMap(id=>model.topics[id].roots),...pointers])];
  const selected = model.nodes.filter(node=>roots.some(root=>node.pointer === root || root.startsWith(node.pointer+'/')));
  const compact = selected.map(node=>{
    const schema = atPointer(model.schema,node.pointer);
    const facts = Object.fromEntries(Object.entries(schema).filter(([key])=>!['properties','items','anyOf','oneOf','allOf','definitions','$defs','patternProperties','additionalProperties'].includes(key)));
    for (const key of ['properties','patternProperties']) if (schema[key]) facts[key] = Object.fromEntries(Object.keys(schema[key]).map(name=>[name,`${node.pointer}/${key}/${name.replaceAll('~','~0').replaceAll('/','~1')}`]));
    if ('additionalProperties' in schema) facts.additionalProperties = typeof schema.additionalProperties === 'boolean' ? schema.additionalProperties : `${node.pointer}/additionalProperties`;
    for (const key of ['anyOf','oneOf','allOf']) if (schema[key]) facts[key] = schema[key].map((_:unknown,i:number)=>`${node.pointer}/${key}/${i}`);
    if (schema.items) facts.items = `${node.pointer}/items`;
    return {...node,facts};
  });
  const modules = [...new Set([...topics.map(id=>model.topics[id].module),...selected.filter(node=>pointers.includes(node.pointer)).map(node=>node.module)])];
  return {schemaVersion:model.schemaVersion,scope:'partial; follow references or validate the complete document',topics,
    semantics:modules.map(id=>({module:id,reference:model.modules[id].file,
      blocks:[...new Set([0,...topics.filter(t=>model.topics[t].module===id).flatMap(t=>model.topics[t].sections)])].map(i=>model.modules[id].semantics[i]),
      rules:model.modules[id].rules,examples:model.modules[id].examples})),nodes:compact,
    unresolvedRefs:[...new Set(compact.map(n=>n.facts.$ref).filter((ref):ref is string=>typeof ref==='string' && !selected.some(n=>n.pointer===ref)))].map(pointer=>({pointer,module:model.nodes.find(n=>n.pointer===pointer)?.module}))};
}
