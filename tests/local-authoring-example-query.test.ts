import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildExampleIndex, findExamples, showExample } from '../tools/scripts/local-authoring-example-query';
import { jsonBytes, queryPage, SHOW_BYTES } from '../tools/scripts/local-authoring-query-budget';
import type { KnowledgeQuery, QueryKnowledge } from '../tools/scripts/local-authoring-query-types';

function examplePage(payloadSize = 0) {
  return {schemaVersion: '6.107', id: 'time-example', layout: 'dashboard', meta: {title: '时间格式 UTC+8'},
    dataSources: {
      records: {fields: {createdAt: {type: 'string', role: 'dimension'}}, source: {type: 'inline', rows: [
        {createdAt: '2026-11-09T18:30:00Z', privatePayload: 'PRIVATE_ROW_'.repeat(payloadSize)}]}},
      unrelated: {fields: {}, source: {type: 'query', query: {body: {dsl_list: [{hidden: 'UNRELATED_QUERY'}]}}}}
    },
    sections: [{id: 'main', components: [{id: 'tabs', type: 'tabContainer', props: {tabs: [{id: 'records', label: '记录', component: {
      id: 'record-table', type: 'table', data: {main: 'records'}, props: {columns: [{title: '时间', field: {
        data: 'main', field: 'createdAt', format: {type: 'time', pattern: 'YYYY-MM-DD HH:mm:ss'}}}]}
    }}]}}]}]};
}

const tableAt = '/sections/0/components/0/props/tabs/0/component';
const columnAt = tableAt + '/props/columns/0';
function fixture(payloadSize = 0) {
  const page = examplePage(payloadSize), content = JSON.stringify(page);
  const examples = buildExampleIndex(new Map([['examples/time-example.json', content], ['README.md', '# ignored']]));
  const model: QueryKnowledge = {schemaVersion: '6.107', schema: {}, topics: {}, modules: {}, nodes: [], examples};
  const read = (options: KnowledgeQuery) => showExample(model, {id: 'example:time-example', ...options}, () => page);
  return {page, content, model, read};
}

interface TextWindow {text: string; start: number; end: number; length: number}
function readTextPages(read: (options: KnowledgeQuery) => Record<string, unknown>, options: KnowledgeQuery): TextWindow[] {
  let cursor: string | undefined;
  const windows: TextWindow[] = [];
  do {
    const result = queryPage(read(options), {...options, cursor}, 'show');
    expect(jsonBytes(result)).toBeLessThanOrEqual(SHOW_BYTES);
    expect(Array.isArray(result.items)).toBe(true);
    windows.push(...result.items as TextWindow[]);
    cursor = typeof result.next === 'string' ? result.next : undefined;
    expect(result.complete).toBe(cursor === undefined);
  } while (cursor !== undefined);
  return windows;
}

