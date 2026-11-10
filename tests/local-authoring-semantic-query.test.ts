import { describe, expect, it } from 'vitest';
import { findSemantic, showSemantic } from '../tools/scripts/local-authoring-semantic-query';
import { queryKnowledge } from '../tools/scripts/local-authoring-query';
import type { KnowledgeExample, KnowledgeQuery, QueryKnowledge } from '../tools/scripts/local-authoring-query-types';

const timeFile = 'references/page-metadata/examples/time.json';
function example(id: string, file: string): KnowledgeExample {
  return { id, file, pageId: id.slice(8), title: id, layout: 'dashboard', bytes: 20, sha256: 'test', objects: [], sourceTypes: [] };
}
function model(): QueryKnowledge {
  return { schemaVersion: '6.107', schema: {}, topics: {}, nodes: [], examples: [
    example('example:time', timeFile), example('example:time-alias', timeFile),
    example('example:enum', 'references/page-metadata/examples/enum.json'),
    example('example:unlinked', 'references/page-metadata/examples/unlinked.json')
  ], modules: {
    // Source order deliberately puts incidental body matches before the actual title.
    enums: { file: 'enums.md', title: '枚举', rules: [], examples: ['references/page-metadata/examples/enum.json'],
      semantics: ['## 前端枚举\n\n时间为业务枚举标签之一。'] },
    formats: { file: 'formats.md', title: '字段格式', rules: [], examples: [timeFile], semantics: [
      '## 字段展示\n\n时间可以使用显式格式。',
      '## 时间格式与固定 UTC+8\n\n保持原始输入。',
      '## 时间精度\n\n定义秒与毫秒。'
    ] },
    unrelated: { file: 'unrelated.md', title: '其他上下文', rules: [], examples: ['elsewhere/time.json'],
      semantics: ['## 时间格式与固定 UTC+8\n\n同名段落属于另一个模块。'] }
  } };
}
function unusedLoader(): never { throw new Error('Semantic queries must not load example data'); }
function query(document: QueryKnowledge, options: KnowledgeQuery) {
  return queryKnowledge(document, 'find', { kind: 'semantic', ...options }, unusedLoader);
}

describe('示例关联范围内发现语义', () => {
  it('只用模块登记的完整文件路径精确关联，排除同名段落和相同 basename', () => {
    const result = findSemantic(model(), { example: 'example:time', query: '时间' });
    expect(result).toMatchObject({ kind: 'semantic', example: 'example:time' });
    expect(result.scope).toContain('module-level');
    expect((result.items as Array<{ owner: string }>).map(item => item.owner)).toEqual(['formats', 'formats', 'formats']);
    expect(JSON.stringify(result)).not.toMatch(/unrelated|enums|same basename/u);
    expect(findSemantic(model(), { example: 'example:time', owner: 'enums', query: '时间' }).items).toEqual([]);
  });

  it('标题命中优先于更早登记的正文偶然命中，空查询保持确定顺序', () => {
    const result = findSemantic(model(), { query: '时间' });
    const items = result.items as Array<{ title: string; owner: string }>;
    expect(items[0]!.title).toBe('时间格式与固定 UTC+8');
    expect(items.findIndex(item => item.owner === 'enums')).toBeGreaterThan(items.findIndex(item => item.title === '时间精度'));
    expect((findSemantic(model(), {}).items as Array<{ id: string }>).map(item => item.id)).toEqual([
      'semantic:enums:0', 'semantic:formats:0', 'semantic:formats:1', 'semantic:formats:2', 'semantic:unrelated:0'
    ]);
  });

  it('语义匹配仍在关联范围内按 query 筛选，不把模块关系说成段落关系', () => {
    const result = findSemantic(model(), { example: 'example:time', query: '毫秒' });
    expect(result.items).toEqual([expect.objectContaining({ id: 'semantic:formats:2', title: '时间精度' })]);
    expect(findSemantic(model(), { example: 'example:time', query: '枚举标签' }).items).toEqual([]);
  });

  it('缺少登记关联不回退全局或按示例 id 猜模块，未知 id 明确报错', () => {
    const result = findSemantic(model(), { example: 'example:unlinked', query: '时间' });
    expect(result.items).toEqual([]);
    expect(result.scope).toContain('registered examples');
    expect(() => findSemantic(model(), { example: 'example:missing', query: '时间' })).toThrow('Unknown example');
  });

  it('新参数只允许无目标文档的 semantic find', () => {
    const document = model();
    for (const kind of ['schema', 'example', 'guide', 'rule', 'component'] as const) {
      expect(() => queryKnowledge(document, 'find', { kind, example: 'example:time' }, unusedLoader)).toThrow('only accepted');
    }
    expect(() => queryKnowledge(document, 'find', { example: 'example:time' }, unusedLoader)).toThrow('only accepted');
    expect(() => queryKnowledge(document, 'show', { id: 'semantic:formats:1', example: 'example:time' }, unusedLoader)).toThrow('only accepted');
    expect(() => queryKnowledge(document, 'find', { kind: 'semantic', example: 'example:time' }, unusedLoader, { document: {} })).toThrow('only accepted');
    expect(() => showSemantic(document, { id: 'semantic:formats:1', example: 'example:time' })).toThrow('accepts');
  });

  it('游标绑定 example 与 query，即使两个示例登记的是同一个文件也不可互换', () => {
    const document = model(), options = { example: 'example:time', query: '时间', limit: 1 };
    const first = query(document, options);
    expect(first.total).toBe(3);
    expect(first.next).toEqual(expect.any(String));
    expect(query(document, { ...options, cursor: String(first.next) }).offset).toBe(1);
    expect(() => query(document, { ...options, example: 'example:time-alias', cursor: String(first.next) })).toThrow('Stale');
    expect(() => query(document, { ...options, query: '毫秒', cursor: String(first.next) })).toThrow('Stale');
  });
});
