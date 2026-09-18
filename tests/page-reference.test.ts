import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readFile, readdir, access, cp, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pageSchema, componentCatalog, validate, versionPolicy } from '../packages/page/src/internal';
import { atPointer, buildPageReference, referenceNodes, validateReferenceLinks, type ReferenceMap } from '../tools/scripts/page-reference';

const root = process.cwd();
const bundle = JSON.parse(await readFile('metriccanvas-authoring/bundle.json','utf8'));
const skills: Array<{id:string;entrypoint:string}> = bundle.skills ?? [{id:'metriccanvas-page-builder',entrypoint:bundle.skill.entrypoint}];
const authorMap = JSON.parse(await readFile('docs/page-metadata/reference-map.json', 'utf8')) as ReferenceMap;
const inputs = new Map<string,string>();
for (const file of await readdir('packages/page/fixtures/contract-valid')) if (file.endsWith('.json')) inputs.set(`page/conformance/valid/${file}`, await readFile(`packages/page/fixtures/contract-valid/${file}`, 'utf8'));
inputs.set('page/conformance/coverage.json',await readFile('contracts/metriccanvas/page/conformance/coverage.json','utf8'));
for(const file of await readdir('contracts/metriccanvas/page/conformance/invalid')) inputs.set(`page/conformance/invalid/${file}`,await readFile(`contracts/metriccanvas/page/conformance/invalid/${file}`,'utf8'));
const reference = await buildPageReference(root, pageSchema, componentCatalog, inputs, versionPolicy.current);

