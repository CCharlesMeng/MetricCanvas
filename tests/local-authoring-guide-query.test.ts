import { describe, expect, it } from 'vitest';
import { buildExampleGuides, exampleGuideText } from '../tools/scripts/local-authoring-example-guides';
import { buildExampleIndex, findExamples, showExample } from '../tools/scripts/local-authoring-example-query';
import { findGuides, showGuide } from '../tools/scripts/local-authoring-guide-query';
import { FIND_BYTES, SHOW_BYTES, jsonBytes, queryPage } from '../tools/scripts/local-authoring-query-budget';
import type { KnowledgeQuery, QueryKnowledge, QueryResult } from '../tools/scripts/local-authoring-query-types';

function fixture(repeats = 1) {
  const content = JSON.stringify({schemaVersion: '6.107', id: 'sample', layout: 'dashboard', meta: {title: '示例'},
    dataSources: {records: {fields: {}, source: {type: 'inline', rows: [{private: 'PRIVATE_ROW'}]}}},
    sections: [{id: 'main', components: [{id: 'table', type: 'table', props: {}}, {id: 'pie', type: 'pieChart', props: {}}]}]});
  const prose = '先选择类别，再切换 Tab 和翻页，最后导出；未知业务编码另验。中文🙂"\\\n\t'.repeat(repeats);
  const readme = `## 分类显示\n\n<!-- example-guide: task=labels; page=sample; components=table; verified=structure,sim -->\n\n入口 /pages/sample\n\n复用用途：将原始编码显示成业务标签。\n\n参考对象：table 的字段及数据槽。\n\n移植边界：保留分页及筛选关系，不复制合成数据。\n\n可观察预期与环境：${prose}\n`;
  const examples = buildExampleIndex(new Map([['examples/sample.json', content]]));
  const index = buildExampleGuides(new Map([['pages/demo/README.md', readme]]), new Map([['examples/sample.json', content]]));
  examples[0]!.guides = index.byPageId.get('sample');
  const model: QueryKnowledge = {schemaVersion: '6.107', schema: {}, topics: {}, modules: {}, nodes: [], examples};
  const guide = examples[0]!.guides![0]!;
  let reads = 0;
  const read = () => { reads++; return index.references.get(guide.content.file)!; };
  return {model, guide, index, read, reads: () => reads};
}

function pagedText(model: QueryKnowledge, id: string, read: () => string): string {
  const windows: Array<{text: string; start: number; end: number; length: number}> = [];
  let cursor: string | undefined;
  do {
    const options: KnowledgeQuery = {id, select: 'expectations', limit: 2, cursor};
    const page = queryPage(showGuide(model, options, read), options, 'show');
    expect(jsonBytes(page)).toBeLessThanOrEqual(SHOW_BYTES);
    expect(page.status).toBe('provided');
    windows.push(...page.items as typeof windows);
    cursor = typeof page.next === 'string' ? page.next : undefined;
    expect(page.complete).toBe(cursor === undefined);
  } while (cursor);
  const text = windows.map(window => window.text).join('');
  windows.forEach((window, index) => {
    expect(window.text).toBe(text.slice(window.start, window.end));
    expect(window.length).toBe(text.length);
    if (index) expect(window.start).toBe(windows[index - 1]!.end);
  });
  return text;
}

