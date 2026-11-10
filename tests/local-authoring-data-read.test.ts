import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPageData } from '../metriccanvas-authoring/core/page/data-read';
import { readLocalPage, validateDataReadCommand } from '../tools/scripts/local-authoring-data-read';
import { hashBytes } from '../tools/scripts/local-authoring-data-analysis';
import { scanPageData } from '../metriccanvas-authoring/core/page/data-scan';
import { scopePageData } from '../metriccanvas-authoring/core/page/data-scope';

type Json = Record<string, any>;
const schema = JSON.parse(readFileSync('metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/schema.json', 'utf8'));
const tableAt = '/sections/0/components/0';
function page(payload = 200_000): Json {
  return { schemaVersion: '6.107', id: 'test', layout: 'dashboard',
    filters: [{ id: 'irrelevant', label: 'PRIVATE_FILTER' }], params: [{ id: 'irrelevant', value: 'PRIVATE_PARAM' }],
    dataSources: {
      main: { fields: { id: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure', unit: '元', defaultFormat: 'number-2', nullable: true } }, source: { type: 'inline', rows: [{ id: 'A', amount: null }, { id: 'B', amount: 12.56 }] } },
      unrelated: { fields: { text: { type: 'string', role: 'dimension' } }, source: { type: 'inline', rows: [{ text: 'PRIVATE_PAYLOAD'.repeat(payload) }] } }
    }, sections: [{ components: [
      { id: 'same', type: 'table', data: { main: 'main' }, props: { columns: [{ field: 'id' }, { field: { data: 'main', field: 'amount' }, title: '金额' }] } },
      { id: 'other', type: 'metricCard', data: { main: 'main' }, props: { rows: [{ label: '金额', valueField: 'amount' }] } }
    ] }] };
}
function read(document: Json, args: Record<string, string[]>): Json {
  return readLocalPage(document, schema, { '--at': [tableAt], ...args }, hashBytes(JSON.stringify(document)), hashBytes(JSON.stringify(schema)));
}
function facet(document: Json, select: string, extra: Record<string, string[]> = {}): Json {
  return read(document, { '--select': [select], ...extra });
}
function withoutIdentity(value: Json): Json {
  const { pageSha256: _page, next: _cursor, ...facts } = value;
  return facts;
}

describe('已有scan的有预算局部读取', () => {
  it.each(['config', 'bindings', 'fields', 'consumers'])('%s无关载荷增长不改变事实、预算或输入', select => {
    const small = page(1), large = page(), before = JSON.stringify(large);
    const result = facet(large, select);
    expect(withoutIdentity(result)).toEqual(withoutIdentity(facet(small, select)));
    expect(Buffer.byteLength(JSON.stringify(result)) + 1).toBeLessThanOrEqual(2048);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PAYLOAD|PRIVATE_FILTER|PRIVATE_PARAM/);
    expect(JSON.stringify(large)).toBe(before);
  });
  it('字段契约按白名单读取，实际槽和共享消费者独立返回', () => {
    const document = page();
    expect(facet(document, 'fields', { '--field': ['amount'] }).items).toEqual([
      expect.objectContaining({ source: 'main', field: 'amount', contract: { type: 'number', role: 'measure', unit: '元', defaultFormat: 'number-2', nullable: true } })
    ]);
    expect(facet(document, 'bindings').items).toContainEqual(expect.objectContaining({ source: 'main', slot: 'main', field: 'amount', at: tableAt + '/props/columns/1/field' }));
    expect(facet(document, 'consumers').items).toEqual([
      { componentId: 'same', type: 'table', at: tableAt }, { componentId: 'other', type: 'metricCard', at: '/sections/0/components/1' }
    ]);
  });
  it('重名id不能猜，实际路径和子配置不受重排影响', () => {
    const document = page();document.sections[0].components[1].id = 'same';
    expect(() => readLocalPage(document, schema, { '--component': ['same'], '--select': ['fields'] }, 'p', 's')).toThrow('ambiguous');
    expect(facet(document, 'fields', { '--at': [tableAt + '/props/columns/1'], '--field': ['amount'] }).items).toHaveLength(1);
    document.sections.unshift({ components: [{ id: 'notes', type: 'text', props: { body: 'unrelated' } }] });
    expect(read(document, { '--at': ['/sections/1/components/0'], '--select': ['fields'], '--field': ['amount'] }).items).toHaveLength(1);
  });
  it.each(['/dataSources/main/source/rows', '/sections/0/components/00', '/sections/0/components/0/props/missing', '/sections/0/components/0/props/~2'])('拒绝非组件或不合法位置%s', at => {
    expect(() => facet(page(), 'config', { '--at': [at] })).toThrow(TypeError);
  });
  it('未知字段/来源、跨组件范围或错参数不静默回退', () => {
    expect(() => facet(page(), 'fields', { '--field': ['missing'] })).toThrow('Unknown selected field');
    expect(() => facet(page(), 'fields', { '--source': ['unrelated'] })).toThrow('outside');
    expect(() => facet(page(), 'bindings', { '--field': ['missing'] })).toThrow('Unknown selected field');
    expect(() => facet(page(), 'bogus')).toThrow('Unknown');
    expect(() => facet(page(), 'consumers', { '--field': ['amount'] })).toThrow('--field');
  });
  it('配置收窄后可读，长标量和大字段契约可完整分页重建', () => {
    const document = page();document.sections[0].components[0].props.caption = '长文😀'.repeat(800);
    const directory = facet(document, 'config');
    expect(directory.status).toBe('needs-expand');
    const args = { '--at': [tableAt + '/props/caption'], '--select': ['config'] };
    const parts: Json[] = [];let cursor: string | undefined;
    do { const result = read(document, { ...args, ...(cursor ? { '--cursor': [cursor] } : {}) });parts.push(...result.items);cursor = result.next; } while (cursor);
    expect(parts.map(part => part.text).join('')).toBe(document.sections[0].components[0].props.caption);
    document.dataSources.main.fields.amount.label = '字段长标签'.repeat(300);
    const contracts: Json[] = [];cursor = undefined;
    do { const result = facet(document, 'fields', { '--field': ['amount'], ...(cursor ? { '--cursor': [cursor] } : {}) });expect(Buffer.byteLength(JSON.stringify(result)) + 1).toBeLessThanOrEqual(2048);contracts.push(...result.items);cursor = result.next; } while (cursor);
    expect(JSON.parse(contracts.map(part => part.text).join(''))).toEqual(document.dataSources.main.fields.amount);
  });
  it('超预算列目录包含有限身份，不必逐列读取正文才能定位', () => {
    const document = page();
    document.sections[0].components[0].props.columns = Array.from({ length: 30 }, (_, index) => ({ title: '列' + index, field: { data: 'main', field: 'amount' }, description: 'PRIVATE_COLUMN_BODY'.repeat(200) }));
    const result = facet(document, 'config', { '--at': [tableAt + '/props/columns'] });
    expect(result.status).toBe('needs-expand');
    expect(result.items[0]).toMatchObject({ at: tableAt + '/props/columns/0', title: '列0', field: 'amount' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_COLUMN_BODY');
  });
  it('分页绑定文档、schema、字段选择及方面', () => {
    const document = page(), first = facet(document, 'fields', { '--limit': ['1'] });
    expect(first.next).toEqual(expect.any(String));
    expect(facet(document, 'fields', { '--limit': ['1'], '--cursor': [first.next] }).offset).toBe(1);
    document.dataSources.unrelated.source.rows.push({ text: 'changed' });
    expect(() => facet(document, 'fields', { '--limit': ['1'], '--cursor': [first.next] })).toThrow('Stale');
    expect(() => facet(page(), 'bindings', { '--limit': ['1'], '--cursor': [first.next] })).toThrow('Stale');
    expect(() => readLocalPage(page(), schema, { '--at': [tableAt], '--select': ['fields'], '--limit': ['1'], '--cursor': [first.next] }, hashBytes(JSON.stringify(page())), 'changed-schema')).toThrow('Stale');
  });
  it('样本必须显式声明范围、数量，保留空值且不执行查询', () => {
    const document = page();
    expect(() => facet(document, 'samples')).toThrow('requires explicit');
    const samples = facet(document, 'samples', { '--source': ['main'], '--field': ['amount'], '--limit': ['2'] });
    expect(samples).toMatchObject({ origin: 'declared-inline', execution: 'not-run', items: [{ index: 0, values: { amount: null } }, { index: 1, values: { amount: 12.56 } }] });
    document.dataSources.main.source = { type: 'query', query: { body: 'PRIVATE_QUERY' } };
    expect(facet(document, 'samples', { '--source': ['main'], '--field': ['amount'], '--limit': ['2'] })).toMatchObject({ status: 'not-available', execution: 'not-run' });
    document.dataSources.main.source.initial = [{ amount: 1 }];
    expect(facet(document, 'samples', { '--source': ['main'], '--field': ['amount'], '--limit': ['1'] })).toMatchObject({ origin: 'source-initial', execution: 'not-run' });
  });
  it('长样本只回可见元信息，不打印嵌套记录或长字符串', () => {
    const document = page();document.dataSources.main.source.rows = [{ id: 'PRIVATE_LONG'.repeat(20_000), amount: { body: 'PRIVATE_NESTED' } }];
    const result = facet(document, 'samples', { '--source': ['main'], '--field': ['id', 'amount'], '--limit': ['1'] });
    expect(result.complete).toBe(false);
    expect(result.items[0].values.id).toMatchObject({ status: 'omitted', type: 'string' });
    expect(result.items[0].values.amount).toMatchObject({ status: 'omitted', type: 'object' });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_LONG|PRIVATE_NESTED/);
  });
  it('危险契约键不进入字段事实，配置不能读取rows或query正文', () => {
    const document = page();Object.assign(document.dataSources.main.fields.amount, { rows: ['PRIVATE_FIELD'], query: { body: 'PRIVATE_QUERY' } });
    expect(JSON.stringify(facet(document, 'fields'))).not.toMatch(/PRIVATE_FIELD|PRIVATE_QUERY/);
    document.sections[0].components[0].props.source = { rows: [{ text: 'PRIVATE_CONFIG' }], query: { body: 'PRIVATE_QUERY' } };
    expect(JSON.stringify(facet(document, 'config'))).not.toMatch(/PRIVATE_CONFIG|PRIVATE_QUERY/);
    expect(JSON.stringify(facet(document, 'config', { '--at': [tableAt + '/props/source/query'] }))).not.toContain('PRIVATE_QUERY');
    expect(() => facet(document, 'config', { '--at': [tableAt + '/props/source/rows'] })).toThrow('payload');
  });
  it('同名rows/initial/body按实际位置区分，保留指标卡配置与导航参数', () => {
    const document = page(), cardAt = '/sections/0/components/1';
    const rows = document.sections[0].components[1].props.rows;
    expect(read(document, { '--at': [cardAt + '/props/rows'], '--select': ['config'] }).value).toEqual(rows);
    document.sections[0].components[1].props.initial = '合法初始配置';
    expect(read(document, { '--at': [cardAt + '/props/initial'], '--select': ['config'] }).value).toBe('合法初始配置');
    document.sections[0].components[0].props.navigate = { query: { body: { source: 'row', field: 'id' } } };
    expect(facet(document, 'config', { '--at': [tableAt + '/props/navigate/query/body'] }).value).toEqual({ source: 'row', field: 'id' });
    document.sections[0].components[0].props.source = { type: 'inline', rows: [{ secret: 'PRIVATE_EMBEDDED' }], initial: [{ secret: 'PRIVATE_INITIAL' }] };
    expect(JSON.stringify(facet(document, 'config', { '--at': [tableAt + '/props/source'] }))).not.toMatch(/PRIVATE_EMBEDDED|PRIVATE_INITIAL/);
  });
  it('异常字符串data槽不按字符猜来源，原始扫描诊断不进入局部输出', () => {
    const document = page();document.sections[0].components[0].data = 'main';
    document.dataSources.m = { fields: { confidential: { type: 'string', role: 'dimension' } }, source: { type: 'inline', rows: [{ confidential: 'PRIVATE_CHAR_SOURCE' }] } };
    const result = facet(document, 'fields');
    expect(result.items).toEqual([]);
    expect(facet(document, 'bindings').items).not.toContainEqual(expect.objectContaining({ source: 'm' }));
    expect(result).toMatchObject({ status: 'unresolved', complete: false });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PAYLOAD');
    document.sections[0].components[0].data = { main: ['unrelated'] };
    expect(facet(document, 'fields').items).toEqual([]);
  });
  it('每个方面提供有界页面身份，绑定首页先显示相关来源类型', () => {
    const document = page();
    const result = facet(document, 'bindings');
    expect(result.page).toEqual({ id: 'test', schemaVersion: '6.107', layout: 'dashboard' });
    expect(result.items[0]).toEqual({ kind: 'source', id: 'main', type: 'inline' });
    document.dataSources.main.source = { type: 'query', query: { body: 'PRIVATE_QUERY_BODY' } };
    const query = facet(document, 'bindings');
    expect(query.items[0]).toEqual({ kind: 'source', id: 'main', type: 'query' });
    expect(JSON.stringify(query)).not.toContain('PRIVATE_QUERY_BODY');
    document.id = 'PRIVATE_PAGE_ID'.repeat(100_000);document.meta = { body: 'PRIVATE_META' };
    const bounded = facet(document, 'fields');
    expect(bounded.page).toEqual({ schemaVersion: '6.107', layout: 'dashboard', status: 'partial' });
    expect(Buffer.byteLength(JSON.stringify(bounded)) + 1).toBeLessThanOrEqual(2048);
    expect(JSON.stringify(bounded)).not.toMatch(/PRIVATE_PAGE_ID|PRIVATE_META/);
  });
  it('缺失或无类型来源明确标为unknown与未完整，不猜inline', () => {
    const document = page();delete document.dataSources.main;
    const missing = facet(document, 'bindings');
    expect(missing.items[0]).toEqual({ kind: 'source', id: 'main', type: 'unknown', status: 'unknown' });
    expect(missing).toMatchObject({ status: 'unresolved', complete: false });
    document.dataSources.main = { fields: { amount: { type: 'number', role: 'measure' } } };
    const untyped = facet(document, 'bindings');
    expect(untyped.items[0]).toMatchObject({ type: 'unknown', status: 'unknown' });
    expect(untyped.complete).toBe(false);
  });
  it('字符同名来源不能使异常data成为共享消费者，非法图形状明确未解决', () => {
    const document = page();
    document.dataSources.m = structuredClone(document.dataSources.main);
    document.sections[0].components[0].data = { main: 'm' };
    document.sections[0].components.push(
      { id: 'fake-string', type: 'table', data: 'main', props: { columns: [{ field: 'amount' }] } },
      { id: 'fake-array', type: 'table', data: { main: ['m'] }, props: { columns: [{ field: 'amount' }] } }
    );
    expect(facet(document, 'consumers').items).toEqual([{ componentId: 'same', type: 'table', at: tableAt }]);
    document.dataSources.m.source = { type: 'query', query: { resultBindings: { source: 'unrelated' } } };
    const partial = facet(document, 'bindings');
    expect(partial.items[0]).toMatchObject({ kind: 'source', id: 'm', type: 'query' });
    expect(partial).toMatchObject({ status: 'unresolved', complete: false });
    expect(partial.unresolved).toContainEqual({ type: 'UNRESOLVED_SOURCE_GRAPH', source: 'm' });
    expect(JSON.stringify(partial)).not.toContain('PRIVATE_PAYLOAD');
  });
  it('真实多来源导航按Schema识别行绑定，不把row判别值当来源', () => {
    const document = JSON.parse(readFileSync('pages/capabilities/navigation/table-multi-source-navigation.json', 'utf8'));
    const scan = scanPageData(document, schema);
    const navPath = '/sections/0/components/1/props/columns/4/navigate/query/project-name';
    expect(scan.uses).toContainEqual(expect.objectContaining({ path: navPath, kind: 'row-input', bindingRole: 'navigation', slot: 'main', source: 'stages', field: 'project-name' }));
    expect(scan.uses).not.toContainEqual(expect.objectContaining({ kind: 'source-field', source: 'row' }));
    expect(scan.diagnostics.filter(diagnostic => ['UNKNOWN_FIELD', 'UNKNOWN_SOURCE'].includes(diagnostic.type))).toEqual([]);
    const result = read(document, { '--at': ['/sections/0/components/1'], '--select': ['bindings'] });
    expect(result.items.filter((item:Json) => item.kind === 'source').map((item:Json) => item.id)).toEqual(['stages', 'basic', 'headcount']);
    expect(result.status).not.toBe('unresolved');
  });
  it('真实名为row的数据源仍保留，导航filter/param只产生其实际角色', () => {
    const document = JSON.parse(readFileSync('pages/capabilities/navigation/table-multi-source-navigation.json', 'utf8'));
    document.dataSources.row = document.dataSources.stages;delete document.dataSources.stages;
    const table = document.sections[0].components[1];table.data.main = 'row';
    table.props.columns[4].navigate.query = { project: { source: 'row', field: 'project-name' }, scope: { source: 'filter', id: 'region', part: 'value' }, office: { source: 'param', id: 'office' } };
    document.sections[0].components.push({ id: 'summary', type: 'aiSummary', layout: { span: 12 }, props: { relatedDataSources: ['row'] } });
    const scan = scanPageData(document, schema), nav = '/sections/0/components/1/props/columns/4/navigate/query';
    expect(scan.uses).toContainEqual(expect.objectContaining({ source: 'row', field: 'project-name', path: nav + '/project', bindingRole: 'navigation' }));
    expect(scan.uses).toContainEqual(expect.objectContaining({ componentId: 'summary', source: 'row', kind: 'related-data', field: 'project-name' }));
    expect(scan.uses).toContainEqual(expect.objectContaining({ path: nav + '/scope', kind: 'filter-reference', declaration: { filterId: 'region' }, bindingRole: 'navigation' }));
    expect(scan.uses).toContainEqual(expect.objectContaining({ path: nav + '/office', kind: 'param-reference', declaration: { paramId: 'office' }, bindingRole: 'navigation' }));
    expect(scan.uses.filter(use => [nav + '/scope', nav + '/office'].includes(use.path)).every(use => use.field === undefined && use.source === undefined)).toBe(true);
    expect(scan.diagnostics.filter(diagnostic => diagnostic.type === 'UNKNOWN_FIELD')).toEqual([]);
    const bindings = read(document, { '--at': ['/sections/0/components/1'], '--select': ['bindings'] });
    expect(bindings.items.filter((item:Json) => item.kind === 'source').map((item:Json) => item.id)).toContain('row');
  });
  it('旧scan与完整报告命令保持原范围，新选项仅scan可用', () => {
    const document = page(), scan = scanPageData(document, schema), scoped = scopePageData(document, scan, ['same']);
    expect(scoped.sources.main.fields.amount.defaultFormat).toBe('number-2');
    expect(scoped.filters).toEqual(document.filters);
    expect(() => validateDataReadCommand('draft', { '--at': [tableAt], '--select': ['fields'] })).toThrow('scan-only');
    expect(() => validateDataReadCommand('scan', { '--at': [tableAt] })).toThrow('require --select');
    expect(() => facet(document, 'fields', { '--limit': ['0'] })).toThrow('limit');
  });
});
