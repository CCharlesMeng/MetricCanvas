import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validate } from '../../packages/page/src/validate';

type Schema = Record<string, any>;
export interface ReferenceMap {
  modules: Record<string, { title: string; definitions: string[]; keywords: string[]; examples: string[]; sources: string[]; rules?: string[] }>;
  fieldNotes: Record<string, string>;
  enumNotes: Record<string, string>;
  branchExceptions?: Record<string, { case: string; rule: string; reason: string; source: string }>;
}
export interface ReferenceNode {
  pointer: string; path: string; module: string; required: string; schema: Schema;
}
const escapePointer = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
const unescapePointer = (s: string) => s.replaceAll('~1', '/').replaceAll('~0', '~');
const anchor = (s: string) => `schema-${Buffer.from(s).toString('hex')}`;
const cell = (value: unknown) => String(value ?? '').replaceAll('|', '&#124;').replaceAll('\n', '<br>');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export function atPointer(document: unknown, pointer: string): any {
  if (pointer === '#' || pointer === '') return document;
  if (!pointer.startsWith('#/')) throw new Error(`Unsupported JSON Pointer: ${pointer}`);
  return pointer.slice(2).split('/').reduce((v: any, key) => {
    const decoded = unescapePointer(key);
    if (v === null || typeof v !== 'object' || !(decoded in v)) throw new Error(`Missing JSON Pointer: ${pointer}`);
    return v[decoded];
  }, document);
}

/** 每个局部结构只生成一次；$ref指向同一Schema节点，递归通过链接闭合。 */
export function referenceNodes(schema: Schema, map: ReferenceMap): ReferenceNode[] {
  const owners = new Map<string, string>();
  for (const [file, module] of Object.entries(map.modules)) for (const definition of module.definitions) {
    if (owners.has(definition)) throw new Error(`Duplicate reference owner: ${definition}`);
    if (!(definition in (schema.definitions ?? {}))) throw new Error(`Unknown reference definition: ${definition}`);
    owners.set(definition, file);
  }
  const seen = new Set<string>();
  const nodes: ReferenceNode[] = [];
  function walk(node: unknown, pointer: string, fieldPath: string, required: string, module: string) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || seen.has(pointer)) return;
    seen.add(pointer);
    const s = node as Schema;
    nodes.push({ pointer, path: fieldPath, required, module, schema: s });
    if (s.$ref) {
      const name = unescapePointer(String(s.$ref).split('/')[2] ?? '');
      const owner = owners.get(name);
      if (!owner) throw new Error(`Unowned reference definition: ${name}`);
      walk(atPointer(schema, s.$ref), s.$ref, `@${name}`, '类型/分支', owner);
    }
    for (const [key, value] of Object.entries(s.properties ?? {})) walk(value, `${pointer}/properties/${escapePointer(key)}`, `${fieldPath}.${key}`, s.required?.includes(key) ? '本分支必填' : '本分支可选', module);
    for (const [key, value] of Object.entries(s.patternProperties ?? {})) walk(value, `${pointer}/patternProperties/${escapePointer(key)}`, `${fieldPath}{${key}}`, '匹配键的值', module);
    if (s.additionalProperties && typeof s.additionalProperties === 'object') walk(s.additionalProperties, `${pointer}/additionalProperties`, `${fieldPath}{key}`, '动态键的值', module);
    if (s.items) walk(s.items, `${pointer}/items`, `${fieldPath}[]`, '每个数组项', module);
    for (const keyword of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) for (const [index, branch] of (s[keyword] ?? []).entries()) walk(branch, `${pointer}/${keyword}/${index}`, `${fieldPath} · ${keyword}[${index}]`, '独立分支（不合并required）', module);
    for (const keyword of ['not', 'if', 'then', 'else', 'contains', 'propertyNames']) if (s[keyword]) walk(s[keyword], `${pointer}/${keyword}`, `${fieldPath} · ${keyword}`, '条件结构', module);
  }
  walk(schema, '#', '$', '页面根', 'page.md');
  return nodes;
}