describe('页面参考手册生成与分发', () => {
  it('退役参考全部保留在冻结来源', async () => {
    const manifest = JSON.parse(await readFile('docs/plan/2026-09-15-unified-authoring-s0-sources.json', 'utf8'));
    expect(manifest.files).toHaveLength(275);
    // Generated contract paths continue to evolve; verify the original bytes archived from sourceCommit.
    const frozen = JSON.parse(gunzipSync(await readFile('docs/plan/2026-09-15-unified-authoring-s0-frozen.json.gz')).toString('utf8'));
    for (const entry of manifest.files) {
      const bytes = entry.retainedSource ? await readFile(entry.retainedSource) : Buffer.from(frozen[entry.source], 'utf8');
      expect(createHash('sha256').update(bytes).digest('hex'), entry.reference).toBe(entry.sha256);
    }
  });
  it('独立保留联合必填、动态键、数组项、const和递归引用，不无限展开', () => {
    const schema = {type:'object',properties:{node:{$ref:'#/definitions/node'}},required:['node'],definitions:{node:{oneOf:[{type:'object',properties:{kind:{const:'leaf'},value:{type:'string'}},required:['kind','value'],additionalProperties:false},{type:'object',properties:{kind:{const:'branch'},children:{type:'array',items:{$ref:'#/definitions/node'}}},required:['kind','children'],additionalProperties:{type:'number'}}]}}};
    const nodes = referenceNodes(schema, {modules:{'page.md':{title:'page',definitions:['node'],keywords:[],examples:[],sources:[]}},fieldNotes:{},enumNotes:{}});
    expect(nodes.filter(n=>n.pointer==='#/definitions/node')).toHaveLength(1);
    expect(nodes.find(n=>n.path.endsWith('.value'))).toMatchObject({required:'本分支必填'});
    expect(nodes.find(n=>n.pointer.endsWith('/oneOf/1/properties/children/items'))?.schema.$ref).toBe('#/definitions/node');
    expect(nodes.find(n=>n.pointer.endsWith('/oneOf/1/additionalProperties'))?.schema.type).toBe('number');
    expect(nodes.some(n=>n.schema.const==='leaf')).toBe(true);
    expect(()=>referenceNodes(schema,{...authorMap,modules:{}})).toThrow('Unowned');
  });
  it('所有当前可达定义、组件和枚举都进入检索与文档，单独复制也无断链', async () => {
    const index = JSON.parse(reference.get('index.json')!);
    expect(index.semanticGaps.fields).toEqual([]);
    expect(index.semanticGaps.enums).toEqual([]);
    expect(index.semanticGaps.examples).toEqual([]);
    expect(index.semanticGaps.branches).toEqual([]);
    expect(index.branchCoverage.filter((b:any)=>b.negativeWitness)).toHaveLength(1);
    for(const example of index.exampleCoverage) {
      const document=JSON.parse(reference.get(example.file)!);
      expect(atPointer(document,example.pointer).type).toBe(example.type);
      if(example.variant!==undefined)expect(atPointer(document,example.pointer).props.variant).toBe(example.variant);
    }
    for(const [file,content] of reference)if(file.startsWith('errors/')){
      const vector=JSON.parse(content);
      expect(validate(vector.input).map(({type,path})=>({type,path})),file).toEqual(vector.expected.map(({type,path}:any)=>({type,path})));
    }
    for (const definition of Object.keys((pageSchema as Record<string, any>).definitions ?? {})) expect(index.nodes.some((n: any)=>n.pointer===`#/definitions/${definition}`)).toBe(true);
    expect(new Set(index.components.map((c:any)=>c.type))).toEqual(new Set(componentCatalog.map(c=>c.type)));
    validateReferenceLinks(new Map(reference));
    for (const module of Object.values(authorMap.modules)) for (const source of module.sources) await access(path.join(root,source));
    for (const [file, content] of reference) if (file.startsWith('examples/') && file.endsWith('.json')) expect(validate(JSON.parse(content)),file).toEqual([]);
    expect(reference.get('components/gauge.md')).toContain('mini');
    expect(reference.get('components/table.md')).toContain('children');
  });
  it('断链、缺锚点、错误JSON Pointer与未登记新定义均失败', () => {
    expect(()=>validateReferenceLinks(new Map([['README.md','[missing](outside.md)']]))).toThrow('Broken reference link');
    expect(()=>validateReferenceLinks(new Map([['README.md','[missing](README.md#no-anchor)']]))).toThrow('Missing reference anchor');
    expect(()=>atPointer({a:1},'#/missing')).toThrow('Missing JSON Pointer');
    expect(atPointer({'a/b':{'~key':1}},'#/a~1b/~0key')).toBe(1);
    expect(()=>referenceNodes({properties:{x:{$ref:'#/definitions/new'}},definitions:{new:{type:'string'}}},authorMap)).toThrow();
  });
  it('真实复制 Bundle 与独立 Skill 后，相对链接和页面样例仍独立闭合', async () => {
    const temp = await mkdtemp(path.join(tmpdir(),'page-reference-copy-'));
    try {
      await cp('metriccanvas-authoring',path.join(temp,'bundle'),{recursive:true,filter:source=>!source.split(path.sep).some(part=>['__pycache__','.venv','node_modules'].includes(part))});
      expect(bundle.skill.entrypoint).toBe('skill/metriccanvas-page-builder/SKILL.md');
      expect(skills.map(skill=>skill.id)).toEqual(['metriccanvas-page-builder','metriccanvas-platform-authoring']);
      const prefixes = ['bundle/contract-snapshot/page/reference'];
      for (const skill of skills) {
        const directory = path.dirname(skill.entrypoint);
        await cp(path.join('metriccanvas-authoring',directory),path.join(temp,skill.id),{recursive:true});
        const standalone = new Map<string,string>();
        for(const entry of await readdir(path.join(temp,skill.id),{recursive:true,withFileTypes:true})) if(entry.isFile()) {
          const absolute = path.join(entry.parentPath,entry.name);
          standalone.set(path.relative(path.join(temp,skill.id),absolute).split(path.sep).join('/'),await readFile(absolute,'utf8'));
        }
        validateReferenceLinks(standalone);
        if (skill.id === 'metriccanvas-page-builder') {
          prefixes.push(`${skill.id}/references/page-metadata`);
        } else {
          expect(standalone.has('workflows/create.md')).toBe(true);
          expect(standalone.has('workflows/edit.md')).toBe(true);
          expect([...standalone.values()].reduce((total, content) => total + content.split('\n').length, 0)).toBeLessThanOrEqual(10000);
        }
      }
      for(const prefix of prefixes) {
        const copied = new Map<string,string>();
        for(const entry of await readdir(path.join(temp,prefix),{recursive:true,withFileTypes:true})) if(entry.isFile()) {
          const absolute = path.join(entry.parentPath,entry.name);
          copied.set(path.relative(path.join(temp,prefix),absolute).split(path.sep).join('/'),await readFile(absolute,'utf8'));
        }
        expect(copied.size).toBe(reference.size);
        validateReferenceLinks(copied);
        for(const [file,content] of copied) if(file.startsWith('examples/')&&file.endsWith('.json')) expect(validate(JSON.parse(content)),file).toEqual([]);
      }
    } finally { await rm(temp,{recursive:true,force:true}); }
  });
  it('生成内容与产品、Bundle和独立Skill逐字一致' , async () => {
    for (const [file, content] of reference) for (const prefix of ['contracts/metriccanvas/page/reference','metriccanvas-authoring/contract-snapshot/page/reference',...skills.filter(skill=>skill.id === 'metriccanvas-page-builder').map(skill=>`metriccanvas-authoring/${path.dirname(skill.entrypoint)}/references/page-metadata`)]) expect(await readFile(`${prefix}/${file}`,'utf8'),`${prefix}/${file}`).toBe(content);
  });
});