describe('可复用示例渐进查询', () => {
  it.each([10_000, 20_000])('索引大示例时仅保留目录，支持按组件与用途发现 %s', payloadSize => {
    const {model, content} = fixture(payloadSize);
    expect(Buffer.byteLength(content)).toBeGreaterThan(100_000);
    expect(JSON.stringify(model.examples)).not.toContain('PRIVATE_ROW_');
    expect(model.examples?.[0]?.objects).toEqual([
      {id: 'tabs', type: 'tabContainer', path: '/sections/0/components/0'},
      {id: 'record-table', type: 'table', path: tableAt}
    ]);
    const found = findExamples(model, {owner: 'table', query: '时间格式 UTC+8'});
    expect(found.items).toHaveLength(1);
    expect(found.items).toEqual([expect.objectContaining({sourceTypes: ['inline', 'query']})]);
    expect(JSON.stringify(found)).not.toContain('UNRELATED_QUERY');
    expect(findExamples(model, {owner: 'pieChart'}).items).toEqual([]);
  });

  it('目录后读取准确片段及字段契约，不读取无关行或查询', () => {
    const {page, read} = fixture(20_000), before = JSON.stringify(page);
    expect(read({select: 'snippet'}).status).toBe('needs-context');
    expect(read({select: 'outline'})).toMatchObject({page: {schemaVersion: '6.107', id: 'time-example', layout: 'dashboard'}});
    expect(read({select: 'outline'}).items).toHaveLength(2);
    const snippet = read({select: 'snippet', at: columnAt});
    expect(snippet).toMatchObject({complete: true, value: {title: '时间', field: {field: 'createdAt', format: {type: 'time'}}}});
    const dependencies = read({select: 'dependencies', at: columnAt});
    expect(dependencies.items).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'field', role: 'understanding', field: 'createdAt', source: 'records', contract: {type: 'string', role: 'dimension'}}),
      expect.objectContaining({kind: 'source', role: 'runtime', id: 'records', type: 'inline'})
    ]));
    expect(JSON.stringify(dependencies)).not.toMatch(/PRIVATE_ROW_|UNRELATED_QUERY/);
    expect(JSON.stringify(page)).toBe(before);
  });

  it('运行依赖包含实际查询绑定、上游源、参数及缺失引用', () => {
    const {page, read} = fixture();
    Reflect.set(page.dataSources, 'records', {fields: {}, source: {type: 'query', query: {
      body: {dsl_list: [{secret: 'QUERY_BODY'}]}, filterBindings: {period: {target: 'time'}},
      paramBindings: {office: {target: 'dimension', queryField: '代表处'}},
      resultBindings: [{source: 'missing-source', field: 'id', target: 'dimension', queryField: '业务编号'}]
    }}});
    Object.assign(page, {filters: [{id: 'period', type: 'timeRange'}]});
    const result = read({select: 'dependencies', at: columnAt});
    expect(result.items).toEqual(expect.arrayContaining([
      {kind: 'filter', role: 'runtime', id: 'period', at: '/filters/0'},
      {kind: 'param', role: 'runtime', id: 'office', at: '/dataSources/records/source/query/paramBindings/office'},
      {kind: 'source', role: 'runtime', id: 'missing-source', missing: true},
      expect.objectContaining({kind: 'field', field: 'createdAt', missing: true})
    ]));
    expect(JSON.stringify(result)).not.toContain('QUERY_BODY');
  });

  it('源、行和查询不会因普通片段读取自动返回，显式数据读取可定位单元格', () => {
    const {read} = fixture(20_000);
    expect(read({select: 'snippet', at: '/dataSources/records'}).status).toBe('needs-expand');
    expect(read({select: 'snippet', at: '/dataSources/records/source/rows'})).toMatchObject({status: 'needs-selection', required: ['data']});
    expect(read({select: 'snippet', at: '/dataSources/unrelated/source/query'})).toMatchObject({status: 'needs-selection', required: ['query']});
    expect(read({select: 'data', at: '/dataSources/records/source/rows/0/createdAt'}).value).toBe('2026-11-09T18:30:00Z');
    expect(() => read({select: 'query', at: columnAt})).toThrow('requires a query position');
  });

  it('小文件中读取 source 及其父层也不会绕过查询和数据保护', () => {
    const {page, read} = fixture();
    Reflect.set(page.dataSources, 'fields', page.dataSources.unrelated);
    const positions = ['/dataSources', '/dataSources/records', '/dataSources/records/source',
      '/dataSources/unrelated', '/dataSources/unrelated/source', '/dataSources/fields/source'];
    for (const at of positions) {
      const result = read({select: 'snippet', at});
      expect(result.status).toBe('needs-expand');
      expect(JSON.stringify(result)).not.toMatch(/privatePayload|UNRELATED_QUERY|createdAt.*2026/);
    }
    expect(read({select: 'snippet', at: '/dataSources/unrelated/source/query/body'})).toMatchObject({status: 'needs-selection', required: ['query']});
  });

  it('真实时间格式示例的 source.type 标量可继续读取，源对象仍受保护', () => {
    const content = readFileSync('pages/capabilities/table/table-time-format.json', 'utf8');
    const page = JSON.parse(content);
    const examples = buildExampleIndex(new Map([['examples/table-time-format.json', content]]));
    const model: QueryKnowledge = {schemaVersion: page.schemaVersion, schema: {}, topics: {}, modules: {}, nodes: [], examples};
    const read = (at: string) => showExample(model, {id: 'example:table-time-format', select: 'snippet', at}, () => page);
    expect(read('/dataSources/records/source/type')).toMatchObject({complete: true, value: 'inline'});
    expect(read('/dataSources/records/source')).toMatchObject({status: 'needs-expand'});
    expect(read('/dataSources/records/source/rows')).toMatchObject({status: 'needs-selection', required: ['data']});
  });

  it.each(['snippet', 'data', 'query'])('长 %s 标量经预算分页无损重建，编码和源偏移保持准确', select => {
    const {page, read} = fixture(), text = '中文🙂"\\\n\t'.repeat(1000);
    Reflect.set(page.meta, 'description', text);
    Reflect.set(page.dataSources.records.source.rows[0]!, 'privatePayload', text);
    Reflect.set(page.dataSources.unrelated.source.query.body.dsl_list[0]!, 'sql', text);
    const paths: Record<string, string> = {snippet: '/meta/description',
      data: '/dataSources/records/source/rows/0/privatePayload', query: '/dataSources/unrelated/source/query/body/dsl_list/0/sql'};
    const at = paths[select]!, windows = readTextPages(read, {select, at, limit: 2});
    expect(windows.length).toBeGreaterThan(1);
    expect(windows.map(window => window.text).join('')).toBe(text);
    expect(windows[0]!.start).toBe(0);
    expect(windows.at(-1)!.end).toBe(text.length);
    windows.forEach((window, index) => {
      expect(window.length).toBe(text.length);
      expect(window.text).toBe(text.slice(window.start, window.end));
      if (index) expect(window.start).toBe(windows[index - 1]!.end);
    });
    if (select !== 'snippet') expect(read({select: 'snippet', at})).toMatchObject({status: 'needs-selection', required: [select]});
  });

  it('按实际数据位置判断 payload，同名 rows 配置与 fields 名称不串层', () => {
    const {page, read} = fixture();
    Reflect.set(page.dataSources.records.fields, 'rows', {type: 'string', role: 'dimension'});
    Reflect.set(page.sections[0]!.components[0]!.props, 'rows', [{label: '呈现配置', valueField: 'createdAt'}]);
    expect(read({select: 'snippet', at: '/dataSources/records/fields/rows'})).toMatchObject({complete: true, value: {type: 'string'}});
    expect(read({select: 'snippet', at: '/sections/0/components/0/props/rows'})).toMatchObject({complete: true, value: [{label: '呈现配置'}]});
    expect(() => read({select: 'data', at: '/sections/0/components/0/props/rows'})).toThrow('requires a data position');
  });

  it('容器内的字段按各自数据槽解析，保留祖先条件入口', () => {
    const {page, read} = fixture();
    Reflect.set(page.sections[0]!.components[0]!, 'visibleWhen', {filter: 'enabled', op: 'eq', value: true});
    const nested = read({select: 'dependencies', at: '/sections/0/components/0'});
    expect(nested.items).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'field', field: 'createdAt', source: 'records', contract: {type: 'string', role: 'dimension'}})
    ]));
    const column = read({select: 'dependencies', at: columnAt});
    expect(column.items).toEqual(expect.arrayContaining([
      {kind: 'condition', role: 'runtime', at: '/sections/0/components/0/visibleWhen'}
    ]));
    expect(JSON.stringify(nested)).not.toContain('"missing":true');
  });

  it('包含 section、选中组件自身及父容器条件，循环依赖终止并报告缺失源', () => {
    const {page, read} = fixture();
    Reflect.set(page.sections[0]!, 'visibleWhen', {filter: 'section-visible', op: 'eq', value: true});
    Reflect.set(page.sections[0]!.components[0]!, 'visibleWhen', {filter: 'tab-visible', op: 'eq', value: true});
    Reflect.set(page.dataSources, 'records', {fields: {createdAt: {type: 'string', role: 'dimension'}}, source: {
      type: 'query', query: {resultBindings: [{source: 'upstream', field: 'id'}, {source: 'missing-source', field: 'id'}]}}});
    Reflect.set(page.dataSources, 'upstream', {fields: {}, source: {type: 'query', query: {resultBindings: [{source: 'records', field: 'id'}]}}});
    const result = read({select: 'dependencies', at: '/sections/0/components/0'});
    expect(result.items).toEqual(expect.arrayContaining([
      {kind: 'condition', role: 'runtime', at: '/sections/0/visibleWhen'},
      {kind: 'condition', role: 'runtime', at: '/sections/0/components/0/visibleWhen'},
      expect.objectContaining({kind: 'source', id: 'upstream'}),
      {kind: 'source', role: 'runtime', id: 'missing-source', missing: true}
    ]));
    expect((result.items as unknown[]).filter(item => JSON.stringify(item).includes('"kind":"source"'))).toHaveLength(3);
  });

  it('动态键不能读取原型，未知参数和不适用的 branch 明确拒绝', () => {
    const {page, read, model} = fixture();
    Reflect.set(page.sections[0]!.components[0]!.props.tabs[0]!.component, 'data', {main: 'constructor'});
    const dependencies = read({select: 'dependencies', at: columnAt});
    expect(dependencies.items).toEqual(expect.arrayContaining([
      {kind: 'source', role: 'runtime', id: 'constructor', missing: true},
      expect.objectContaining({kind: 'field', field: 'createdAt', missing: true})
    ]));
    for (const at of ['/constructor', '/__proto__', '/dataSources/constructor', '/dataSources/__proto__']) {
      expect(() => read({select: 'snippet', at})).toThrow('Unknown example position');
    }
    expect(() => read({branch: 'time'})).toThrow('Unsupported example show option: branch');
    expect(() => read({owner: 'table'})).toThrow('Unsupported example show option: owner');
    expect(() => showExample(model, Object.assign({id: 'example:time-example'}, {unknown: 'x'}), () => page)).toThrow('Unsupported example show option: unknown');
    expect(() => findExamples(model, {select: 'snippet'})).toThrow('Unsupported example find option: select');
  });

  it('过大对象返回子目录，未知位置与身份错误明确失败', () => {
    const {page, read, model} = fixture();
    Object.assign(page.sections[0]!.components[0]!, {note: 'LONG_CONFIG'.repeat(500)});
    const result = read({select: 'snippet', at: '/sections/0/components/0'});
    expect(result.status).toBe('needs-expand');
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({at: '/sections/0/components/0/props'})]));
    expect(JSON.stringify(result)).not.toContain('LONG_CONFIG');
    expect(() => read({select: 'snippet', at: '/sections/9'})).toThrow('Unknown example position');
    expect(() => read({select: 'snippet', at: '/constructor'})).toThrow('Unknown example position');
    expect(() => showExample(model, {id: 'example:missing'}, () => page)).toThrow('Unknown example');
    expect(() => showExample(model, {id: 'example:time-example', select: 'outline'}, () => ({...page, id: 'wrong'}))).toThrow('identity mismatch');
  });

  it('卡片不加载全文，未提供作者条件或行为证据时不伪造验收状态', () => {
    const {model, read} = fixture();
    expect(showExample(model, {id: 'example:time-example'}, () => {throw Error('must not load');})).toMatchObject({kind: 'example'});
    expect(read({select: 'applicability'})).toMatchObject({authorConditions: 'not-provided'});
    expect(read({select: 'expectations'})).toMatchObject({status: 'not-provided', verification: {browser: 'not-provided', realData: 'not-provided'}});
  });

  it('依赖目录读完即complete，但空目录也不宣称依赖已解决或可移植', () => {
    const {page, read} = fixture();
    const regular = read({select: 'dependencies', at: columnAt});
    expect(regular).toMatchObject({complete: true, dependenciesResolved: 'not-assessed'});
    Reflect.deleteProperty(page.sections[0]!.components[0]!.props.tabs[0]!.component, 'data');
    const empty = read({select: 'dependencies', at: tableAt});
    expect(empty).toMatchObject({complete: true, dependenciesResolved: 'not-assessed', transplantReady: 'not-assessed', items: []});
    expect(empty.next).toBeUndefined();
  });

  it('片段和依赖携带实际组件owner的已登记规则，不拼入其他模块或宣称满足约束', () => {
    const {model, read} = fixture();
    model.schema.definitions = {
      unrelatedLegend: {properties: {type: {const: 'table'}}},
      customTable: {properties: {type: {const: 'table'}}}, otherWidget: {properties: {type: {const: 'pieChart'}}},
      section: {properties: {components: {items: {oneOf: [{$ref: '#/definitions/customTable'}, {$ref: '#/definitions/otherWidget'}]}}}}
    };
    model.ruleBindings = [
      {id: 'local-inputs', description: '保留此对象的输入关系', owners: ['customTable'], valid: [], invalid: []},
      {id: 'other-inputs', description: '无关对象的约束', owners: ['otherWidget'], valid: [], invalid: []}
    ];
    for (const select of ['snippet', 'dependencies']) {
      expect(read({select, at: columnAt})).toMatchObject({
        contextRules: [{id: 'rule:local-inputs', description: '保留此对象的输入关系'}], transplantReady: 'not-assessed'
      });
      expect(JSON.stringify(read({select, at: columnAt}))).not.toContain('other-inputs');
    }
    expect(read({select: 'snippet', at: '/dataSources/records/source/type'})).not.toHaveProperty('contextRules');
  });

  it('旧知识包未登记规则时保持兼容，返回空上下文规则而非补造规则', () => {
    const {read} = fixture();
    expect(read({select: 'snippet', at: columnAt})).toMatchObject({contextRules: [], transplantReady: 'not-assessed'});
  });

  it('只索引完整页面，目录顺序确定，JSON Pointer 对转义键可精确读取', () => {
    const {page} = fixture();
    const reference = new Map([['examples/fragment.json', '{"type":"table"}'], ['examples/z.json', JSON.stringify(page)], ['examples/a.json', JSON.stringify(page)]]);
    expect(buildExampleIndex(reference).map(entry => entry.id)).toEqual(['example:a', 'example:z']);
    Object.assign(page, {meta: {'a/b~c': 'escaped'}});
    const entry = buildExampleIndex(new Map([['examples/escaped.json', JSON.stringify(page)]]));
    const model: QueryKnowledge = {schemaVersion: '6.107', schema: {}, topics: {}, modules: {}, nodes: [], examples: entry};
    expect(showExample(model, {id: 'example:escaped', select: 'snippet', at: '/meta/a~1b~0c'}, () => page).value).toBe('escaped');
  });
});
