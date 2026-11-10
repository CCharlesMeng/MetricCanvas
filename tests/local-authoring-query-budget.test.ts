import { describe, expect, it } from 'vitest';
import { jsonBytes, queryPage } from '../tools/scripts/local-authoring-query-budget';
import { buildPassageIndex, findSemantic, showSemantic } from '../tools/scripts/local-authoring-semantic-query';
import type { QueryKnowledge } from '../tools/scripts/local-authoring-query-types';
import { queryKnowledge } from '../tools/scripts/local-authoring-query';

describe('small incremental knowledge responses', () => {
  it('pages all items within the wire budget and binds cursors to request and content', () => {
    const items = Array.from({length: 20}, (_, index) => ({id: String(index), title: '知识'.repeat(40)}));
    const request = {kind: 'schema' as const, query: 'format', limit: 30};
    const result = {kind: 'schema', items};
    const actual: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = queryPage(result, {...request, cursor}, 'find');
      expect(jsonBytes(page)).toBeLessThanOrEqual(1024);
      actual.push(...page.items as unknown[]);
      cursor = page.next as string | undefined;
    } while (cursor);
    expect(actual).toEqual(items);
    const first = queryPage(result, request, 'find');
    const reordered = queryPage(result, {cursor:String(first.next),limit:30,query:'format',kind:'schema'}, 'find');
    expect(reordered.offset).toBe((first.items as unknown[]).length);
    expect(() => queryPage(result, {...request, query: 'changed', cursor: String(first.next)}, 'find')).toThrow('Stale');
    expect(() => queryPage({...result, items: items.slice(1)}, {...request, cursor: String(first.next)}, 'find')).toThrow('Stale');
    const versioned = queryPage(result, request, 'find', 'knowledge-v1');
    expect(() => queryPage(result, {...request, cursor: String(versioned.next)}, 'find', 'knowledge-v2')).toThrow('Stale');
  });

  it('does not pretend an oversized atom was emitted or return an infinite same-position cursor', () => {
    const item = {id: 'huge', pointer: '/long', text: '大'.repeat(2000)};
    const response = queryPage({id: 'example:big', items: [item]}, {}, 'show');
    expect(response.status).toBe('needs-expand');
    expect(response.complete).toBe(false);
    expect(response.next).toBeUndefined();
    expect(response.target).toEqual({id: 'huge', pointer: '/long'});
    expect(JSON.stringify(response)).not.toContain(item.text);
    expect(jsonBytes(response)).toBeLessThanOrEqual(2048);
  });

  it('rejects a previous knowledge edition cursor even when this selected result stayed unchanged', () => {
    const model: QueryKnowledge = {schemaVersion:'6.107',schema:{},topics:{},nodes:[],modules:{},ruleBindings:[
      {id:'one',description:'First rule',owners:['table'],valid:[],invalid:[]},
      {id:'two',description:'Second rule',owners:['table'],valid:[],invalid:[]}
    ]};
    const options = {kind:'rule' as const,limit:1};
    const load = () => {throw new Error('Rules must not load an example');};
    const first = queryKnowledge(model,'find',options,load);
    model.schemaVersion='6.108';
    expect(()=>queryKnowledge(model,'find',{...options,cursor:String(first.next)},load)).toThrow('Stale');
  });

  it('retains incomplete dependency and refinement states even on an empty or final page', () => {
    const empty = queryPage({status: 'needs-expand', items: []}, {}, 'show');
    expect(empty.complete).toBe(false);
    const dependencies = queryPage({complete: false, items: [{id: 'runtime-source'}]}, {}, 'show');
    expect(dependencies.complete).toBe(false);
    expect(dependencies.next).toBeUndefined();
  });

  it('gives precise child positions for explicitly selected large payload objects', () => {
    const result = {id: 'example:big', at:'/dataSources/main/source/query', value:{body:{rows:'保留'.repeat(2000)}, language:'dqe'}};
    const page = queryPage(result, {}, 'show');
    expect(page.status).toBe('needs-expand');
    expect(page.complete).toBe(false);
    expect(page.items).toEqual([
      {at:'/dataSources/main/source/query/body',type:'object',bytes:jsonBytes(result.value.body)},
      {at:'/dataSources/main/source/query/language',type:'string',bytes:jsonBytes('dqe')}
    ]);
    expect(JSON.stringify(page)).not.toContain(result.value.body.rows);
    expect(jsonBytes(page)).toBeLessThanOrEqual(2048);
  });

  it('can discover new semantics outside an old curated topic and reconstruct every original character', () => {
    const text = '## 时间格式与 UTC+8\n\n' + '转换😀保留输入。'.repeat(700) + '\n\n```json\n{"pattern":"HH:mm:ss"}\n```';
    const model: QueryKnowledge = {schemaVersion: '6.107', schema: {}, topics: {}, nodes: [],
      modules: {formats: {file: 'formats.md', title: 'Formats', semantics: [text], rules: [], examples: []}}};
    model.passages = buildPassageIndex(model);
    const found = findSemantic(model, {query: 'UTC+8'});
    expect((found.items as unknown[]).length).toBeGreaterThan(0);
    expect((found.items as Array<{preview:string}>)[0]!.preview.length).toBeGreaterThan(0);
    const result = showSemantic(model, {id: 'semantic:formats:0', select: 'text'});
    const parts: Array<{text: string}> = [];
    let cursor: string | undefined;
    do {
      const page = queryPage(result, {id: 'semantic:formats:0', select: 'text', cursor}, 'show');
      expect(jsonBytes(page)).toBeLessThanOrEqual(2048);
      parts.push(...page.items as Array<{text: string}>);
      cursor = page.next as string | undefined;
    } while (cursor);
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(model.passages.some(passage => text.slice(passage.start, passage.end).includes('```json\n'))).toBe(true);
  });

  it('fails invalid cursors and unknown semantic resources explicitly', () => {
    expect(() => queryPage({items: []}, {cursor: 'malformed'}, 'find')).toThrow('cursor');
    const model: QueryKnowledge = {schemaVersion: '6', schema: {}, topics: {}, nodes: [], modules: {}};
    expect(() => showSemantic(model, {id: 'semantic:missing:0'})).toThrow('Unknown semantic');
    expect(() => showSemantic(model, {id: 'semantic:missing:0', at:'/ignored'})).toThrow('accepts');
  });
});