function constraints(s: Schema): string {
  const omitted = new Set(['properties', 'patternProperties', 'items', 'anyOf', 'oneOf', 'allOf', 'prefixItems', 'definitions', '$defs', '$schema', '$id', '$ref', 'type', 'description', 'title', 'default']);
  return Object.entries(s).filter(([k, v]) => !omitted.has(k) && (k !== 'additionalProperties' || typeof v !== 'object')).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('; ') || '无额外结构约束';
}
function typeOf(s: Schema): string {
  if (s.$ref) return `引用 ${s.$ref}`;
  return s.type ? JSON.stringify(s.type) : 'const' in s ? `literal ${JSON.stringify(s.const)}` : s.anyOf ? 'anyOf联合' : s.oneOf ? 'oneOf联合' : s.allOf ? 'allOf交集' : '开放JSON';
}

function components(value: unknown): any[] {
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string,unknown>;
  const own = typeof item.type === 'string' && item.layout && item.props ? [item] : [];
  return [...own, ...Object.values(item).flatMap(components)];
}
function minimalExample(document: any, component: any): any | undefined {
  const candidate = structuredClone({...document, meta:undefined, sections:[{id:'main',components:[component]}]});
  const params = new Set<string>();
  function references(value: any) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.param === 'string') params.add(value.param);
    if (value.source === 'param' && typeof value.id === 'string') params.add(value.id);
    if (typeof value.initialParam === 'string') params.add(value.initialParam);
    for (const id of Object.keys(value.paramBindings ?? {})) params.add(id);
    Object.values(value).forEach(references);
  }
  references(candidate.sections); references(candidate.dataSources); references(candidate.filters);
  if (candidate.params) candidate.params = candidate.params.filter((p:any)=>params.has(p.id));
  if (!candidate.params?.length) delete candidate.params;
  const clean = JSON.parse(JSON.stringify(candidate));
  if (validate(clean).length) return undefined;
  // 每步都需完整校验，保留语义依赖；不以删除错误字段强行通过。
  for (const id of Object.keys(clean.dataSources)) {
    const attempt = structuredClone(clean); delete attempt.dataSources[id];
    if (!validate(attempt).length) delete clean.dataSources[id];
  }
  for (const key of ['filters','params']) if (clean[key]) {
    for (let i=clean[key].length-1;i>=0;i--) {
      const attempt=structuredClone(clean);attempt[key].splice(i,1);if(!attempt[key].length)delete attempt[key];
      if (!validate(attempt).length) clean[key]=attempt[key];
    }
    if (!clean[key]?.length) delete clean[key];
  }
  return clean;
}

function componentPointer(value: any, type: string, pointer = '#'): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if(value.type===type && value.layout && value.props) return pointer;
  for(const [key, child] of Object.entries(value)) {
    const found=componentPointer(child,type,`${pointer}/${escapePointer(key)}`);if(found)return found;
  }
  return undefined;
}

/** 在完整合法页面上记录实际命中的联合分支；不把结构目录计作示例命中。 */
export function branchWitnesses(schema: Schema, examples: Map<string,string>, nodes: ReferenceNode[]) {
  const { Ajv } = createRequire(new URL('../../packages/page/package.json',import.meta.url))('ajv');
  const ajv = new Ajv({strict:false,allErrors:false,validateSchema:false});
  const id='https://metriccanvas/reference/coverage';
  ajv.addSchema({...schema,$id:id});
  const validators = new Map<string,(value:unknown)=>boolean>();
  const evidence = new Map<string,{file:string;pointer:string}>();
  const branches=nodes.filter(n=>/\/(?:anyOf|oneOf)\/\d+$/.test(n.pointer));
  function matches(pointer:string,value:unknown) {
    let check=validators.get(pointer);if(!check){check=ajv.compile({$ref:id+pointer});validators.set(pointer,check!);}
    return check!(value);
  }
  for(const [file,content] of examples) {
    const visited=new Set<string>();
    function visit(pointer:string,value:any,location:string) {
      const key=pointer+'|'+location;if(visited.has(key))return;visited.add(key);
      const node=atPointer(schema,pointer);if(!node||typeof node!=='object')return;
      if(node.$ref)visit(node.$ref,value,location);
      for(const word of ['anyOf','oneOf','allOf'])for(const [i] of (node[word]??[]).entries()){
        const child=pointer+'/'+word+'/'+i;
        if(matches(child,value)){if(!evidence.has(child))evidence.set(child,{file,pointer:location});visit(child,value,location);}
      }
      if(Array.isArray(value)&&node.items)value.forEach((item,i)=>visit(pointer+'/items',item,location+'/'+i));
      if(value&&typeof value==='object'&&!Array.isArray(value))for(const [name,item] of Object.entries(value)){
        if(node.properties?.[name])visit(pointer+'/properties/'+escapePointer(name),item,location+'/'+escapePointer(name));
        else if(typeof node.additionalProperties==='object')visit(pointer+'/additionalProperties',item,location+'/'+escapePointer(name));
      }
    }
    visit('#',JSON.parse(content),'#');
  }
  return branches.map(n=>({schemaPointer:n.pointer,module:n.module,...evidence.get(n.pointer)}));
}