describe('渐进任务指南查询', () => {
  it('按任务关键词及焦点组件类型发现，不读正文、不泄露业务行', () => {
    const {model, read, reads} = fixture();
    const found = findGuides(model, {kind: 'guide', owner: 'table', query: '业务标签 分页'});
    expect(found.items).toHaveLength(1);
    expect(findGuides(model, {owner: 'pieChart'}).items).toEqual([]);
    expect(findGuides(model, {query: '不存在'}).items).toEqual([]);
    expect(JSON.stringify(found)).not.toMatch(/PRIVATE_ROW|切换 Tab/);
    expect(jsonBytes(queryPage(found, {kind: 'guide', owner: 'table'}, 'find'))).toBeLessThanOrEqual(FIND_BYTES);
    expect(showGuide(model, {id: 'guide:sample:labels'}, read)).toMatchObject({
      available: ['purpose', 'references', 'boundary', 'expectations'],
      fields: {purpose: 'provided'}, lifecycle: 'candidate', verified: ['structure', 'sim'],
      verification: {basis: 'author-declared', current: 'not-assessed'}
    });
    expect(reads()).toBe(0);
  });

  it('完整原文经预算与游标多页无损返回，作者声明不变成本轮验收', () => {
    const {model, guide, read, index} = fixture(500);
    const expected = exampleGuideText(guide, 'expectations', index.references.get(guide.content.file)!);
    expect(pagedText(model, guide.id, read)).toBe(expected);
    const result = showGuide(model, {id: guide.id, select: 'expectations'}, read);
    expect(result.verification).toEqual({basis: 'author-declared', current: 'not-assessed'});
    expect(result.verified).toEqual(['structure', 'sim']);
    expect(() => showGuide(model, {id: guide.id, select: 'purpose'}, () => 'changed')).toThrow('content mismatch');
  });

  it('未维护的角色明确 not-provided，不调用加载器也不宣称规则完整', () => {
    const {model, guide, read, reads} = fixture();
    guide.fields.boundary = {status: 'not-provided', summary: '', passages: []};
    const result = queryPage(showGuide(model, {id: guide.id, select: 'boundary'}, read), {id: guide.id, select: 'boundary'}, 'show');
    expect(result).toMatchObject({status: 'not-provided', complete: false, items: []});
    expect(reads()).toBe(0);
    expect(String(result.scope)).toContain('protocol rules');
  });

  it('示例发现能命中指南用途和边界，短卡与指南目录不带长正文', () => {
    const {model, guide} = fixture(500);
    const result = findExamples(model, {owner: 'table', query: '业务标签 分页'});
    expect(result.items).toEqual([expect.objectContaining({id: 'example:sample', guideCount: 1})]);
    const unread = () => { throw new Error('Page should stay local'); };
    const directory = showExample(model, {id: 'example:sample', select: 'guides'}, unread);
    expect(directory.items).toEqual([expect.objectContaining({id: guide.id, lifecycle: 'candidate'})]);
    for (const select of ['applicability', 'expectations']) {
      const response = showExample(model, {id: 'example:sample', select}, unread);
      expect(response.items).toEqual([expect.objectContaining({id: guide.id,
        verified: ['structure', 'sim'], verification: {basis: 'author-declared', current: 'not-assessed'}})]);
      expect(JSON.stringify(response)).not.toContain('最后导出');
      expect(jsonBytes(queryPage(response, {id: 'example:sample', select}, 'show'))).toBeLessThanOrEqual(SHOW_BYTES);
    }
  });

  it('没有指南的示例保持旧适用性与预期响应', () => {
    const {model} = fixture();
    delete model.examples![0]!.guides;
    const unread = () => { throw new Error('Page should stay local'); };
    expect(showExample(model, {id: 'example:sample', select: 'applicability'}, unread)).toEqual({
      id: 'example:sample', layout: 'dashboard', sourceTypes: ['inline'], authorConditions: 'not-provided',
      required: ['Verify target field types, query scope and interaction prerequisites'], source: 'references/page-metadata/examples/sample.json'
    });
    expect(showExample(model, {id: 'example:sample', select: 'expectations'}, unread)).toEqual({
      id: 'example:sample', status: 'not-provided', source: 'references/page-metadata/examples/sample.json',
      verification: {schema: 'not-run-by-reader', browser: 'not-provided', export: 'not-provided', realData: 'not-provided'}
    });
    expect(findGuides(model, {}).items).toEqual([]);
  });

  it.each([
    {select: 'unknown'}, {at: '/sections/0'}, {owner: 'table'}, {query: 'business'}, {branch: 'x'}, {kind: 'example'}
  ] satisfies KnowledgeQuery[])('拒绝不受支持的指南 show 参数 %s', options => {
    const {model, guide, read} = fixture();
    expect(() => showGuide(model, {id: guide.id, ...options}, read)).toThrow(/guide/i);
  });

  it('未知指南和 find 的 facet 参数不会静默降级', () => {
    const {model, read} = fixture();
    expect(() => showGuide(model, {id: 'guide:missing'}, read)).toThrow('Unknown guide');
    expect(() => findGuides(model, {select: 'purpose'})).toThrow('Unsupported guide find');
    expect(() => findGuides(model, {kind: 'example'})).toThrow('require kind guide');
    expect(() => findGuides(model, {id: 'guide:sample:labels'})).toThrow('Unsupported guide find');
  });

  it('多个指南卡经 find 预算可继续分页，不用裁剪正文或遗漏指南', () => {
    const {model, guide} = fixture();
    model.examples![0]!.guides = Array.from({length: 30}, (_, index) => ({...guide, id: `guide:sample:task-${index}`}));
    const response: QueryResult = findGuides(model, {});
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = queryPage(response, {kind: 'guide', cursor}, 'find');
      expect(jsonBytes(page)).toBeLessThanOrEqual(FIND_BYTES);
      ids.push(...(page.items as Array<{id: string}>).map(item => item.id));
      cursor = typeof page.next === 'string' ? page.next : undefined;
    } while (cursor);
    expect(new Set(ids).size).toBe(30);
  });
});