export async function buildPageReference(root: string, schema: Schema, catalog: readonly {type: string; label: string; purpose: string; dataShape: string; chooseWhen: string[]}[], inputs: Map<string,string>, version: string): Promise<Map<string,string>> {
  const authorRoot = path.join(root, 'docs/page-metadata');
  const map = JSON.parse(await readFile(path.join(authorRoot, 'reference-map.json'), 'utf8')) as ReferenceMap;
  const nodes = referenceNodes(schema, map);
  const output = new Map<string,string>();
  const exampleCoverage: Array<{type:string;variant?:unknown;file?:string;pointer?:string;source?:string;reason?:string}> = [];
  const sourceFiles = [...inputs.keys()].filter(file=>file.startsWith('page/conformance/valid/'));
  const documents = [...inputs].filter(([file])=>file.startsWith('page/conformance/valid/')).map(([,content])=>JSON.parse(content));
  for (const component of catalog) {
    const variants = nodes.filter(n=>n.module===`components/${component.type}.md` && n.pointer.endsWith('/properties/variant')).flatMap(n=>n.schema.enum ?? ('const' in n.schema ? [n.schema.const] : []));
    for (const variant of [undefined, ...new Set(variants)]) {
      const candidates = documents.flatMap(document => {
        const direct = components(document).filter(c=>c.type===component.type);
        const parents = (document.sections ?? []).flatMap((section:any)=>section.components).filter((c:any)=>c.type!==component.type && components(c).some(n=>n.type===component.type));
        return [...direct,...parents].map(c => {
          const clone=structuredClone(c);
          if(variant!==undefined) for(const nested of components(clone)) if(nested.type===component.type) nested.props.variant=variant;
          const page=minimalExample(document,clone);return page ? {page,source:sourceFiles[documents.indexOf(document)]} : undefined;
        }).filter(Boolean);
      });
      candidates.sort((a,b)=>JSON.stringify(a!.page).length-JSON.stringify(b!.page).length);
      const file = `examples/component-${component.type}${variant===undefined ? '' : '-'+variant}.json`;
      if(candidates[0]) { output.set(file,json(candidates[0].page)); exampleCoverage.push({type:component.type,...(variant===undefined?{}:{variant}),file,pointer:componentPointer(candidates[0].page,component.type),source:candidates[0].source}); }
      else exampleCoverage.push({type:component.type,...(variant===undefined?{}:{variant}),reason:'现有夹具缺少可完整校验的分支示例'});
    }
  }
  const rules: Array<{id:string;description:string;valid:string[];invalid:string[]}> = JSON.parse(inputs.get('page/conformance/coverage.json') ?? '{"invariants":[]}').invariants;
  for(const [file,content] of inputs) if(file.startsWith('page/conformance/invalid/')) output.set(`errors/${path.posix.basename(file)}`,content);
  output.set('rules.json',json({invariants:rules}));
  const semanticSources = await Promise.all([...new Set([...Object.values(map.modules).flatMap(m=>m.sources), ...Object.values(map.branchExceptions ?? {}).map(e=>e.source)])].sort().map(async file=>({file,sha256:createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')})));
  const schemaHash = createHash('sha256').update(json(schema)).digest('hex');
  const metadata = `页面协议 ${version}。结构真源为本册[schema.json](SCHEMA_LINK)，SHA256 \`${schemaHash}\`。字段表自动生成；可选不等于有默认值。\n\n`;
  for (const [file, module] of Object.entries(map.modules)) {
    let body = await readFile(path.join(authorRoot, file), 'utf8');
    const prefix = file.startsWith('components/') ? '../' : '';
    body += '\n\n' + metadata.replace('SCHEMA_LINK', prefix + 'schema.json');
    body += '## 结构与分支（生成）\n\n';
    for (const node of nodes.filter(n => n.module === file)) {
      const s = node.schema;
      const field = node.path.split('.').at(-1) ?? node.path;
      const note = map.fieldNotes[node.pointer] ?? s.description ?? map.fieldNotes[field] ?? '结合本节用途与所在结构解释；引用节点见目标类型。';
      const target = s.$ref ? nodes.find(n => n.pointer === s.$ref) : undefined;
      body += `<a id="${anchor(node.pointer)}"></a>\n\n### \`${node.path}\`\n\n`;
      body += `Schema位置：\`${node.pointer}\`。${target ? `目标：[${s.$ref}](${prefix}${target.module}#${anchor(target.pointer)})。` : ''}\n\n`;
      body += '| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |\n|---|---|---|---|---|\n';
      body += `| ${cell(typeOf(s))} | ${cell(node.required)} | ${cell(constraints(s))} | ${cell('default' in s ? 'Schema default=' + JSON.stringify(s.default) : 'Schema未设默认；装配/运行时默认见语义说明')} | ${cell(note)} |\n\n`;
      const values = s.enum ?? ('const' in s ? [s.const] : []);
      if (values.length) {
        body += '| 允许值 | 解释与适用条件 |\n|---|---|\n';
        for (const value of values) body += `| ${cell(JSON.stringify(value))} | ${cell(map.enumNotes[`${node.pointer}=${JSON.stringify(value)}`] ?? map.enumNotes[String(value)] ?? (s.const !== undefined ? `用于选择${node.path}分支；同分支其它约束同时成立。` : '待补语义解释，当前仅证实Schema允许。'))} |\n`;
        body += '\n';
      }
    }
    body += '## 语义规则与反例（生成）\n\n';
    for(const id of module.rules ?? []) {
      const rule=rules.find(r=>r.id===id);if(!rule)throw new Error(`Missing reference rule: ${id}`);
      body += `- \`${rule.id}\`：${rule.description}。反例：${rule.invalid.map(name=>`[${name}](${prefix}errors/${name}.json)`).join('、')}。反例文件包含完整input及预期type/path；修复后须重新完整校验。\n`;
    }
    body += '\n## 示例与溯源（生成）\n\n';
    for (const example of exampleCoverage.filter(e=>`components/${e.type}.md`===file && e.file)) body += `- [${example.variant ?? '最小组件'}](${prefix}${example.file})：独立完整页面，保留必要语义依赖。\n`;
    for (const example of module.examples) {
      const source = `page/conformance/valid/${example}.json`;
      if (!inputs.has(source)) throw new Error(`Missing reference example: ${source}`);
      output.set(`examples/${example}.json`, inputs.get(source)!);
      body += `- [${example}](${prefix}examples/${example}.json)：完整合法页面；查询仅为静态契约证据。\n`;
    }
    const snippet=exampleCoverage.find(e=>`components/${e.type}.md`===file && e.file && e.pointer);
    if(snippet?.file && snippet.pointer) body += `\n局部片段提取自[完整页面](${prefix}${snippet.file})的\`${snippet.pointer}\`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。\n\n\`\`\`json\n${json(atPointer(JSON.parse(output.get(snippet.file)!),snippet.pointer))}\`\`\`\n\n`;
    for (const source of module.sources) body += `- 源码/验证定位：\`${source}\`（仓库路径，非分发依赖）。\n`;
    output.set(file, body);
  }
  for (const file of ['README.md','components/README.md','examples/README.md']) {
    const body = await readFile(path.join(authorRoot,file),'utf8');
    output.set(file,body.replaceAll('../../contracts/metriccanvas/page/reference/', '').replaceAll('../contracts/metriccanvas/page/reference/', ''));
  }
  output.set('schema.json', json(schema));
  const missingEnums = nodes.flatMap(n => (n.schema.enum ?? []).filter((v: unknown) => !map.enumNotes[`${n.pointer}=${JSON.stringify(v)}`] && !map.enumNotes[String(v)]).map((v: unknown) => ({pointer:n.pointer,value:v})));
  const branchCoverage=branchWitnesses(schema,new Map([...output].filter(([file])=>file.startsWith('examples/')&&file.endsWith('.json'))),nodes);
  const negativeBranches = new Map<string, {file:string;reason:string;rule:string;source:string}>();
  for (const [pointer, exception] of Object.entries(map.branchExceptions ?? {})) {
    const branch = branchCoverage.find(b => b.schemaPointer === pointer);
    if (!branch || branch.file) throw new Error(`Obsolete branch exception: ${pointer}`);
    const file = `errors/${exception.case}.json`;
    const vector = JSON.parse(output.get(file) ?? 'null');
    const rule = rules.find(r => r.id === exception.rule);
    if (!vector || !rule?.invalid.includes(exception.case) || vector.invariant !== exception.rule || !exception.reason.trim()) throw new Error(`Invalid branch exception: ${pointer}`);
    const actual = validate(vector.input).map(({type,path}) => ({type,path}));
    const expected = vector.expected.map(({type,path}:any) => ({type,path}));
    if (!actual.length || json(actual) !== json(expected)) throw new Error(`Stale branch rejection: ${pointer}`);
    const hit = branchWitnesses(schema,new Map([[file,json(vector.input)]]),nodes).find(b => b.schemaPointer === pointer);
    if (!hit?.file) throw new Error(`Negative witness does not exercise branch: ${pointer}`);
    negativeBranches.set(pointer,{file,reason:exception.reason,rule:exception.rule,source:exception.source});
  }
  const documentedBranches = branchCoverage.map(branch => ({...branch, ...(negativeBranches.has(branch.schemaPointer) ? {negativeWitness:negativeBranches.get(branch.schemaPointer)} : {})}));
  for (const [file] of Object.entries(map.modules)) {
    const prefix = file.startsWith('components/') ? '../' : '';
    let body = output.get(file)! + '\n## 联合分支见证（生成）\n\n';
    for (const branch of documentedBranches.filter(b => b.module === file)) {
      body += `- \`${branch.schemaPointer}\`：`;
      if (branch.file) body += `[合法完整页面](${prefix}${branch.file})，JSON Pointer \`${branch.pointer}\`。\n`;
      else if (branch.negativeWitness) body += `[语义拒绝反例](${prefix}${branch.negativeWitness.file})：${branch.negativeWitness.reason}（规则 \`${branch.negativeWitness.rule}\`）。此项不计入合法示例覆盖。\n`;
      else body += '缺少见证。\n';
    }
    output.set(file,body);
  }
  const missingFields = nodes.filter(n => /\/properties\/[^/]+$/.test(n.pointer) && !map.fieldNotes[n.pointer] && !n.schema.description && !map.fieldNotes[n.path.split('.').at(-1)!]).map(n => n.pointer);
  const semanticGaps = {fields:missingFields,enums:missingEnums,examples:exampleCoverage.filter(e=>!e.file),branches:documentedBranches.filter(b=>!b.file&&!b.negativeWitness)};
  if (Object.values(semanticGaps).some(gaps=>gaps.length)) throw new Error(`Incomplete page reference: ${json(semanticGaps)}`);
  output.set('index.json', json({schemaVersion:version,schemaSha256:schemaHash,semanticSources,modules:map.modules,components:catalog.map(c=>({type:c.type,file:`components/${c.type}.md`})),nodes:nodes.map(({schema:s,...n})=>({...n,type:typeOf(s),constraints:constraints(s),enum:s.enum,const:s.const,ref:s.$ref})),exampleCoverage,branchCoverage:documentedBranches,semanticGaps}));
  for (const component of catalog) if (!output.has(`components/${component.type}.md`)) throw new Error(`Undocumented component: ${component.type}`);
  validateReferenceLinks(output);
  return output;
}

/** 产物自身闭合：完整Bundle和只复制Skill目录都使用同一套相对链接。 */
export function validateReferenceLinks(outputs: Map<string,string>): void {
  for (const [file, text] of outputs) if (file.endsWith('.md')) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [relative, fragment] = href.split('#');
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), relative || path.posix.basename(file)));
      if (target.startsWith('../') || !outputs.has(target)) throw new Error(`Broken reference link: ${file} -> ${href}`);
      if (fragment && !outputs.get(target)!.includes(`id="${fragment}"`)) throw new Error(`Missing reference anchor: ${file} -> ${href}`);
    }
  }
}
